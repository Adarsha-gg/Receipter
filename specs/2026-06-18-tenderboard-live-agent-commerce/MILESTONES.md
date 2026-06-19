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

### 2026-06-18 16:49:00 - Milestone

Added submission-facing docs and proof export tooling. Root `README.md` now explains the project, live setup, and commands. Added `SUBMISSION.md` for DoraHacks copy and `DEMO_VIDEO_SCRIPT.md` for a 2–3 minute demo video. Added `src/live/proof.ts`, `src/cli/exportProof.ts`, and `npm run proof:latest` to convert the latest receipt JSON into a judge-readable markdown proof. Verification passed: `npm test` (64 tests), `npm run typecheck`, `npm run demo`, and `npm audit --audit-level=low`.

### 2026-06-18 17:18:00 - Milestone

Removed obsolete prototype/demo code from the `work/tenderboard-submission-polish` worktree. Deleted the old static demo output pipeline, first-pass RFP/bid prototype, old mock/CROO adapter skeletons, and their tests. Kept the real product server, browser UI, live CROO runtime, standalone worker, Opportunity Scout, receipt store, proof exporter, and secret-pattern policy. Reduced tracked source/doc footprint from 8,474 lines across 79 files to 6,697 lines across 52 files. Verification passed in the cleanup worktree: `npm test` (7 files, 16 tests), `npm run typecheck`, `npm audit --audit-level=low`, and product server smoke test with Opportunity Scout delivery and no private-note leak.

### 2026-06-18 18:44:00 - Milestone

Repositioned TenderBoard as a TrustMCP-inspired and CTRL+Z-style product: a trust-gated work desk for paid agent procurement. Replaced the plain browser demo with an operator-console UI that shows the merged thesis, live mode readiness, payment cap, sanitized worker packet, explicit approval control, execution timeline, receipt panel, run ledger, and product pillars: trust before execution, proof before settlement, and receipts becoming reputation. Updated `tenderboard/README.md` with the combined product story and current field references for MCP, x402, ERC-8004, and CROO, while avoiding claims of direct TrustMCP or ERC-8004 integration. Tightened secret detection to catch env-style assignments like `API_KEY=...`, `OPENAI_API_KEY=...`, and `AUTH_TOKEN=...`; added regression coverage. Verification passed: `npm test` (8 files, 17 tests) and `npm run typecheck`. Local server smoke: static assets and `/api/config` served at `http://127.0.0.1:4174`; an older node process on that port could not be stopped from this sandbox, so the policy runtime refresh was verified through tests rather than the existing process.

### 2026-06-18 18:53:00 - Milestone

Made the TrustMCP-inspired / CTRL+Z-style merge concrete in receipts and runtime behavior, not only positioning. Added `src/live/trustProof.ts` to produce a deterministic TrustMCP-style trust decision with worker id, score, tier, verdict, reasons, controls, and risk-based price multiplier, plus a CTRL+Z-style verification manifest with spec hash, acceptance criteria, checks, settlement rule, reputation write-back note, and final evidence hash. Wired the trust/proof data into run creation, mock/dry-run delivery, live CROO completion, receipt JSON, proof markdown export, and the browser UI. Added trust/proof panels to the app for score, verdict, controls, spec hash, evidence hash, and check statuses. Fixed a sanitizer interaction where the worker packet's safety notice used secret-pattern words and caused the trust gate to reject safe tasks. Verification passed: `npm test` (9 files, 19 tests), `npm run typecheck`, and isolated runtime smoke on port 4180 showing `trustVerdict=allow`, `trustScore=92`, a `sha256:` spec hash, and no private note in the worker packet.

### 2026-06-18 19:48:00 - Milestone

Improved the product from a safe task runner into a verifiable work-contract console. Added buyer-defined acceptance criteria and checker packs (`research`, `code`, `commerce`) to the create-run API, sanitized worker packet, deterministic verification manifest, receipt JSON, proof markdown export, and browser UI. The research pack adds public-source evidence checks, the code pack adds test-result and patch-schema checks, and the commerce pack adds price-bound and merchant/source checks. Criteria are filtered through the same secret-line sanitizer before they are sent to a worker, while the manifest anchors the full verification contract with the spec hash. Verification passed: `npm test` (9 files, 19 tests), `npm run typecheck`, and isolated runtime smoke on port 4181 showing `checkerPack=research`, anchored criteria, `public_sources` check present, criteria visible in the safe worker packet, and the private note absent from the worker packet.
