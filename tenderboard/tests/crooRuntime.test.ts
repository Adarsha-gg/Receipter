import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { LiveCrooRuntime } from '../src/live/crooRuntime.js';
import { RunEventBus } from '../src/live/eventBus.js';
import { makeEvent, RunStore } from '../src/live/runStore.js';
import type { LiveRunReceipt } from '../src/live/types.js';
import { fakeScoutFetch } from './helpers/fakeScoutFetch.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tenderboard-croo-runtime-'));
  vi.stubGlobal('fetch', fakeScoutFetch);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(tempDir, { recursive: true, force: true });
});

describe('LiveCrooRuntime', () => {
  it('runs the real CROO lifecycle shape through an injected SDK', async () => {
    const fakeSdk = createFakeCrooSdk();
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'live',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      TENDERBOARD_MAX_PAYMENT_USDC: '0.05',
      CROO_API_URL: 'https://api.croo.network',
      CROO_WS_URL: 'wss://api.croo.network/ws',
      CROO_REQUESTER_SDK_KEY: 'croo_sk_requester_secret',
      CROO_WORKER_SDK_KEY: 'croo_sk_worker_secret',
      CROO_WORKER_SERVICE_ID: 'svc_worker',
    });
    const store = new RunStore(tempDir);
    const runtime = new LiveCrooRuntime({
      config,
      store,
      bus: new RunEventBus(),
      loadSdk: async () => fakeSdk as never,
    });
    const receipt = sampleLiveReceipt();
    await store.create(receipt);

    await runtime.startRun(receipt);
    await waitFor(async () => (await store.require(receipt.runId)).status === 'awaiting_payment_approval');

    const accepted = await store.require(receipt.runId);
    expect(accepted.negotiationId).toBe('neg_1');
    expect(accepted.orderId).toBe('order_1');

    await runtime.approvePayment(receipt.runId);
    await waitFor(async () => (await store.require(receipt.runId)).status === 'delivered');

    const completed = await store.require(receipt.runId);
    const receiptText = JSON.stringify(completed);
    expect(completed.paymentTxHash).toBe('0xrealpaymenttx');
    expect(completed.deliveryText).toContain('Opportunity Scout Report');
    expect(completed.deliveryText).toContain('https://example.com/opportunity');
    expect(fakeSdk.calls).toContain('negotiateOrder');
    expect(fakeSdk.calls).toContain('acceptNegotiation');
    expect(fakeSdk.calls).toContain('payOrder');
    expect(fakeSdk.calls).toContain('deliverOrder');
    expect(receiptText).not.toContain('do not send this private note');
  });
});

