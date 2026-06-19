import { renderScoutReport, scoutOpportunities } from '../agents/opportunityScout.js';
import { findSecretPatternMatches } from '../policy/secretPatterns.js';
import { makeEvent, RunStore } from './runStore.js';
import { finalizeVerificationManifest } from './trustProof.js';
import type { RunEventBus } from './eventBus.js';
import type { LiveRunReceipt, TenderBoardConfig } from './types.js';

interface CrooEvent {
  type: string;
  raw: Record<string, unknown>;
  negotiation_id?: string;
  order_id?: string;
  service_id?: string;
  status?: string;
  reason?: string;
}

interface CrooNegotiation {
  negotiationId: string;
  serviceId: string;
  requirements: string;
  status: string;
}

interface CrooOrder {
  orderId: string;
  negotiationId: string;
  serviceId: string;
  status: string;
  price: string;
  paymentToken: string;
  payTxHash?: string;
  deliverTxHash?: string;
}

interface CrooDelivery {
  deliverableText?: string;
  deliverableType?: string;
}

interface CrooClient {
  connectWebSocket(): Promise<CrooStream>;
  negotiateOrder(req: Record<string, unknown>): Promise<CrooNegotiation>;
  acceptNegotiation(negotiationId: string): Promise<{ negotiation: CrooNegotiation; order: CrooOrder }>;
  rejectNegotiation(negotiationId: string, reason: string): Promise<void>;
  getNegotiation(negotiationId: string): Promise<CrooNegotiation>;
  payOrder(orderId: string): Promise<{ order: CrooOrder; txHash: string }>;
  deliverOrder(orderId: string, req: Record<string, unknown>): Promise<{ order: CrooOrder; delivery: CrooDelivery; txHash: string }>;
  getDelivery(orderId: string): Promise<CrooDelivery>;
}

interface CrooStream {
  on(eventType: string, handler: (event: CrooEvent) => void | Promise<void>): void;
  onAny?(handler: (event: CrooEvent) => void | Promise<void>): void;
  close(): void;
}

interface CrooSdkModule {
  AgentClient: new (config: Record<string, unknown>, sdkKey: string) => CrooClient;
  EventType: Record<string, string>;
  DeliverableType: Record<string, string>;
}

export interface LiveCrooRuntimeOptions {
  config: TenderBoardConfig;
  store: RunStore;
  bus: RunEventBus;
  loadSdk?: () => Promise<CrooSdkModule>;
}

export class LiveCrooRuntime {
  private readonly config: TenderBoardConfig;
  private readonly store: RunStore;
  private readonly bus: RunEventBus;
  private readonly loadSdk: () => Promise<CrooSdkModule>;
  private sdk: CrooSdkModule | undefined;
  private requesterClient: CrooClient | undefined;
  private workerClient: CrooClient | undefined;
  private requesterStream: CrooStream | undefined;
  private workerStream: CrooStream | undefined;
  private readonly negotiationToRun = new Map<string, string>();
  private readonly orderToRun = new Map<string, string>();
  private readonly paidOrderIds = new Set<string>();
  private readonly deliveredOrderIds = new Set<string>();
  private readonly acceptedNegotiationIds = new Set<string>();

  constructor(options: LiveCrooRuntimeOptions) {
    this.config = options.config;
    this.store = options.store;
    this.bus = options.bus;
    this.loadSdk = options.loadSdk ?? loadCrooSdk;
  }

  async startRun(receipt: LiveRunReceipt): Promise<LiveRunReceipt> {
    this.requireLiveConfig();
    await this.ensureStreams();
    const client = await this.getRequesterClient();
    const now = new Date().toISOString();

    await this.store.update(receipt.runId, { status: 'negotiating', updatedAt: now });
    await this.record(receipt.runId, makeEvent({ at: now, source: 'task-giver', type: 'negotiating', message: 'Task-giver agent is sending the task to CROO.' }));

    const negotiation = await client.negotiateOrder({
      serviceId: this.config.workerServiceId,
      requirements: JSON.stringify({
        source: 'tenderboard-live',
        runId: receipt.runId,
        title: receipt.taskTitle,
        sanitizedTask: receipt.sanitizedTask,
        maxPayment: receipt.maxPayment,
      }),
      metadata: JSON.stringify({ app: 'TenderBoard', runId: receipt.runId }),
    });

    this.negotiationToRun.set(negotiation.negotiationId, receipt.runId);
    const updated = await this.store.update(receipt.runId, {
      status: 'negotiating',
      updatedAt: new Date().toISOString(),
      negotiationId: negotiation.negotiationId,
      crooServiceId: negotiation.serviceId,
    });
    await this.record(
      receipt.runId,
      makeEvent({
        source: 'croo',
        type: 'negotiation_created',
        message: 'CROO negotiation created.',
        data: { negotiationId: negotiation.negotiationId, serviceId: negotiation.serviceId },
      }),
    );

    return updated;
  }

