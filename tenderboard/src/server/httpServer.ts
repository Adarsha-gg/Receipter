import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorkerDelivery } from '../live/crooRuntime.js';
import { loadTenderBoardConfig } from '../live/config.js';
import { LiveCrooRuntime } from '../live/crooRuntime.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import { RunEventBus, formatSseEvent } from '../live/eventBus.js';
import { makeEvent, makeRunId, RunStore } from '../live/runStore.js';
import { sanitizeTaskForWorker } from '../live/sanitizeTask.js';
import { buildTrustProof, finalizeVerificationManifest } from '../live/trustProof.js';
import type { CreateRunRequest, LiveRunReceipt, TenderBoardConfig } from '../live/types.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(dirname, '../client');

export interface LiveRuntime {
  startRun(receipt: LiveRunReceipt): Promise<LiveRunReceipt>;
  approvePayment(runId: string): Promise<LiveRunReceipt>;
}

export interface TenderBoardServerOptions {
  config?: TenderBoardConfig;
  store?: RunStore;
  bus?: RunEventBus;
  liveRuntime?: LiveRuntime;
  scoutFetch?: typeof fetch;
}

export function createTenderBoardServer(options: TenderBoardServerOptions = {}) {
  const config = options.config ?? loadTenderBoardConfig();
  const store = options.store ?? new RunStore(config.receiptsDir);
  const bus = options.bus ?? new RunEventBus();
  const liveRuntime = options.liveRuntime ?? new LiveCrooRuntime({ config, store, bus });
  const scoutFetch = options.scoutFetch;

  return createServer(async (req, res) => {
    try {
      await route(req, res, config, store, bus, liveRuntime, scoutFetch);
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
  liveRuntime: LiveRuntime,
  scoutFetch: typeof fetch | undefined,
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';

  if (method === 'GET' && url.pathname === '/') {
    await sendStatic(res, 'index.html');
    return;
  }

  if (method === 'GET' && (url.pathname === '/app.js' || url.pathname === '/styles.css')) {
    await sendStatic(res, url.pathname.slice(1));
    return;
  }

  if (method === 'GET' && url.pathname === '/api/config') {
    sendJson(res, 200, config.safe);
    return;
  }

  if (method === 'GET' && url.pathname === '/api/runs') {
    sendJson(res, 200, await store.list());
    return;
  }

  if (method === 'POST' && url.pathname === '/api/runs') {
    const body = await readJson<CreateRunRequest>(req);
    const response = await createRun(body, config, store, bus, liveRuntime);
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

  const eventsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
  if (method === 'GET' && eventsMatch) {
    await streamEvents(res, eventsMatch[1]!, store, bus);
    return;
  }

  const approveMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/approve-payment$/);
  if (method === 'POST' && approveMatch) {
    const receipt = await approvePayment(approveMatch[1]!, config, store, bus, liveRuntime, scoutFetch);
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
  liveRuntime: LiveRuntime,
): Promise<{ runId: string; status: string; sanitizedTask: string }> {
  validateCreateRun(body, config);

  if (config.mode === 'live' && config.missingLiveSettings.length > 0) {
    throw httpError(400, `Live mode is missing: ${config.missingLiveSettings.join(', ')}`);
  }

  const now = new Date().toISOString();
  const runId = makeRunId();
  const sanitized = sanitizeTaskForWorker(body);
  const trustProof = buildTrustProof({
    request: body,
    sanitizedTask: sanitized.sanitizedTask,
    removedLines: sanitized.removedLines,
    privateNotesProvided: sanitized.privateNotesProvided,
    config,
  });

  if (trustProof.trustDecision.verdict === 'block') {
    throw httpError(400, `Trust gate blocked this task: ${trustProof.trustDecision.reasons.join(' ')}`);
  }

  const receipt: LiveRunReceipt = {
    runId,
    mode: config.mode,
    status: config.mode === 'live' ? 'sanitized' : 'awaiting_payment_approval',
    createdAt: now,
    updatedAt: now,
    taskTitle: body.title,
    sanitizedTask: sanitized.sanitizedTask,
    maxPayment: body.maxPayment,
    trustDecision: trustProof.trustDecision,
    verificationManifest: trustProof.verificationManifest,
    crooServiceId: config.workerServiceId ?? 'mock_worker_service',
    negotiationId: config.mode === 'live' ? undefined : `${config.mode}_neg_${runId}`,
    orderId: config.mode === 'live' ? undefined : `${config.mode}_order_${runId}`,
    paymentTxHash: undefined,
    deliveryText: undefined,
    error: undefined,
    events: [
      makeEvent({ at: now, source: 'app', type: 'run_created', message: 'Task created.' }),
      makeEvent({ at: now, source: 'app', type: 'task_sanitized', message: 'Private notes were not sent to the worker.' }),
      makeEvent({ at: now, source: 'app', type: 'trust_evaluated', message: `Trust gate returned ${trustProof.trustDecision.verdict} at ${trustProof.trustDecision.score}/100.`, data: { score: trustProof.trustDecision.score, tier: trustProof.trustDecision.tier, verdict: trustProof.trustDecision.verdict } }),
      makeEvent({ at: now, source: 'app', type: 'verification_manifest_created', message: 'Verification manifest was anchored for this task.', data: { specHash: trustProof.verificationManifest.specHash } }),
    ],
  };

  if (config.mode !== 'live') {
    receipt.events.push(
      makeEvent({ at: now, source: 'task-giver', type: 'negotiation_created', message: 'Task-giver agent created a negotiation.', data: { negotiationId: `${config.mode}_neg_${runId}` } }),
      makeEvent({ at: now, source: 'worker', type: 'order_created', message: 'Worker accepted the task. Payment approval is required.', data: { orderId: `${config.mode}_order_${runId}` } }),
    );
  }

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

  await store.create(receipt);
  for (const event of receipt.events) bus.publish(runId, event);

  if (config.mode === 'live') {
    const liveReceipt = await liveRuntime.startRun(receipt);
    return { runId, status: liveReceipt.status, sanitizedTask: liveReceipt.sanitizedTask };
  }

  return { runId, status: receipt.status, sanitizedTask: receipt.sanitizedTask };
}

async function approvePayment(
  runId: string,
  config: TenderBoardConfig,
  store: RunStore,
  bus: RunEventBus,
  liveRuntime: LiveRuntime,
  scoutFetch: typeof fetch | undefined,
): Promise<LiveRunReceipt> {
  const receipt = await store.require(runId);
  if (config.mode === 'live') {
    try {
      return await liveRuntime.approvePayment(runId);
    } catch (error) {
      throw httpError(409, error instanceof Error ? error.message : String(error));
    }
  }

  if (receipt.status !== 'awaiting_payment_approval') {
    throw httpError(409, `Run is not waiting for payment approval. Current status: ${receipt.status}`);
  }

  const now = new Date().toISOString();
  const txHash = config.mode === 'mock' ? `mock_tx_${runId}` : undefined;
  const delivery = scoutFetch
    ? await buildWorkerDelivery(receipt, { fetchImpl: scoutFetch })
    : await buildWorkerDelivery(receipt);
  const updated = await store.update(runId, {
    status: 'delivered',
    updatedAt: now,
    paymentTxHash: txHash,
    deliveryText: delivery,
  });

  const paymentEvent = txHash
    ? makeEvent({ at: now, source: 'task-giver', type: 'payment_paid', message: 'Payment completed in mock mode.', data: { txHash } })
    : makeEvent({ at: now, source: 'task-giver', type: 'payment_skipped_dry_run', message: 'Dry-run mode skipped payment. No transaction hash was created.' });
  const events = [
    makeEvent({ at: now, source: 'app', type: 'payment_approved', message: 'Payment was approved for this order.' }),
    paymentEvent,
    makeEvent({ at: now, source: 'worker', type: 'delivery_sent', message: 'Worker delivered the result.' }),
  ];

  for (const event of events) {
    await store.appendEvent(runId, event);
    bus.publish(runId, event);
  }

  const latest = await store.require(runId);
  await store.update(runId, {
    verificationManifest: finalizeVerificationManifest(latest, delivery),
  });

  return store.require(runId);
}

async function cancelRun(runId: string, store: RunStore, bus: RunEventBus): Promise<LiveRunReceipt> {
  const now = new Date().toISOString();
  await store.update(runId, { status: 'cancelled', updatedAt: now });
  const event = makeEvent({ at: now, source: 'app', type: 'run_cancelled', message: 'Run cancelled before payment.' });
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
  if (!body.maxPayment || body.maxPayment.currency !== 'USDC') throw httpError(400, 'Max payment must be in USDC.');
  if (body.checkerPack && !['research', 'code', 'commerce'].includes(body.checkerPack)) {
    throw httpError(400, 'Checker pack must be research, code, or commerce.');
  }
  if (body.acceptanceCriteria && !Array.isArray(body.acceptanceCriteria)) {
    throw httpError(400, 'Acceptance criteria must be an array of strings.');
  }
  if (body.acceptanceCriteria?.some((criterion) => typeof criterion !== 'string')) {
    throw httpError(400, 'Acceptance criteria must be strings.');
  }

  const amount = Number(body.maxPayment.amount);
  const cap = Number(config.maxPaymentUsdc);
  if (!Number.isFinite(amount) || amount <= 0) throw httpError(400, 'Max payment amount is invalid.');
  if (amount > cap) throw httpError(400, `Max payment exceeds configured cap of ${config.maxPaymentUsdc} USDC.`);
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

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const error = isHttpError(value) ? value.message : undefined;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
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

export function startTenderBoardServer(): void {
  loadDotEnvFile();
  const config = loadTenderBoardConfig();
  const server = createTenderBoardServer({ config });
  server.listen(config.port, () => {
    console.log(`TenderBoard product server running at http://127.0.0.1:${config.port}`);
    console.log(`Mode: ${config.mode}`);
  });
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === entrypointPath) {
  startTenderBoardServer();
}
