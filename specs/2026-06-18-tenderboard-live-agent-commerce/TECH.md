# Tech Spec: TenderBoard Live Agent Commerce

Product spec: `specs/2026-06-18-tenderboard-live-agent-commerce/PRODUCT.md`

Research used: `specs/2026-06-18-tenderboard-live-agent-commerce/research/2026-06-18-product-croo-real-payment-integration.md`

## Context

Current project root:

```text
C:/Users/adars/Coding/hackathon/tenderboard
```

Current implementation is now a TypeScript product app with a local API server, browser UI, live/dry-run/mock modes, receipt storage, proof export, a CROO SDK runtime path, and an Opportunity Scout worker.

Relevant current files:

- `package.json` — scripts include `test`, `typecheck`, `start`, `worker`, `live:preflight`, `live:start`, `live:worker`, and `proof:latest`.
- `src/server/httpServer.ts` — product API server and static UI server.
- `src/client/` — browser UI for task creation, safe preview, timeline, receipts, and run history.
- `src/live/crooRuntime.ts` — live CROO requester/worker runtime using `@croo-network/sdk`.
- `src/live/runStore.ts` — receipt persistence and run history.
- `src/live/proof.ts` — receipt-to-markdown proof renderer.
- `src/live/sanitizeTask.ts` — worker-facing task sanitization.
- `src/policy/secretPatterns.ts` — forbidden secret/data pattern detection.
- `src/agents/workerAgent.ts` — standalone worker process.
- `src/agents/opportunityScout.ts` — real public-source worker task using Hacker News and GitHub APIs.

CROO SDK facts from research:

- package: `@croo-network/sdk@0.2.1`
- runtime client: `AgentClient`
- events: `EventType.NegotiationCreated`, `EventType.OrderCreated`, `EventType.OrderPaid`, `EventType.OrderCompleted`, plus rejection/expiration events
- requester methods: `negotiateOrder`, `payOrder`, `getDelivery`
- provider methods: `acceptNegotiation`, `rejectNegotiation`, `deliverOrder`
- config: `CROO_API_URL`, `CROO_WS_URL`, `CROO_SDK_KEY`, `CROO_TARGET_SERVICE_ID`, optional `BASE_RPC_URL`
- payment proof: README example shows `payOrder` returning `txHash`
- funding: requester agent AA wallet must be funded in CROO Dashboard

## Target architecture

TenderBoard Live should be a local web product with three running pieces:

```text
Browser UI
   │
   │ HTTP + Server-Sent Events
   ▼
TenderBoard server
   │
   ├── Task-giver agent process/client
   │       ├── negotiateOrder
   │       ├── payOrder after approval
   │       └── getDelivery
   │
   ├── Worker agent process/client
   │       ├── accepts safe negotiations
   │       └── delivers after payment
   │
   └── Receipt store
           └── data/runs/<run-id>.json
```

Use Server-Sent Events first, not a complex frontend framework. It is enough for live status and keeps the build small.

## Runtime modes

### `mock`

- Used for automated tests and offline development.
- Uses existing `MockCrooAdapter` behavior.
- Does not call CROO.
- Must be visually marked as mock.

### `dry-run`

- Connects as much of the app path as possible but does not call `payOrder`.
- Used to check UI, config, and task creation without spending funds.
- Must be visually marked as dry-run.

### `live`

- Uses real `@croo-network/sdk` and CROO endpoints.
- Starts requester/task-giver and worker SDK clients.
- Requires explicit payment approval before calling `payOrder`.
- Writes receipt with tx hash and delivery.
- Must never silently fall back to mock mode.

## Environment configuration

Add `.env.example` fields:

```bash
TENDERBOARD_MODE=mock # mock | dry-run | live
TENDERBOARD_PORT=4174
TENDERBOARD_MAX_PAYMENT_USDC=0.25
TENDERBOARD_RECEIPTS_DIR=data/runs

CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
BASE_RPC_URL=https://mainnet.base.org

# requester/task-giver agent
CROO_REQUESTER_SDK_KEY=croo_sk_...

# worker/provider agent
CROO_WORKER_SDK_KEY=croo_sk_...
CROO_WORKER_SERVICE_ID=...
```

