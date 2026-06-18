# Milestones: TenderBoard Live Agent Commerce

Free-form implementation log for the hackathon project.

### 2026-06-18 14:54:27 - Milestone

Created the TenderBoard Live Agent Commerce spec to pivot from generated demo artifacts to a real product: web app, task-giver agent, worker agent, real CROO SDK lifecycle, explicit payment approval, tx hash receipt, live event feed, and receipt storage. Added research report verifying `@croo-network/sdk@0.2.1`, `AgentClient`, CROO websocket events, `negotiateOrder`, `acceptNegotiation`, `payOrder`, `deliverOrder`, `getDelivery`, Base default RPC, SDK-key auth, and the requirement to fund the requester agent AA wallet before payments. Product and tech specs now define mock/dry-run/live modes, two-agent architecture, payment safety rules, required credentials, implementation phases, and validation needed for a real payment run.

### 2026-06-18 15:09:36 - Milestone

Implemented Phase 1–3 of the product conversion: Node HTTP product server, safe `/api/config`, `POST /api/runs`, receipt retrieval, payment approval/cancel endpoints, Server-Sent Event formatting/event bus, browser UI in `src/client`, worker-facing task sanitization, receipt store under `data/runs`, and tests for config safety, secret exclusion, server behavior, and refusal to fake live payments. Fixed a Windows/tsx entrypoint bug discovered during smoke testing. Verification passed: `npm test` (56 tests), `npm run typecheck`, `npm run demo`, `npm audit --audit-level=low`, and local product smoke test at `http://127.0.0.1:4174`.

### 2026-06-18 15:25:45 - Milestone

Implemented the real CROO SDK runtime path. Installed `@croo-network/sdk@0.2.1` and added `src/live/crooRuntime.ts`, which uses separate requester/task-giver and worker/provider `AgentClient` instances, connects CROO websockets, creates negotiations, accepts TenderBoard worker tasks, waits for order creation, requires payment approval, calls real `payOrder`, records the returned tx hash, delivers after `OrderPaid`, and fetches delivery after `OrderCompleted`. Added SDK-stub integration coverage for the full lifecycle shape without spending funds. Found and fixed a receipt-store race by serializing `RunStore` mutations. Verification passed: `npm test` (57 tests), `npm run typecheck`, `npm run demo`, `npm audit --audit-level=low`, and mock server smoke test. Live payment has not been executed yet because credentials/funded AA wallet/service id and explicit payment approval are still needed.

### 2026-06-18 15:26:51 - Milestone

Added local `.env` loading for the product server entrypoint so live CROO credentials can be placed in `.env` and loaded by `npm start` without adding another dependency. The loader does not override existing shell environment variables. Added `tests/dotenv.test.ts`. Verification passed: `npm test` (58 tests), `npm run typecheck`, `npm run demo`, and `npm audit --audit-level=low`.

### 2026-06-18 15:29:28 - Milestone

Added a standalone worker-agent option. `src/agents/workerAgent.ts` can run via `npm run worker` with the worker SDK key, listen for CROO `NegotiationCreated`, reject non-TenderBoard or unsafe tasks, accept valid negotiations, wait for `OrderPaid`, and call `deliverOrder`. Added `TENDERBOARD_EMBED_WORKER=true|false` so live demos can either run requester+worker in one server process or run the worker in a separate terminal. Verification passed: `npm test` (58 tests), `npm run typecheck`, `npm run demo`, server smoke test, and `npm audit --audit-level=low`.

### 2026-06-18 15:33:50 - Milestone

Added live operational commands and preflight. `npm run live:preflight` loads `.env`, defaults to live mode, verifies required CROO settings, and will query CROO requester orders / worker negotiations when credentials exist without sending payment. Added Windows-safe `npm run live:start` and `npm run live:worker` wrappers. Smoke-tested live server startup with no credentials: `/api/config` reports `mode=live`, `readyForLive=false`, and missing CROO settings instead of falling back to mock. Verification passed: `npm test` (58 tests), `npm run typecheck`, and `npm audit --audit-level=low`. No live payment was executed because this machine has no `.env` or CROO credentials configured.

### 2026-06-18 15:44:22 - Milestone

Implemented run history and receipt download support. Added `GET /api/runs` for receipt summaries and `GET /api/runs/:runId/receipt` for downloadable JSON proof. Updated the browser UI to list previous runs, reopen a run, reattach the event stream, and link to receipt JSON. Also fixed dry-run honesty: dry-run no longer creates a fake tx hash; it records `payment_skipped_dry_run` and leaves `paymentTxHash` empty. Verification passed: `npm test` (61 tests), `npm run typecheck`, `npm run demo`, `npm audit --audit-level=low`, and server smoke test with secret-free receipt download.

### 2026-06-18 15:56:13 - Milestone

Implemented a real Opportunity Scout worker so paid tasks produce outside-world results instead of canned text. Added `src/agents/opportunityScout.ts` to extract a query from the safe task, search public Hacker News and GitHub APIs, deduplicate results, and render a link-backed report. Wired embedded live worker delivery, standalone `npm run worker`, and mock/dry-run approval to use the scout. Verification passed: `npm test` (63 tests), `npm run typecheck`, `npm run demo`, and `npm audit --audit-level=low`.