  async approvePayment(runId: string): Promise<LiveRunReceipt> {
    this.requireLiveConfig();
    const receipt = await this.store.require(runId);
    if (receipt.status !== 'awaiting_payment_approval') {
      throw new Error(`Run is not waiting for payment approval. Current status: ${receipt.status}`);
    }
    if (!receipt.orderId) {
      throw new Error('Cannot pay yet. CROO has not created an order id.');
    }
    if (this.paidOrderIds.has(receipt.orderId)) {
      return receipt;
    }
    ensureAmountWithinCap(receipt.maxPayment.amount, this.config.maxPaymentUsdc);

    const client = await this.getRequesterClient();
    const now = new Date().toISOString();
    await this.store.update(runId, { status: 'paying', updatedAt: now });
    await this.record(runId, makeEvent({ at: now, source: 'app', type: 'payment_approved', message: 'Payment approved for this exact order.', data: { orderId: receipt.orderId, amount: receipt.maxPayment.amount } }));

    const paid = await client.payOrder(receipt.orderId);
    this.paidOrderIds.add(receipt.orderId);
    const updated = await this.store.update(runId, {
      status: 'paid',
      updatedAt: new Date().toISOString(),
      paymentTxHash: paid.txHash,
    });
    await this.record(runId, makeEvent({ source: 'croo', type: 'payment_paid', message: 'CROO payment transaction sent.', data: { orderId: receipt.orderId, txHash: paid.txHash } }));
    return updated;
  }

  async close(): Promise<void> {
    this.requesterStream?.close();
    this.workerStream?.close();
  }

  private async ensureStreams(): Promise<void> {
    const sdk = await this.getSdk();
    const requester = await this.getRequesterClient();

    if (!this.requesterStream) {
      this.requesterStream = await requester.connectWebSocket();
      this.requesterStream.on(sdk.EventType.OrderCreated!, (event) => this.handleOrderCreated(event));
      this.requesterStream.on(sdk.EventType.OrderCompleted!, (event) => this.handleOrderCompleted(event));
      this.requesterStream.on(sdk.EventType.OrderRejected!, (event) => this.handleOrderRejected(event));
      this.requesterStream.on(sdk.EventType.OrderExpired!, (event) => this.handleOrderExpired(event));
    }

    if (this.config.embeddedWorker && !this.workerStream) {
      const worker = await this.getWorkerClient();
      this.workerStream = await worker.connectWebSocket();
      this.workerStream.on(sdk.EventType.NegotiationCreated!, (event) => this.handleWorkerNegotiation(event));
      this.workerStream.on(sdk.EventType.OrderPaid!, (event) => this.handleWorkerOrderPaid(event));
    }
  }