Do not reuse one generic `CROO_SDK_KEY` for both agents in live mode. The product needs two roles.

## Proposed files

### Product server

```text
src/server/httpServer.ts
src/server/routes.ts
src/server/sse.ts
src/server/staticClient.ts
```

Responsibilities:

- serve the app UI
- expose task creation API
- expose payment approval API
- expose receipt API
- stream live events to browser with SSE
- never expose SDK keys

Initial scripts:

```json
{
  "start": "tsx src/server/httpServer.ts",
  "live:worker": "tsx src/agents/workerAgent.ts",
  "live:giver": "tsx src/agents/taskGiverAgent.ts",
  "live:all": "tsx src/server/httpServer.ts"
}
```

`live:all` can run both agent clients inside one Node process for hackathon simplicity. Separate scripts remain useful for proving the two-agent design.

### Browser app

```text
src/client/index.html
src/client/app.js
src/client/styles.css
```

This replaces generated `outputs/app.html` as the primary product UI.

Required UI states:

- mode/config health
- task form
- sanitized preview
- send task button
- live timeline
- payment approval panel
- receipt/result panel
- error panel

### Live run model

```text
src/live/types.ts
src/live/runStore.ts
src/live/eventBus.ts
```

Core types:

```ts
type TenderBoardMode = 'mock' | 'dry-run' | 'live';

type LiveRunStatus =
  | 'draft'
  | 'sanitized'
  | 'negotiating'
  | 'accepted'
  | 'awaiting_payment_approval'
  | 'paying'
  | 'paid'
  | 'working'
  | 'delivered'
  | 'failed'
  | 'cancelled';

interface LiveRunReceipt {
  runId: string;
  mode: TenderBoardMode;
  status: LiveRunStatus;
  createdAt: string;
  updatedAt: string;
  taskTitle: string;
  sanitizedTask: string;
  maxPayment: { amount: string; currency: 'USDC' };
  crooServiceId?: string;
  negotiationId?: string;
  orderId?: string;
  paymentTxHash?: string;
  deliveryText?: string;
  events: Array<{
    at: string;
    source: 'app' | 'task-giver' | 'worker' | 'croo';
    type: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  error?: string;
}
```

`runStore` writes JSON receipts under `data/runs`. Use atomic write: write temp file, then rename.

### Config loader

```text
src/live/config.ts
```

Responsibilities:

- read env vars
- validate mode
- validate live requirements
- parse max payment cap
- expose safe config to UI without secrets

Live mode required fields:

- `CROO_API_URL`
- `CROO_WS_URL`
- `CROO_REQUESTER_SDK_KEY`
- `CROO_WORKER_SDK_KEY`
- `CROO_WORKER_SERVICE_ID`
- `TENDERBOARD_MAX_PAYMENT_USDC`

### CROO clients

```text
src/live/crooClientFactory.ts
src/live/crooTypes.ts
src/live/crooErrors.ts
```

Use dynamic import for `@croo-network/sdk` so tests can run without live credentials.

Factory behavior:

```ts
const sdk = await import('@croo-network/sdk');
const client = new sdk.AgentClient({ baseURL, wsURL, rpcURL }, sdkKey);
```

Error handling:

- map `isInsufficientBalance` to a user-facing insufficient-balance error
- map `isUnauthorized` to SDK key/config error
- map `isInvalidStatus` to duplicate/stale lifecycle error
- keep raw error details out of UI if they may contain secrets

### Task-giver agent

```text
src/agents/taskGiverAgent.ts
src/live/taskGiver.ts
```

Responsibilities:

1. Receive a sanitized task from the server.
2. Call `negotiateOrder({ serviceId, requirements })`.
3. Subscribe to CROO websocket events.
4. When order is created, update receipt with order id and status `awaiting_payment_approval`.
5. Wait for server-side payment approval.
6. In live mode, call `payOrder(orderId)`.
7. Save returned `txHash`.
8. Wait for `OrderCompleted`.
9. Call `getDelivery(orderId)`.
10. Save delivery and mark run delivered.