function sampleLiveReceipt(): LiveRunReceipt {
  return {
    runId: 'run_live_test',
    mode: 'live',
    status: 'sanitized',
    createdAt: '2026-06-18T20:00:00.000Z',
    updatedAt: '2026-06-18T20:00:00.000Z',
    taskTitle: 'Write launch checklist',
    sanitizedTask: 'Task: Write launch checklist\nInstructions:\nMake it useful.',
    maxPayment: { amount: '0.05', currency: 'USDC' },
    trustDecision: {
      workerAgentId: 'svc_worker',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['No secret-looking lines were found in the public worker packet.'],
      controls: ['Payment requires explicit approval.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: undefined,
      checkerPack: 'research',
      acceptanceCriteria: ['Safe task only.'],
      requiredChecks: [
        { id: 'safe_packet', label: 'Safe worker packet', status: 'passed', detail: 'No forbidden secret pattern remains.' },
        { id: 'delivery_evidence', label: 'Delivery evidence', status: 'pending', detail: 'Waiting for worker delivery.' },
      ],
      settlementRule: 'Release after approval and delivery.',
      reputationWriteback: 'Use receipt as feedback.',
    },
    crooServiceId: 'svc_worker',
    negotiationId: undefined,
    orderId: undefined,
    paymentTxHash: undefined,
    deliveryText: undefined,
    error: undefined,
    events: [makeEvent({ source: 'app', type: 'run_created', message: 'Task created.' })],
  };
}

function createFakeCrooSdk() {
  const calls: string[] = [];
  const streams: Record<string, FakeStream> = {
    requester: new FakeStream(),
    worker: new FakeStream(),
  };
  let requirements = '';
  let deliveredText = 'no delivery yet';

  class AgentClient {
    private readonly role: 'requester' | 'worker';

    constructor(_config: Record<string, unknown>, sdkKey: string) {
      this.role = sdkKey.includes('worker') ? 'worker' : 'requester';
    }

    async connectWebSocket(): Promise<FakeStream> {
      return streams[this.role]!;
    }

    async negotiateOrder(req: Record<string, unknown>) {
      calls.push('negotiateOrder');
      requirements = String(req.requirements ?? '');
      queueMicrotask(() => {
        void streams.worker!.emit('order_negotiation_created', { type: 'order_negotiation_created', raw: {}, negotiation_id: 'neg_1' });
      });
      return { negotiationId: 'neg_1', serviceId: 'svc_worker', requirements, status: 'pending' };
    }

    async getNegotiation(negotiationId: string) {
      calls.push('getNegotiation');
      return { negotiationId, serviceId: 'svc_worker', requirements, status: 'pending' };
    }

    async acceptNegotiation(negotiationId: string) {
      calls.push('acceptNegotiation');
      queueMicrotask(() => {
        void streams.requester!.emit('order_created', { type: 'order_created', raw: {}, negotiation_id: negotiationId, order_id: 'order_1' });
      });
      return {
        negotiation: { negotiationId, serviceId: 'svc_worker', requirements, status: 'accepted' },
        order: { orderId: 'order_1', negotiationId, serviceId: 'svc_worker', status: 'created', price: '0.05', paymentToken: 'USDC' },
      };
    }

    async rejectNegotiation(_negotiationId: string, _reason: string) {
      calls.push('rejectNegotiation');
    }

    async payOrder(orderId: string) {
      calls.push('payOrder');
      queueMicrotask(() => {
        void streams.worker!.emit('order_paid', { type: 'order_paid', raw: {}, order_id: orderId });
      });
      return {
        txHash: '0xrealpaymenttx',
        order: { orderId, negotiationId: 'neg_1', serviceId: 'svc_worker', status: 'paid', price: '0.05', paymentToken: 'USDC' },
      };
    }

    async deliverOrder(orderId: string, req: Record<string, unknown>) {
      calls.push('deliverOrder');
      deliveredText = String(req.deliverableText ?? '');
      queueMicrotask(() => {
        void streams.requester!.emit('order_completed', { type: 'order_completed', raw: {}, order_id: orderId });
      });
      return {
        txHash: '0xrealdeliverytx',
        order: { orderId, negotiationId: 'neg_1', serviceId: 'svc_worker', status: 'completed', price: '0.05', paymentToken: 'USDC' },
        delivery: { deliverableText: 'real worker delivery' },
      };
    }

    async getDelivery(_orderId: string) {
      calls.push('getDelivery');
      return { deliverableText: deliveredText };
    }
  }

  return {
    AgentClient,
    EventType: {
      NegotiationCreated: 'order_negotiation_created',
      OrderCreated: 'order_created',
      OrderPaid: 'order_paid',
      OrderCompleted: 'order_completed',
      OrderRejected: 'order_rejected',
      OrderExpired: 'order_expired',
    },
    DeliverableType: { Text: 'text' },
    calls,
  };
}

class FakeStream {
  private readonly handlers = new Map<string, Array<(event: Record<string, unknown>) => void | Promise<void>>>();

  on(eventType: string, handler: (event: Record<string, unknown>) => void | Promise<void>): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async emit(eventType: string, event: Record<string, unknown>): Promise<void> {
    await Promise.all((this.handlers.get(eventType) ?? []).map((handler) => handler(event)));
  }

  close(): void {}
}

async function waitFor(assertion: () => Promise<boolean>, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await assertion()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for condition.');
}