  private async handleWorkerNegotiation(event: CrooEvent): Promise<void> {
    const negotiationId = event.negotiation_id;
    if (!negotiationId || this.acceptedNegotiationIds.has(negotiationId)) return;

    const worker = await this.getWorkerClient();
    const negotiation = await worker.getNegotiation(negotiationId);
    const parsed = parseTenderBoardRequirements(negotiation.requirements);

    if (!parsed) {
      await worker.rejectNegotiation(negotiationId, 'TenderBoard worker only accepts TenderBoard live tasks.');
      return;
    }

    this.negotiationToRun.set(negotiationId, parsed.runId);
    const unsafe = findSecretPatternMatches([parsed.sanitizedTask, parsed.title]);
    if (unsafe.length > 0) {
      await worker.rejectNegotiation(negotiationId, 'Task contains forbidden secret-looking data.');
      await this.failRun(parsed.runId, 'Worker rejected task because it contained forbidden secret-looking data.');
      return;
    }

    ensureAmountWithinCap(parsed.maxPayment.amount, this.config.maxPaymentUsdc);
    this.acceptedNegotiationIds.add(negotiationId);
    await this.record(parsed.runId, makeEvent({ source: 'worker', type: 'negotiation_received', message: 'Worker agent received the CROO negotiation.', data: { negotiationId } }));

    const accepted = await worker.acceptNegotiation(negotiationId);
    const orderId = accepted.order.orderId;
    this.orderToRun.set(orderId, parsed.runId);
    await this.store.update(parsed.runId, {
      status: 'awaiting_payment_approval',
      updatedAt: new Date().toISOString(),
      orderId,
      crooServiceId: accepted.order.serviceId,
    });
    await this.record(parsed.runId, makeEvent({ source: 'croo', type: 'order_created', message: 'Worker accepted. CROO order created. Waiting for payment approval.', data: { orderId, negotiationId } }));
  }

  private async handleOrderCreated(event: CrooEvent): Promise<void> {
    const orderId = event.order_id;
    if (!orderId) return;
    const runId = findRunIdForEvent(event, this.negotiationToRun, this.orderToRun);
    if (!runId) return;
    this.orderToRun.set(orderId, runId);
    await this.store.update(runId, { status: 'awaiting_payment_approval', updatedAt: new Date().toISOString(), orderId });
    await this.record(runId, makeEvent({ source: 'croo', type: 'order_created', message: 'CROO order created. Waiting for payment approval.', data: { orderId } }));
  }

  private async handleWorkerOrderPaid(event: CrooEvent): Promise<void> {
    const orderId = event.order_id;
    if (!orderId || this.deliveredOrderIds.has(orderId)) return;
    const runId = this.orderToRun.get(orderId);
    if (!runId) return;

    const receipt = await this.store.require(runId);
    const worker = await this.getWorkerClient();
    this.deliveredOrderIds.add(orderId);
    await this.store.update(runId, { status: 'working', updatedAt: new Date().toISOString() });
    await this.record(runId, makeEvent({ source: 'worker', type: 'order_paid_received', message: 'Worker saw the paid order and is doing the task.', data: { orderId } }));

    const deliverableText = await buildWorkerDelivery(receipt);
    const sdk = await this.getSdk();
    const delivered = await worker.deliverOrder(orderId, {
      deliverableType: sdk.DeliverableType.Text,
      deliverableText,
    });
    await this.record(runId, makeEvent({ source: 'worker', type: 'delivery_sent', message: 'Worker sent delivery through CROO.', data: { orderId, txHash: delivered.txHash } }));
  }

  private async handleOrderCompleted(event: CrooEvent): Promise<void> {
    const orderId = event.order_id;
    if (!orderId) return;
    const runId = this.orderToRun.get(orderId);
    if (!runId) return;

    const requester = await this.getRequesterClient();
    const delivery = await requester.getDelivery(orderId);
    await this.store.update(runId, {
      status: 'delivered',
      updatedAt: new Date().toISOString(),
      deliveryText: delivery.deliverableText ?? JSON.stringify(delivery),
    });
    await this.record(runId, makeEvent({ source: 'croo', type: 'order_completed', message: 'CROO order completed and delivery fetched.', data: { orderId } }));
    const latest = await this.store.require(runId);
    await this.store.update(runId, {
      verificationManifest: finalizeVerificationManifest(latest, latest.deliveryText),
    });
  }

  private async handleOrderRejected(event: CrooEvent): Promise<void> {
    const runId = findRunIdForEvent(event, this.negotiationToRun, this.orderToRun);
    if (runId) await this.failRun(runId, event.reason ?? 'CROO order rejected.');
  }

  private async handleOrderExpired(event: CrooEvent): Promise<void> {
    const runId = findRunIdForEvent(event, this.negotiationToRun, this.orderToRun);
    if (runId) await this.failRun(runId, 'CROO order expired.');
  }