Idempotency rules:

- pay each order id at most once
- if duplicate `OrderCreated` events arrive, do not pay twice
- if process restarts, read receipt before paying
- after unknown payment failure, mark run `failed_payment_unknown` and require manual inspection

### Worker agent

```text
src/agents/workerAgent.ts
src/live/worker.ts
```

Responsibilities:

1. Connect to CROO websocket with worker SDK key.
2. On `NegotiationCreated`, inspect requirements.
3. Reject if task asks for forbidden secrets or exceeds payment cap.
4. Accept safe negotiation using `acceptNegotiation(negotiationId)`.
5. On `OrderPaid`, produce a real answer.
6. Deliver with:

```ts
client.deliverOrder(orderId, {
  deliverableType: DeliverableType.Text,
  deliverableText: JSON.stringify(workerResult),
});
```

Worker result for first product version:

- Generate a concise launch checklist or task answer locally from the task instructions.
- No external AI dependency required for the first live payment proof.
- Optional later: plug in a model provider after live CROO payments work.

Idempotency rules:

- accept each negotiation id at most once
- deliver each order id at most once
- duplicate `OrderPaid` must not create duplicate delivery

### Payment approval API

Server endpoint:

```text
POST /api/runs/:runId/approve-payment
```

Behavior:

- verify run is `awaiting_payment_approval`
- verify order id exists
- verify payment amount is <= cap
- verify mode is live or dry-run
- record approval timestamp
- trigger task-giver payment step

In this pi/agent workflow, outbound payment actions must still be staged for explicit approval before execution. The app button is product approval; implementation/test runs with real funds also need operator confirmation before we execute them from this coding session.

## HTTP API

```text
GET  /                    -> app shell
GET  /api/config          -> safe config health, no secrets
POST /api/runs            -> create run from task form
GET  /api/runs/:runId     -> current receipt/status
GET  /api/runs/:runId/events -> SSE event stream
POST /api/runs/:runId/approve-payment -> approve payment
POST /api/runs/:runId/cancel -> cancel before payment
```

`POST /api/runs` request:

```json
{
  "title": "Write my launch checklist",
  "instructions": "Make a checklist for shipping TenderBoard",
  "privateNotes": "Do not send these notes to worker",
  "maxPayment": { "amount": "0.05", "currency": "USDC" }
}
```

Response:

```json
{
  "runId": "run_...",
  "status": "negotiating",
  "sanitizedTask": "..."
}
```

## Data and privacy

Never write these to receipt or worker task:

- SDK keys
- private notes
- wallet private keys
- seed phrases
- API keys
- `.env` values
- passwords

Receipt can include:

- sanitized task
- public task title
- order id
- negotiation id
- transaction hash
- delivery text
- non-secret errors

## Implementation sequence

### Phase 1 — product server skeleton

- Add HTTP server using Node built-in `http` or a tiny dependency.
- Serve `src/client` files.
- Add `/api/config`.
- Add tests for config health and no secret leakage.

Recommendation: use Node built-in `http` first to avoid dependency churn unless routing becomes painful.

### Phase 2 — run store and SSE

- Add `LiveRunReceipt` types.
- Add JSON receipt store.
- Add SSE event bus.
- Add tests for receipt writes, secret redaction, and event streaming helpers.

### Phase 3 — real product UI

- Build `src/client/index.html`, `app.js`, `styles.css`.
- UI talks to API, not generated output files.
- Add manual smoke test and static assertions for required buttons/states.

### Phase 4 — task-giver agent in mock/dry-run

- Implement `TaskGiver` interface.
- In mock/dry-run, create fake negotiation/order ids but follow same states.
- Require approval before mock/dry-run pay step to keep UI path honest.

### Phase 5 — worker agent in mock/dry-run

- Implement `WorkerAgent` interface.
- Worker accepts allowed tasks and produces real text delivery.
- Add tests for forbidden data rejection and duplicate event handling.

### Phase 6 — install and wire CROO SDK

