import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAgentPair, handoffStatusForRun } from '../live/agentPair.js';
import { buildAgentMarketCard } from '../live/agentMarketCard.js';
import { buildAgentMemoryPassport, buildAgentMemoryRecord, buildWalrusMemoryIndex } from '../live/agentMemory.js';
import { buildPrivacyLabeledTask, buildWorkerBidBoard, availableWorkerBids } from '../live/bidBoard.js';
import { buildClearingObjects } from '../live/clearingObjects.js';
import { assessStakeChallenge, type StakeChallengeRequest } from '../live/challengeOracle.js';
import { loadTenderBoardConfig } from '../live/config.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import { RunEventBus, formatSseEvent } from '../live/eventBus.js';
import { makeEvent, makeRunId, RunStore } from '../live/runStore.js';
import { buildWorkerReputationCard, markReputationSignalAnchored } from '../live/reputation.js';
import { sanitizeTaskForWorker } from '../live/sanitizeTask.js';
import { buildDemoWorkerDelivery, makeSuiDevDigest, makeSuiDevObjectId, validateExternalWorkerDelivery } from '../live/suiRuntime.js';
import { buildTrustProof, finalizeVerificationManifest } from '../live/trustProof.js';
import { verifyMemoryRecord, verifyPassport } from '../live/memoryVerifier.js';
import { createMemoryStore, type MemoryStore } from '../live/memoryStore.js';
import { buildX402SuiPaymentChallenge, buildX402SuiPaymentResponse } from '../live/x402.js';
import { parseX402PaymentHeader, parseX402PaymentPayload, verifySuiX402Payment } from '../sui/facilitator.js';
import { executeSuiAnchorReceipt } from '../sui/anchorExecutor.js';
import { executeSuiX402Payment } from '../sui/paymentExecutor.js';
import {
  bindAnchorDigest,
  bindPaymentDigest,
  bindWalrusEvidence,
  buildInitialReceiptPlan,
  buildPaymentIntentPlan,
} from '../sui/paymentPlan.js';
import type {
  CreateRunRequest,
  ExternalWorkerDeliveryPayload,
  LiveRunReceipt,
  ScoutEvidence,
  SelectedBidReference,
  TenderBoardConfig,
  WorkerDeliverySubmission,
  WorkerBid,
  X402SuiPaymentPayload,
} from '../live/types.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(dirname, '../client');

export interface TenderBoardServerOptions {
  config?: TenderBoardConfig;
  store?: RunStore;
  bus?: RunEventBus;
  scoutFetch?: typeof fetch;
  suiRpcFetch?: typeof fetch;
  memoryStore?: MemoryStore;
}