  private async failRun(runId: string, message: string): Promise<void> {
    await this.store.update(runId, { status: 'failed', updatedAt: new Date().toISOString(), error: message });
    await this.record(runId, makeEvent({ source: 'croo', type: 'run_failed', message }));
  }

  private async record(runId: string, event: ReturnType<typeof makeEvent>): Promise<void> {
    await this.store.appendEvent(runId, event);
    this.bus.publish(runId, event);
  }

  private async getSdk(): Promise<CrooSdkModule> {
    this.sdk ??= await this.loadSdk();
    return this.sdk;
  }

  private async getRequesterClient(): Promise<CrooClient> {
    if (!this.requesterClient) {
      const sdk = await this.getSdk();
      this.requesterClient = new sdk.AgentClient(this.sdkConfig(), this.config.requesterSdkKey!);
    }
    return this.requesterClient;
  }

  private async getWorkerClient(): Promise<CrooClient> {
    if (!this.workerClient) {
      const sdk = await this.getSdk();
      this.workerClient = new sdk.AgentClient(this.sdkConfig(), this.config.workerSdkKey!);
    }
    return this.workerClient;
  }

  private sdkConfig(): Record<string, unknown> {
    return {
      baseURL: this.config.crooApiUrl,
      wsURL: this.config.crooWsUrl,
      rpcURL: this.config.baseRpcUrl,
    };
  }

  private requireLiveConfig(): void {
    if (this.config.mode !== 'live') throw new Error('Live CROO runtime can only be used in live mode.');
    if (this.config.missingLiveSettings.length > 0) {
      throw new Error(`Live mode is missing: ${this.config.missingLiveSettings.join(', ')}`);
    }
  }
}

async function loadCrooSdk(): Promise<CrooSdkModule> {
  const sdk = await import('@croo-network/sdk');
  return sdk as unknown as CrooSdkModule;
}

export function parseTenderBoardRequirements(requirements: string): {
  runId: string;
  title: string;
  sanitizedTask: string;
  maxPayment: { amount: string; currency: 'USDC' };
} | undefined {
  try {
    const parsed = JSON.parse(requirements) as Record<string, unknown>;
    if (parsed.source !== 'tenderboard-live') return undefined;
    const maxPayment = parsed.maxPayment as { amount?: unknown; currency?: unknown } | undefined;
    if (typeof parsed.runId !== 'string') return undefined;
    if (typeof parsed.title !== 'string') return undefined;
    if (typeof parsed.sanitizedTask !== 'string') return undefined;
    if (!maxPayment || typeof maxPayment.amount !== 'string' || maxPayment.currency !== 'USDC') return undefined;
    return {
      runId: parsed.runId,
      title: parsed.title,
      sanitizedTask: parsed.sanitizedTask,
      maxPayment: { amount: maxPayment.amount, currency: 'USDC' },
    };
  } catch {
    return undefined;
  }
}

export function ensureAmountWithinCap(amountText: string, capText: string): void {
  const amount = Number(amountText);
  const cap = Number(capText);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Invalid payment amount: ${amountText}`);
  if (!Number.isFinite(cap) || cap <= 0) throw new Error(`Invalid payment cap: ${capText}`);
  if (amount > cap) throw new Error(`Payment amount ${amountText} exceeds cap ${capText} USDC.`);
}

function findRunIdForEvent(
  event: CrooEvent,
  negotiationToRun: Map<string, string>,
  orderToRun: Map<string, string>,
): string | undefined {
  if (event.order_id && orderToRun.has(event.order_id)) return orderToRun.get(event.order_id);
  if (event.negotiation_id && negotiationToRun.has(event.negotiation_id)) return negotiationToRun.get(event.negotiation_id);
  return undefined;
}

export async function buildWorkerDelivery(
  receipt: LiveRunReceipt,
  options: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<string> {
  const report = await scoutOpportunities(`${receipt.taskTitle}\n${receipt.sanitizedTask}`, options);
  return [
    `TenderBoard worker completed: ${receipt.taskTitle}`,
    '',
    'What I did:',
    '- Received only the safe task text.',
    '- Did not receive private notes or secrets.',
    '- Searched public sources for real links related to the task.',
    '',
    renderScoutReport(report),
  ].join('\n');
}