- Install `@croo-network/sdk@0.2.1`.
- Read package `.d.ts` files to verify exact type names and response shapes.
- Implement `crooClientFactory`.
- Add SDK-stub tests so CI does not require credentials.

### Phase 7 — live CROO mode

- Implement requester `negotiateOrder`, websocket event handling, `payOrder`, `getDelivery`.
- Implement worker `acceptNegotiation`, `deliverOrder`.
- Add idempotency guards.
- Add clear errors for unauthorized, insufficient balance, invalid status, websocket disconnected.

### Phase 8 — first real payment run

Required before executing:

1. CROO Dashboard requester SDK key.
2. CROO Dashboard worker SDK key.
3. Registered worker service id.
4. Requester AA wallet funded with small USDC/payment token amount.
5. Payment cap set to tiny amount.
6. Explicit operator approval to run payment.

Validation artifact:

- receipt JSON with tx hash
- screenshot/video of live UI timeline
- terminal logs for requester and worker agents

## Testing and validation

### Unit tests

Run:

```bash
npm test
npm run typecheck
```

Add/extend tests:

- config validation
- mode detection
- no secret leakage in safe config
- no private notes in sanitized task
- receipt atomic writes
- receipt redaction
- SSE event formatting
- payment cap enforcement
- duplicate event idempotency
- worker rejects forbidden data
- task-giver does not pay without approval
- task-giver pays at most once per order id
- worker delivers at most once per order id

### Integration tests with SDK stub

Use an injected fake SDK client that emits CROO-shaped events:

```text
NegotiationCreated -> acceptNegotiation -> OrderCreated -> approve -> payOrder -> OrderPaid -> deliverOrder -> OrderCompleted -> getDelivery
```

Verify product behavior:

- PRODUCT #6/#7: negotiation id shown/saved
- PRODUCT #10/#11: worker accept creates order id
- PRODUCT #12/#14: no payment before approval, payment after approval
- PRODUCT #15: tx hash saved and shown
- PRODUCT #17/#18: delivery saved and shown
- PRODUCT #21/#22: receipt complete and secret-free

### Live validation

Live validation cannot be faked. It requires credentials and funded agent wallet.

Manual/live checklist:

1. Start worker agent.
2. Start TenderBoard server in live mode.
3. Open UI.
4. Confirm config health is green.
5. Create tiny task.
6. Confirm sanitized preview excludes private notes.
7. Send real task.
8. Observe negotiation id.
9. Observe worker accepting.
10. Observe order id.
11. Approve payment.
12. Observe tx hash.
13. Observe worker delivery.
14. Observe completed receipt.
15. Inspect receipt file for no secrets.

## Risks and mitigations

### Risk: real funds are spent accidentally

Mitigations:

- live mode must be explicit
- hard payment cap
- no auto-payment before approval
- no automatic retry after unknown payment failure
- tiny payment amounts only

### Risk: duplicate websocket events cause duplicate payment or delivery

Mitigations:

- receipt-backed idempotency by order id
- `paidOrderIds` and `deliveredOrderIds` checks
- tests that emit duplicate events

### Risk: CROO credentials or funding are missing

Mitigations:

- `/api/config` reports missing setup plainly
- live mode refuses to start payment path if missing
- no silent fallback to mock

### Risk: SDK response shape differs from README

Mitigations:

- install `@croo-network/sdk@0.2.1`
- inspect TypeScript declarations before implementation
- keep SDK behind `crooClientFactory`
- use SDK-stub tests

### Risk: worker delivers low-value output

Mitigations:

- first worker output is deterministic but useful
- output must be real text based on task instructions
- later add model-backed worker after payment path works

## Definition of done

The spec is implemented when:

1. `npm start` opens a real product UI backed by an API.
2. A task-giver agent and worker agent can run.
3. `mock` and `dry-run` modes pass automated tests.
4. `live` mode uses `@croo-network/sdk`.
5. No payment happens before explicit approval.
6. A live run can produce a receipt with negotiation id, order id, tx hash, and delivery.
7. Receipts and UI do not leak secrets.
8. `npm test`, `npm run typecheck`, and live smoke checklist pass.