export function createTenderBoardServer(options: TenderBoardServerOptions = {}) {
  const config = options.config ?? loadTenderBoardConfig();
  const store = options.store ?? new RunStore(config.receiptsDir);
  const bus = options.bus ?? new RunEventBus();
  const scoutFetch = options.scoutFetch;
  const suiRpcFetch = options.suiRpcFetch;
  const memoryStore = options.memoryStore ?? createMemoryStore(config);

  return createServer(async (req, res) => {
    try {
      await route(req, res, config, store, bus, scoutFetch, suiRpcFetch, memoryStore);
    } catch (error) {
      if (isHttpError(error)) {
        sendJson(res, error.status, { error: error.message });
        return;
      }
      console.error(error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
  scoutFetch: typeof fetch | undefined,
  suiRpcFetch: typeof fetch | undefined,
  memoryStore: MemoryStore,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/') {
    await sendStatic(res, 'index.html');
    return;
  }

  if (method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/styles.css' || url.pathname === '/support.js')) {
    await sendStatic(res, url.pathname.slice(1));
    return;
  }

  if (method === 'GET' && url.pathname === '/api/config') {
    sendJson(res, 200, config.safe);
    return;
  }

  if (method === 'GET' && url.pathname === '/.well-known/agent-card.json') {
    sendJson(res, 200, buildAgentMarketCard(config.workerAgentId, config, await loadAllReceipts(store)));
    return;
  }

  if (method === 'GET' && url.pathname === '/api/runs') {
    sendJson(res, 200, await listRunsWithReputation(store));
    return;
  }

  if (method === 'GET' && url.pathname === '/api/walrus/memory') {
    sendJson(res, 200, buildWalrusMemoryIndex(await loadAllReceipts(store)));
    return;
  }

  const walrusMemoryPassportMatch = url.pathname.match(/^\/api\/walrus\/memory\/([^/]+)$/);
  if (method === 'GET' && walrusMemoryPassportMatch) {
    const workerAgentId = decodeURIComponent(walrusMemoryPassportMatch[1]!);
    sendJson(res, 200, buildAgentMemoryPassport(workerAgentId, await loadAllReceipts(store)));
    return;
  }

  const agentMemoryMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/memory$/);
  if (method === 'GET' && agentMemoryMatch) {
    const workerAgentId = decodeURIComponent(agentMemoryMatch[1]!);
    sendJson(res, 200, buildAgentMemoryPassport(workerAgentId, await loadAllReceipts(store)));
    return;
  }

  const agentCardMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/card$/);
  if (method === 'GET' && agentCardMatch) {
    const workerAgentId = decodeURIComponent(agentCardMatch[1]!);
    sendJson(res, 200, buildAgentMarketCard(workerAgentId, config, await loadAllReceipts(store)));
    return;
  }

  const oraclePassportMatch = url.pathname.match(/^\/api\/oracle\/passports\/([^/]+)\/verify$/);
  if (method === 'GET' && oraclePassportMatch) {
    const workerAgentId = decodeURIComponent(oraclePassportMatch[1]!);
    sendJson(res, 200, await verifyPassport(workerAgentId, await loadAllReceipts(store)));
    return;
  }

  const oracleOwnerPassportMatch = url.pathname.match(/^\/api\/oracle\/owners\/([^/]+)\/passport\/verify$/);
  if (method === 'GET' && oracleOwnerPassportMatch) {
    const ownerAddress = decodeURIComponent(oracleOwnerPassportMatch[1]!);
    const receipts = await loadAllReceipts(store);
    const passport = buildWalrusMemoryIndex(receipts).passports.find((candidate) => sameAddress(candidate.ownerAddress, ownerAddress));
    if (!passport) {
      sendJson(res, 404, { error: 'No worker passport is bound to that Sui owner address.' });
      return;
    }
    sendJson(res, 200, await verifyPassport(passport.workerAgentId, receipts));
    return;
  }

  const oracleRecordMatch = url.pathname.match(/^\/api\/oracle\/records\/([^/]+)\/verify$/);
  if (method === 'GET' && oracleRecordMatch) {
    const receipt = await store.get(oracleRecordMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, await verifyMemoryRecord(receipt));
    return;
  }

  const oracleChallengeMatch = url.pathname.match(/^\/api\/oracle\/records\/([^/]+)\/challenges\/assess$/);
  if (method === 'POST' && oracleChallengeMatch) {
    const receipt = await store.get(oracleChallengeMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    const body = await readJson<StakeChallengeRequest>(req);
    sendJson(res, 200, await assessStakeChallengeOrThrow(receipt, body));
    return;
  }

  if (method === 'POST' && url.pathname === '/api/runs') {
    const body = await readJson<CreateRunRequest>(req);
    const response = await createRun(body, config, store, bus);
    sendJson(res, 201, response);
    return;
  }

  const receiptMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/receipt$/);
  if (method === 'GET' && receiptMatch) {
    const receipt = await store.get(receiptMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendReceiptJson(res, receipt);
    return;
  }

  const runMemoryMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/memory$/);
  if (method === 'GET' && runMemoryMatch) {
    const receipt = await store.get(runMemoryMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, receipt.memoryRecord ?? buildAgentMemoryRecord(receipt));
    return;
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (method === 'GET' && runMatch) {
    const receipt = await store.get(runMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, receipt);
    return;
  }

  if (method === 'POST' && url.pathname === '/api/x402/verify') {
    const payload = parseX402PaymentHeader(req.headers['x-payment'] ?? req.headers['payment-signature']) ?? parseX402PaymentPayload(await readJson<unknown>(req));
    const result = await facilitateX402Payment(payload, payload.resource, config, store, bus, suiRpcFetch);
    sendJson(
      res,
      200,
      result,
      result.paymentResponse
        ? {
            'X-Payment-Protocol': 'x402',
            'X-Payment-Response': JSON.stringify(result.paymentResponse),
          }
        : { 'X-Payment-Protocol': 'x402' },
    );
    return;
  }

  const handoffMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/agent-handoff$/);
  if (method === 'GET' && handoffMatch) {
    const receipt = await store.get(handoffMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    sendJson(res, 200, {
      hirerAgent: receipt.hirerAgent,
      workerAgent: receipt.workerAgent,
      agentHandoff: receipt.agentHandoff,
      workerBidBoard: receipt.workerBidBoard,
      reputationSnapshot: receipt.reputationSnapshot,
    });
    return;
  }

  const workerTaskMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/worker-task$/);
  if (method === 'GET' && workerTaskMatch) {
    let receipt = await store.get(workerTaskMatch[1]!);
    if (!receipt) {
      sendJson(res, 404, { error: 'Run not found' });
      return;
    }
    if (!receipt.suiPaymentDigest) {
      const paymentPayload = parseX402PaymentHeader(req.headers['x-payment'] ?? req.headers['payment-signature']);
      if (paymentPayload) {
        const result = await facilitateX402Payment(paymentPayload, url.pathname, config, store, bus, suiRpcFetch);
        receipt = result.receipt;
        sendWorkerTaskJson(res, receipt, result.paymentResponse ? { paymentResponse: result.paymentResponse } : {});
        return;
      }

      const challenge = buildX402SuiPaymentChallenge(receipt, url.pathname);
      sendJson(res, 402, challenge, {
        'X-Payment-Protocol': 'x402',
        'X-Payment-Required': 'true',
      });
      return;
    }

    sendWorkerTaskJson(res, receipt);
    return;
  }

  const eventsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
  if (method === 'GET' && eventsMatch) {
    await streamEvents(res, eventsMatch[1]!, store, bus);
    return;
  }

  const approveMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/approve-payment$/);
  if (method === 'POST' && approveMatch) {
    const body = await readJson<{ suiPaymentDigest?: string }>(req);
    const receipt = await approvePayment(approveMatch[1]!, body, config, store, bus);
    sendJson(res, 200, receipt);
    return;
  }

  const workerDeliveryMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/worker-delivery$/);
  if (method === 'POST' && workerDeliveryMatch) {
    const body = await readJson<WorkerDeliverySubmission>(req);
    const receipt = await submitWorkerDelivery(workerDeliveryMatch[1]!, body, config, store, bus, scoutFetch);
    sendJson(res, 200, receipt);
    return;
  }

  const walrusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/store-evidence$/);
  if (method === 'POST' && walrusMatch) {
    const receipt = await storeEvidence(walrusMatch[1]!, config, store, bus, memoryStore);
    sendJson(res, 200, receipt);
    return;
  }

  const anchorMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/anchor-receipt$/);
  if (method === 'POST' && anchorMatch) {
    const body = await readJson<{ suiAnchorDigest?: string }>(req);
    const receipt = await anchorReceipt(anchorMatch[1]!, body, config, store, bus);
    sendJson(res, 200, receipt);
    return;
  }

  const cancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/);
  if (method === 'POST' && cancelMatch) {
    const receipt = await cancelRun(cancelMatch[1]!, store, bus);
    sendJson(res, 200, receipt);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function createRun(
  body: CreateRunRequest,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
): Promise<{ runId: string; status: string; sanitizedTask: string }> {
  validateCreateRun(body, config);

  if (config.mode === 'sui' && config.missingSuiSettings.length > 0) {
    throw httpError(400, `Sui mode is missing: ${config.missingSuiSettings.join(', ')}`);
  }

  const now = new Date().toISOString();
  const runId = makeRunId();
  const sanitized = sanitizeTaskForWorker(body);
  const privacy = buildPrivacyLabeledTask(body);
  const workerBidBoard = buildWorkerBidBoard(body, config);
  const selectedBid = workerBidBoard.bids.find((bid) => bid.bidId === workerBidBoard.selectedBidId);
  const workerAgentId = selectedBid?.workerAgentId ?? config.workerAgentId;
  const historicalReceipts = await loadAllReceipts(store);
  const workerMemoryPassport = buildAgentMemoryPassport(workerAgentId, historicalReceipts, now);
  const trustProof = buildTrustProof({
    request: body,
    sanitizedTask: sanitized.sanitizedTask,
    removedLines: sanitized.removedLines,
    privateNotesProvided: sanitized.privateNotesProvided,
    config,
    workerBidBoard,
    workerMemoryPassport,
  });

  if (availableWorkerBids(workerBidBoard).length === 0) {
    throw httpError(400, `No safe worker bid is available: ${workerBidBoard.bids.map((bid) => bid.reason).join(' ')}`);
  }
  if (trustProof.trustDecision.verdict === 'block') {
    throw httpError(400, `Trust gate blocked this task: ${trustProof.trustDecision.reasons.join(' ')}`);
  }

  const workOrderId = `sui_work_order_${runId}`;
  const selectedBidReference = selectedBid ? toSelectedBidReference(selectedBid) : undefined;
  const paymentIntentPlan = buildPaymentIntentPlan({
    runId,
    createdAt: now,
    maxPayment: body.maxPayment,
    selectedBid: selectedBidReference,
    specHash: trustProof.verificationManifest.specHash,
    config,
  });
  const receiptPlan = buildInitialReceiptPlan(paymentIntentPlan, selectedBid?.workerAgentId ?? config.workerAgentId, now);
  const agentPair = buildAgentPair({
    request: body,
    sanitizedTask: sanitized.sanitizedTask,
    selectedBid: selectedBidReference,
    specHash: trustProof.verificationManifest.specHash,
    paymentIntentId: paymentIntentPlan.intentId,
    hirerOwnerAddress: config.suiOperatorAddress,
    workerOwnerAddress: config.workerAgentAddress,
  });
  const reputationSnapshot = buildWorkerReputationCard(
    workerAgentId,
    historicalReceipts,
    now,
  );
  const receipt: LiveRunReceipt = {
    runId,
    mode: config.mode,
    status: 'awaiting_payment_approval',
    createdAt: now,
    updatedAt: now,
    taskTitle: body.title,
    sanitizedTask: sanitized.sanitizedTask,
    privacy,
    maxPayment: body.maxPayment,
    workerBidBoard,
    hirerAgent: agentPair.hirerAgent,
    workerAgent: agentPair.workerAgent,
    agentHandoff: agentPair.agentHandoff,
    trustDecision: trustProof.trustDecision,
    verificationManifest: trustProof.verificationManifest,
    paymentIntentPlan,
    receiptPlan,
    reputationSnapshot,
    workerAgentId,
    workOrderId,
    suiNetwork: config.suiNetwork,
    suiPackageId: config.suiPackageId,
    suiReceiptRegistryId: config.suiReceiptRegistryId,
    suiWorkOrderObjectId: config.mode === 'sui-dev' ? makeSuiDevObjectId('work_order', runId) : undefined,
    suiEscrowObjectId: config.mode === 'sui-dev' ? makeSuiDevObjectId('escrow', runId) : undefined,
    suiPaymentDigest: undefined,
    suiAnchorDigest: undefined,
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: undefined,
    workerEvidence: undefined,
    error: undefined,
    events: [
      makeEvent({ at: now, source: 'app', type: 'run_created', message: 'Sui-bound task created.' }),
      makeEvent({ at: now, source: 'app', type: 'task_sanitized', message: 'Private notes were not sent to the worker.' }),
      makeEvent({
        at: now,
        source: 'app',
        type: 'worker_bid_board_evaluated',
        message: 'Worker bids were evaluated against SUI budget and privacy label.',
        data: {
          selectedBidId: workerBidBoard.selectedBidId,
          availableBids: availableWorkerBids(workerBidBoard).length,
          blockedBids: workerBidBoard.bids.filter((bid) => bid.verdict === 'blocked').length,
        },
      }),
      makeEvent({ at: now, source: 'app', type: 'trust_evaluated', message: `Trust gate returned ${trustProof.trustDecision.verdict} at ${trustProof.trustDecision.score}/100.`, data: { score: trustProof.trustDecision.score, tier: trustProof.trustDecision.tier, verdict: trustProof.trustDecision.verdict } }),
      makeEvent({
        at: now,
        source: 'sui',
        type: 'sui_work_order_created',
        message: 'Nonce-bound Sui payment intent prepared. Payment approval is required.',
        data: {
          workOrderId,
          intentId: paymentIntentPlan.intentId,
          paymentNonce: paymentIntentPlan.paymentNonce,
          settlementNonce: paymentIntentPlan.settlementNonce,
          amountMist: paymentIntentPlan.amountMist,
          coinType: paymentIntentPlan.coinType,
          receiverAddress: paymentIntentPlan.receiverAddress,
          network: config.suiNetwork,
          paymentUri: paymentIntentPlan.paymentUri,
          paymentKitMode: paymentIntentPlan.paymentKitMode,
        },
      }),
      makeEvent({
        at: now,
        source: 'app',
        type: 'worker_reputation_snapshot_attached',
        message: 'Pre-run worker reputation passport attached from anchored public receipts.',
        data: {
          workerAgentId: reputationSnapshot.workerAgentId,
          anchoredRunCount: reputationSnapshot.anchoredRunCount,
          walrusEvidenceCount: reputationSnapshot.walrusEvidenceCount,
          memoryCount: reputationSnapshot.memoryCount,
          averageClaimSupport: reputationSnapshot.averageClaimSupport,
          lastMemoryId: reputationSnapshot.lastMemoryId,
          averageTrustScore: reputationSnapshot.averageTrustScore,
        },
      }),
      makeEvent({
        at: now,
        source: 'app',
        type: 'agent_handoff_created',
        message: 'Hirer agent awarded the sanitized Sui work order to the selected worker agent.',
        data: {
          hirerAgentId: agentPair.hirerAgent.agentId,
          workerAgentId: agentPair.workerAgent.agentId,
          selectedBidId: agentPair.agentHandoff.selectedBidId,
          safePacketHash: agentPair.agentHandoff.safePacketHash,
        },
      }),
      makeEvent({ at: now, source: 'sui', type: 'verification_manifest_created', message: 'Verification manifest is ready for Sui anchoring.', data: { specHash: trustProof.verificationManifest.specHash } }),
    ],
  };

  if (sanitized.removedLines.length > 0) {
    receipt.events.push(
      makeEvent({
        at: now,
        source: 'app',
        type: 'unsafe_lines_removed',
        message: `${sanitized.removedLines.length} unsafe line(s) were removed before sending to the worker.`,
      }),
    );
  }

  Object.assign(receipt, buildClearingObjects(receipt));

  await store.create(receipt);
  for (const event of receipt.events) bus.publish(runId, event);

  return { runId, status: receipt.status, sanitizedTask: receipt.sanitizedTask };
}

async function approvePayment(
  runId: string,
  body: { suiPaymentDigest?: string },
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
): Promise<LiveRunReceipt> {
  const receipt = await store.require(runId);
  let automaticPaymentResult: Awaited<ReturnType<typeof executeSuiX402Payment>> | undefined;
  const providedPaymentDigest = body.suiPaymentDigest?.trim();
  const suiPaymentDigest =
    config.mode === 'sui-dev'
      ? makeSuiDevDigest('payment', runId)
      : providedPaymentDigest ?? (config.suiCliPath ? ((automaticPaymentResult = await executeAutomaticSuiPayment(receipt, config)).digest) : undefined);
  if (!suiPaymentDigest) {
    throw httpError(400, 'Sui mode requires suiPaymentDigest from the payment approval transaction or SUI_CLI_PATH for automatic payment.');
  }
  return recordPaymentApproval(runId, suiPaymentDigest, config, store, bus, automaticPaymentResult
    ? {
        appEventType: 'x402_payment_executed',
        appMessage: 'Sui-native x402 payment was executed from the configured local wallet.',
        suiEventType: 'sui_x402_payment_settled',
        suiMessage: 'Sui-native x402 payment transaction executed and bound to the receipt plan.',
        extraData: {
          paymentPayload: automaticPaymentResult.payload,
          commandArgs: automaticPaymentResult.args,
          automatic: true,
        },
      }
    : {});
}

async function facilitateX402Payment(
  payload: X402SuiPaymentPayload,
  resource: string,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
  suiRpcFetch: typeof fetch | undefined,
): Promise<{ verification: Awaited<ReturnType<typeof verifySuiX402Payment>>; paymentResponse: ReturnType<typeof buildX402SuiPaymentResponse>; receipt: LiveRunReceipt }> {
  const receipt = await store.get(payload.runId);
  if (!receipt) {
    throw httpError(404, 'Run not found');
  }

  const verification = await verifySuiX402Payment({
    receipt,
    payload,
    resource,
    config,
    ...(suiRpcFetch ? { fetchImpl: suiRpcFetch } : {}),
  });
  const updated = await recordPaymentApproval(payload.runId, verification.transaction, config, store, bus, {
    appEventType: 'x402_payment_verified',
    appMessage: 'Sui-native x402 facilitator verified payment for this work order.',
    suiEventType: config.mode === 'sui-dev' ? 'sui_dev_x402_payment_settled' : 'sui_x402_payment_settled',
    suiMessage: 'Sui-native x402 facilitator bound payment proof to the receipt plan.',
    extraData: { verification },
  });

  return {
    verification,
    paymentResponse: buildX402SuiPaymentResponse(updated),
    receipt: updated,
  };
}

async function recordPaymentApproval(
  runId: string,
  suiPaymentDigest: string,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
  options: {
    appEventType?: string;
    appMessage?: string;
    suiEventType?: string;
    suiMessage?: string;
    extraData?: Record<string, unknown>;
  } = {},
): Promise<LiveRunReceipt> {
  const receipt = await store.require(runId);
  if (receipt.status !== 'awaiting_payment_approval') {
    throw httpError(409, `Run is not waiting for payment approval. Current status: ${receipt.status}`);
  }

  const now = new Date().toISOString();
  const receiptPlan = requireReceiptPlan(receipt);
  const paymentIntentPlan = requirePaymentIntentPlan(receipt);
  await store.update(runId, {
    status: 'working',
    updatedAt: now,
    suiPaymentDigest,
    receiptPlan: bindPaymentDigest(receiptPlan, suiPaymentDigest, now),
    ...agentHandoffUpdate(receipt, 'working'),
  });

  const appPaymentEvent = {
    at: now,
    source: 'app' as const,
    type: options.appEventType ?? 'payment_approved',
    message: options.appMessage ?? 'Sui payment approval was recorded for this work order.',
  };
  const events = [
    makeEvent(options.extraData ? { ...appPaymentEvent, data: options.extraData } : appPaymentEvent),
    makeEvent({
      at: now,
      source: 'sui',
      type: options.suiEventType ?? (config.mode === 'sui-dev' ? 'sui_dev_payment_recorded' : 'sui_payment_recorded'),
      message: options.suiMessage ?? 'Sui payment digest recorded and bound to the receipt plan.',
      data: {
        digest: suiPaymentDigest,
        intentId: paymentIntentPlan.intentId,
        paymentNonce: paymentIntentPlan.paymentNonce,
        settlementNonce: paymentIntentPlan.settlementNonce,
        amountMist: paymentIntentPlan.amountMist,
        coinType: paymentIntentPlan.coinType,
        receiverAddress: paymentIntentPlan.receiverAddress,
        ...(options.extraData ?? {}),
      },
    }),
    makeEvent({
      at: now,
      source: 'worker',
      type: 'worker_task_available',
      message: 'Selected worker agent can now submit delivery for the paid work order.',
      data: {
        workerAgentId: receipt.workerAgentId,
        selectedBidId: receipt.workerBidBoard?.selectedBidId,
        handoffId: receipt.agentHandoff?.handoffId,
      },
    }),
  ];

  for (const event of events) {
    await store.appendEvent(runId, event);
    bus.publish(runId, event);
  }

  return store.require(runId);
}

async function submitWorkerDelivery(
  runId: string,
  body: WorkerDeliverySubmission,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
  scoutFetch: typeof fetch | undefined,
): Promise<LiveRunReceipt> {
  const receipt = await store.require(runId);
  if (receipt.status !== 'working') {
    throw httpError(409, `Run is not waiting for worker delivery. Current status: ${receipt.status}`);
  }
  if (!receipt.suiPaymentDigest) {
    throw httpError(409, 'Run needs Sui payment approval before worker delivery.');
  }

  const now = new Date().toISOString();
  const delivery = await resolveWorkerDeliverySubmission(receipt, body, config, scoutFetch);

  await store.update(runId, {
    status: 'delivered',
    updatedAt: now,
    deliveryText: delivery.deliveryText,
    workerEvidence: delivery.workerEvidence,
    ...agentHandoffUpdate(receipt, 'delivered'),
  });

  const events = [
    makeEvent({
      at: now,
      source: 'worker',
      type: 'delivery_sent',
      message: 'Worker agent submitted delivery for the paid work order.',
      data: {
        workerAgentId: receipt.workerAgentId,
        handoffId: receipt.agentHandoff?.handoffId,
        sourceEvidenceHash: delivery.workerEvidence?.evidenceHash,
        deliveryPayloadHash: delivery.payloadHash,
        identityProofType: delivery.identityProof?.proofType,
        demoWorker: delivery.demoWorker,
      },
    }),
    makeEvent({ at: now, source: 'walrus', type: 'walrus_upload_pending', message: 'Full receipt and evidence should be uploaded to Walrus before Sui anchoring.' }),
  ];

  for (const event of events) {
    await store.appendEvent(runId, event);
    bus.publish(runId, event);
  }

  const latest = await store.require(runId);
  const verificationManifest = finalizeVerificationManifest(latest, delivery.deliveryText);
  const finalizedReceipt = {
    ...latest,
    verificationManifest,
    deliveryText: delivery.deliveryText,
    workerEvidence: delivery.workerEvidence,
  };
  const clearingObjects = buildClearingObjects(finalizedReceipt);
  const memoryRecord = buildAgentMemoryRecord({ ...finalizedReceipt, ...clearingObjects });
  await store.update(runId, {
    verificationManifest,
    memoryRecord,
    ...clearingObjects,
  });

  return store.require(runId);
}

async function resolveWorkerDeliverySubmission(
  receipt: LiveRunReceipt,
  body: WorkerDeliverySubmission,
  config: TenderBoardConfig,
  scoutFetch: typeof fetch | undefined,
): Promise<{
  deliveryText: string;
  workerEvidence: ScoutEvidence;
  payloadHash: string | undefined;
  identityProof: ExternalWorkerDeliveryPayload['identityProof'] | undefined;
  demoWorker: boolean;
}> {
  if (isDemoWorkerDeliveryRequest(body)) {
    if (config.mode !== 'sui-dev') {
      throw httpError(400, 'Built-in Opportunity Scout delivery is only available as an explicit sui-dev demo fallback.');
    }
    const delivery = scoutFetch ? await buildDemoWorkerDelivery(receipt, { fetchImpl: scoutFetch }) : await buildDemoWorkerDelivery(receipt);
    return {
      ...delivery,
      payloadHash: undefined,
      identityProof: undefined,
      demoWorker: true,
    };
  }

  if (!isExternalWorkerDeliveryPayload(body)) {
    throw httpError(400, 'Worker delivery requires walrusproof.external_worker_delivery.v1 payload or explicit sui-dev useDemoWorker fallback.');
  }

  const validation = validateExternalWorkerDelivery(receipt, body);
  if (!validation.ok || !validation.delivery) {
    throw httpError(400, `Invalid worker delivery: ${validation.errors.join(' ')}`);
  }

  return {
    ...validation.delivery,
    demoWorker: false,
  };
}

function isDemoWorkerDeliveryRequest(body: unknown): body is Extract<WorkerDeliverySubmission, { useDemoWorker: true }> {
  return isRecord(body) && body.useDemoWorker === true;
}

function isExternalWorkerDeliveryPayload(body: unknown): body is ExternalWorkerDeliveryPayload {
  return isRecord(body) && body.objectType === 'walrusproof.external_worker_delivery.v1';
}

async function storeEvidence(
  runId: string,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
  memoryStore: MemoryStore,
): Promise<LiveRunReceipt> {
  const receipt = await store.require(runId);
  if (!receipt.deliveryText) {
    throw httpError(409, 'Run needs worker delivery before Walrus evidence storage.');
  }
  if (receipt.status !== 'delivered' && receipt.status !== 'anchoring') {
    throw httpError(409, `Run cannot store evidence from status: ${receipt.status}`);
  }

  const now = new Date().toISOString();
  const baseReceiptPlan = requireReceiptPlan(receipt);
  const paymentIntentPlan = requirePaymentIntentPlan(receipt);
  const result = await memoryStore.putEvidenceBundle(receipt);
  const receiptPlan = bindWalrusEvidence(
    baseReceiptPlan,
    {
      walrusBlobId: result.blobId,
      walrusBlobObjectId: result.blobObjectId,
      walrusCertifiedEpoch: result.certifiedEpoch,
      walrusEndEpoch: result.endEpoch,
      walrusReadUrl: result.readUrl,
    },
    now,
  );
  const updatedForManifest: LiveRunReceipt = {
    ...receipt,
    status: 'anchoring',
    updatedAt: now,
    walrusBlobId: result.blobId,
    walrusBlobObjectId: result.blobObjectId,
    walrusCertifiedEpoch: result.certifiedEpoch,
    walrusEndEpoch: result.endEpoch,
    walrusReadUrl: result.readUrl,
    receiptPlan,
  };
  const verificationManifest = finalizeVerificationManifest(updatedForManifest, receipt.deliveryText);
  const updatedForClearing = {
    ...updatedForManifest,
    verificationManifest,
  };
  const clearingObjects = buildClearingObjects(updatedForClearing);
  const nextStatus = clearingObjects.clearingDecision.verdict === 'ready_to_anchor' ? 'anchoring' : 'delivered';
  const memoryRecord = buildAgentMemoryRecord({ ...updatedForClearing, status: nextStatus, ...clearingObjects });

  await store.update(runId, {
    status: nextStatus,
    updatedAt: now,
    walrusBlobId: result.blobId,
    walrusBlobObjectId: result.blobObjectId,
    walrusCertifiedEpoch: result.certifiedEpoch,
    walrusEndEpoch: result.endEpoch,
    walrusReadUrl: result.readUrl,
    receiptPlan,
    verificationManifest,
    memoryRecord,
    ...(clearingObjects.clearingDecision.verdict === 'requires_review'
      ? agentHandoffReviewUpdate(receipt)
      : agentHandoffUpdate(receipt, nextStatus)),
    ...clearingObjects,
  });

  const events = [
    makeEvent({
      at: now,
      source: 'walrus',
      type: config.mode === 'sui-dev' ? 'walrus_dev_blob_recorded' : 'walrus_blob_stored',
      message: 'Evidence bundle stored for Sui receipt anchoring.',
      data: {
        blobId: result.blobId,
        blobObjectId: result.blobObjectId,
        endEpoch: result.endEpoch,
        readUrl: result.readUrl,
        memoryId: memoryRecord.memoryId,
        memoryHash: memoryRecord.memoryHash,
        intentId: paymentIntentPlan.intentId,
        paymentNonce: paymentIntentPlan.paymentNonce,
        settlementNonce: paymentIntentPlan.settlementNonce,
      },
    }),
    makeEvent({
      at: now,
      source: 'sui',
      type: 'sui_anchor_ready',
      message: 'Walrus evidence id is ready to be committed to the Sui receipt registry.',
      data: { registry: config.suiReceiptRegistryId, packageId: config.suiPackageId },
    }),
  ];

  for (const event of events) {
    await store.appendEvent(runId, event);
    bus.publish(runId, event);
  }

  return store.require(runId);
}

async function anchorReceipt(
  runId: string,
  body: { suiAnchorDigest?: string },
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
): Promise<LiveRunReceipt> {
  const receipt = await store.require(runId);
  if (!receipt.walrusBlobId) {
    throw httpError(409, 'Run needs a Walrus blob id before Sui anchoring.');
  }
  if (receipt.status !== 'anchoring' && receipt.status !== 'anchored') {
    throw httpError(409, `Run cannot be anchored from status: ${receipt.status}`);
  }
  if (receipt.status !== 'anchored' && receipt.clearingDecision?.verdict !== 'ready_to_anchor') {
    throw httpError(409, `Run is not verification-admissible for Sui anchoring. Current clearing verdict: ${receipt.clearingDecision?.verdict ?? 'missing'}`);
  }

  let automaticAnchorResult: Awaited<ReturnType<typeof executeSuiAnchorReceipt>> | undefined;
  const providedAnchorDigest = nonBlank(body.suiAnchorDigest);
  const suiAnchorDigest =
    config.mode === 'sui-dev'
      ? makeSuiDevDigest('anchor', runId)
      : providedAnchorDigest ?? (config.suiCliPath ? ((automaticAnchorResult = await executeAutomaticSuiAnchor(receipt, config)).digest) : undefined);
  if (!suiAnchorDigest) {
    throw httpError(400, 'Sui mode requires suiAnchorDigest from the receipt registry transaction or SUI_CLI_PATH for automatic anchoring.');
  }

  const receiptPlan = requireReceiptPlan(receipt);
  const paymentIntentPlan = requirePaymentIntentPlan(receipt);
  const now = new Date().toISOString();
  await store.update(runId, {
    status: 'anchored',
    updatedAt: now,
    suiAnchorDigest,
    receiptPlan: bindAnchorDigest(receiptPlan, suiAnchorDigest, now),
    ...agentHandoffUpdate(receipt, 'anchored'),
  });

  const event = makeEvent({
    at: now,
    source: 'sui',
    type: config.mode === 'sui-dev' ? 'sui_dev_receipt_anchored' : 'sui_receipt_anchored',
    message: 'Final receipt committed to the Sui receipt registry.',
    data: {
      digest: suiAnchorDigest,
      registry: receipt.suiReceiptRegistryId,
      walrusBlobId: receipt.walrusBlobId,
      evidenceHash: receipt.verificationManifest.evidenceHash,
      intentId: paymentIntentPlan.intentId,
      paymentNonce: paymentIntentPlan.paymentNonce,
      settlementNonce: paymentIntentPlan.settlementNonce,
      automatic: Boolean(automaticAnchorResult),
      commandArgs: automaticAnchorResult?.args,
    },
  });
  await store.appendEvent(runId, event);
  bus.publish(runId, event);

  const latest = await store.require(runId);
  await store.update(runId, buildClearingObjects(latest));
  const latestWithClearing = await store.require(runId);
  const anchoredVerificationManifest = finalizeVerificationManifest(latestWithClearing, latestWithClearing.deliveryText);
  const anchoredReceiptForReputation = {
    ...latestWithClearing,
    verificationManifest: anchoredVerificationManifest,
  };
  const receiptsForReputation = (await loadAllReceipts(store)).map((storedReceipt) =>
    storedReceipt.runId === runId ? anchoredReceiptForReputation : storedReceipt,
  );
  const reputationSnapshot = buildWorkerReputationCard(
    latestWithClearing.workerAgentId,
    receiptsForReputation,
    now,
  );
  const verificationManifest = markReputationSignalAnchored(anchoredReceiptForReputation, reputationSnapshot);
  const reputationReceipt = {
    ...latestWithClearing,
    reputationSnapshot,
    verificationManifest,
  };
  const clearingObjects = buildClearingObjects(reputationReceipt);
  const memoryRecord = buildAgentMemoryRecord({ ...reputationReceipt, ...clearingObjects });
  await store.update(runId, {
    reputationSnapshot,
    verificationManifest,
    memoryRecord,
    ...clearingObjects,
  });

  const reputationEvent = makeEvent({
    at: now,
    source: 'sui',
    type: 'worker_reputation_updated',
    message: 'Worker reputation passport updated from the anchored Sui receipt.',
    data: {
      eventName: 'WorkerReputationUpdated',
      workerAgentId: reputationSnapshot.workerAgentId,
      anchoredRunCount: reputationSnapshot.anchoredRunCount,
      walrusEvidenceCount: reputationSnapshot.walrusEvidenceCount,
      sourceEvidenceCount: reputationSnapshot.sourceEvidenceCount,
      averageTrustScore: reputationSnapshot.averageTrustScore,
      totalMistEarned: reputationSnapshot.totalMistEarned,
      lastWalrusBlobId: reputationSnapshot.lastWalrusBlobId,
      lastEvidenceHash: reputationSnapshot.lastEvidenceHash,
      memoryId: memoryRecord.memoryId,
    },
  });
  await store.appendEvent(runId, reputationEvent);
  bus.publish(runId, reputationEvent);

  return store.require(runId);
}

async function listRunsWithReputation(store: RunStore): Promise<Awaited<ReturnType<RunStore['list']>>> {
  const summaries = await store.list();
  const receipts = await Promise.all(summaries.map((summary) => store.get(summary.runId)));
  return summaries.map((summary, index) => ({
    ...summary,
    reputationSnapshot: receipts[index]?.reputationSnapshot,
  }));
}

async function loadAllReceipts(store: RunStore): Promise<LiveRunReceipt[]> {
  const summaries = await store.list();
  const receipts = await Promise.all(summaries.map((summary) => store.get(summary.runId)));
  return receipts.filter((receipt): receipt is LiveRunReceipt => Boolean(receipt));
}

function toSelectedBidReference(bid: WorkerBid): SelectedBidReference {
  return {
    bidId: bid.bidId,
    workerAgentId: bid.workerAgentId,
    priceSui: bid.priceSui,
    sla: bid.sla,
    requestedDataLabel: bid.requestedDataLabel,
  };
}

function requirePaymentIntentPlan(receipt: LiveRunReceipt) {
  if (!receipt.paymentIntentPlan) {
    throw httpError(409, 'Run is missing a nonce-bound payment intent plan.');
  }
  return receipt.paymentIntentPlan;
}

function requireReceiptPlan(receipt: LiveRunReceipt) {
  if (!receipt.receiptPlan) {
    throw httpError(409, 'Run is missing a nonce-bound receipt plan.');
  }
  return receipt.receiptPlan;
}

function agentHandoffUpdate(receipt: LiveRunReceipt, status: LiveRunReceipt['status']): { agentHandoff: NonNullable<LiveRunReceipt['agentHandoff']> } | {} {
  return receipt.agentHandoff ? { agentHandoff: { ...receipt.agentHandoff, status: handoffStatusForRun(status) } } : {};
}

function agentHandoffReviewUpdate(receipt: LiveRunReceipt): { agentHandoff: NonNullable<LiveRunReceipt['agentHandoff']> } | {} {
  return receipt.agentHandoff ? { agentHandoff: { ...receipt.agentHandoff, status: 'requires_review' } } : {};
}

async function cancelRun(runId: string, store: RunStore, bus: RunEventBus): Promise<LiveRunReceipt> {
  const now = new Date().toISOString();
  await store.update(runId, { status: 'cancelled', updatedAt: now });
  const event = makeEvent({ at: now, source: 'app', type: 'run_cancelled', message: 'Run cancelled before Sui payment approval.' });
  await store.appendEvent(runId, event);
  bus.publish(runId, event);
  return store.require(runId);
}

async function streamEvents(res: ServerResponse, runId: string, store: RunStore, bus: RunEventBus): Promise<void> {
  const receipt = await store.get(runId);
  if (!receipt) {
    sendJson(res, 404, { error: 'Run not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  for (const event of receipt.events) {
    res.write(formatSseEvent(event));
  }

  const unsubscribe = bus.subscribe(runId, (event) => {
    res.write(formatSseEvent(event));
  });

  res.on('close', unsubscribe);
}

function validateCreateRun(body: CreateRunRequest, config: TenderBoardConfig): void {
  if (!body || typeof body !== 'object') throw httpError(400, 'Invalid JSON body.');
  if (!body.title || !body.title.trim()) throw httpError(400, 'Task title is required.');
  if (!body.instructions || !body.instructions.trim()) throw httpError(400, 'Task instructions are required.');
  if (!body.maxPayment || body.maxPayment.currency !== 'SUI') throw httpError(400, 'Max payment must be in SUI.');
  if (body.checkerPack && !['research', 'code', 'commerce'].includes(body.checkerPack)) {
    throw httpError(400, 'Checker pack must be research, code, or commerce.');
  }
  if (body.requestedDataLabel && !['public', 'buyer_private', 'secret'].includes(body.requestedDataLabel)) {
    throw httpError(400, 'Requested data label must be public, buyer_private, or secret.');
  }
  if (body.acceptanceCriteria && !Array.isArray(body.acceptanceCriteria)) {
    throw httpError(400, 'Acceptance criteria must be an array of strings.');
  }
  if (body.acceptanceCriteria?.some((criterion) => typeof criterion !== 'string')) {
    throw httpError(400, 'Acceptance criteria must be strings.');
  }

  const amount = Number(body.maxPayment.amount);
  const cap = Number(config.maxPaymentSui);
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Max payment amount is invalid.');
  if (amount > cap) throw httpError(400, `Max payment exceeds configured cap of ${config.maxPaymentSui} SUI.`);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text || '{}') as T;
}

async function sendStatic(res: ServerResponse, fileName: string): Promise<void> {
  const filePath = path.join(clientDir, fileName);
  const body = await readFile(filePath);
  res.writeHead(200, { 'Content-Type': contentType(fileName) });
  res.end(body);
}

function contentType(fileName: string): string {
  if (fileName.endsWith('.html')) return 'text/html; charset=utf-8';
  if (fileName.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (fileName.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function sendReceiptJson(res: ServerResponse, receipt: LiveRunReceipt): void {
  const fileName = `${receipt.runId}.json`;
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`,
  });
  res.end(`${JSON.stringify(receipt, null, 2)}\n`);
}

function sendWorkerTaskJson(
  res: ServerResponse,
  receipt: LiveRunReceipt,
  options: { paymentResponse?: ReturnType<typeof buildX402SuiPaymentResponse> } = {},
): void {
  const paymentResponse = options.paymentResponse ?? buildX402SuiPaymentResponse(receipt);
  sendJson(
    res,
    200,
    {
      runId: receipt.runId,
      status: receipt.status,
      sanitizedTask: receipt.sanitizedTask,
      privacy: receipt.privacy,
      hirerAgent: receipt.hirerAgent,
      workerAgent: receipt.workerAgent,
      agentHandoff: receipt.agentHandoff,
      trustDecision: receipt.trustDecision,
      verificationManifest: receipt.verificationManifest,
      paymentIntentPlan: receipt.paymentIntentPlan,
      receiptPlan: receipt.receiptPlan,
      reputationSnapshot: receipt.reputationSnapshot,
    },
    paymentResponse
      ? {
          'X-Payment-Protocol': 'x402',
          'X-Payment-Response': JSON.stringify(paymentResponse),
        }
      : { 'X-Payment-Protocol': 'x402' },
  );
}

function sendJson(res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  const error = isHttpError(value) ? value.message : undefined;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(error ? { error } : value));
}

function httpError(status: number, message: string): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function isHttpError(value: unknown): value is Error & { status: number } {
  return value instanceof Error && typeof (value as Error & { status?: unknown }).status === 'number';
}

function nonBlank(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') return undefined;
  return value.trim();
}

function sameAddress(left: string | undefined, right: string): boolean {
  return typeof left === 'string' && left.toLowerCase() === right.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function executeAutomaticSuiAnchor(receipt: LiveRunReceipt, config: TenderBoardConfig): Promise<Awaited<ReturnType<typeof executeSuiAnchorReceipt>>> {
  try {
    return await executeSuiAnchorReceipt(receipt, config);
  } catch (error) {
    throw httpError(502, `Automatic Sui anchoring failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function executeAutomaticSuiPayment(receipt: LiveRunReceipt, config: TenderBoardConfig): Promise<Awaited<ReturnType<typeof executeSuiX402Payment>>> {
  try {
    return await executeSuiX402Payment(receipt, config);
  } catch (error) {
    throw httpError(502, `Automatic Sui payment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assessStakeChallengeOrThrow(receipt: LiveRunReceipt, body: StakeChallengeRequest) {
  try {
    return await assessStakeChallenge(receipt, body);
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : String(error));
  }
}

export function startTenderBoardServer(): void {
  loadDotEnvFile();
  const config = loadTenderBoardConfig();
  const server = createTenderBoardServer({ config });
  server.listen(config.port, () => {
    console.log(`WalrusProof server running at http://127.0.0.1:${config.port}`);
    console.log(`Mode: ${config.mode}`);
  });
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === entrypointPath) {
  startTenderBoardServer();
}
