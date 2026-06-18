# TenderBoard Implementation Log

## 2026-06-18 — Slice 1: RFP privacy sanitizer

Implemented the first core safety boundary: `sanitizeRfp(rfp)` creates provider-agent bid packets containing only `PUBLIC` RFP fields. Tests verify that `PRIVATE_AFTER_AWARD`, `LOCAL_ONLY`, and `NEVER_SHARE` values never appear in the serialized bid packet, private context is exposed only as a boolean, forbidden-data notice is present, and returned arrays/objects are defensive copies.

Verification:

```text
npm test        # 5 tests passed
npm run typecheck # passed
```

Issue logged:

- `TB-ISSUE-001`: npm audit reports one low-severity vulnerability; deferred fixing until dependency impact is inspected.

## 2026-06-18 — Slice 2: Bid policy engine

Implemented the pure bid policy engine: `evaluateBid(rfp, bid)`. It blocks bids targeting the wrong RFP, bids over max budget, bids requesting `LOCAL_ONLY`/`NEVER_SHARE`, bids asking for obvious secrets, and bids attempting off-platform coordination. It warns when offered deliverables do not overlap requested outputs.

Verification:

```text
npm test          # 12 tests passed
npm run typecheck # passed
```

## 2026-06-18 — Smart contract constraint

Recorded implementation constraint: TenderBoard MVP must not introduce custom smart contracts. If a later phase needs contracts, use CROO's existing rails or established audited primitives/libraries such as OpenZeppelin rather than writing unaudited contracts.

## 2026-06-18 — Slice 3: Mock provider agents and bid collection

Implemented deterministic mock provider agents and `collectBids(packet, providers)`. The seeded provider set produces three safe bids, one over-budget bid, and one malicious bid requesting forbidden data. Tests verify each provider returns one bid, private RFP field values are not available to providers through the sanitized bid packet, and policy evaluation classifies the bids as expected.

Verification:

```text
npm test          # 15 tests passed
npm run typecheck # passed
```

## 2026-06-18 — Slice 4: Award flow

Implemented `awardBid(rfp, bid, evaluation)`. Only eligible bids become `pending_order` awards by default. Blocked bids cannot be awarded. Warned bids require explicit `allowWarn=true`. The function also refuses mismatched RFPs and evaluations for the wrong bid.

Verification:

```text
npm test          # 21 tests passed
npm run typecheck # passed
```

## 2026-06-18 — Slice 5: Mock CROO order lifecycle

Implemented `OrderAdapter` and `MockCrooAdapter`. Awarded bids can now become completed mock orders with CROO-shaped event timelines: `NegotiationCreated → OrderCreated → OrderPaid → OrderCompleted`. Events are stored in-memory and queryable by order id.

Verification:

```text
npm test          # 24 tests passed
npm run typecheck # passed
```

## 2026-06-18 — Slice 6: Full launch-kit demo workflow

Implemented `runLaunchKitDemo()`, tying together RFP creation, sanitization, mock provider bidding, bid evaluation, eligible-bid awards, and mock CROO order creation. The deterministic workflow produces 5 bids, 3 eligible awards/orders, and blocks the overpriced and malicious agents.

Verification:

```text
npm test          # 27 tests passed
npm run typecheck # passed
```

## 2026-06-18 — Slice 7: Launch-kit output assembler

Implemented `assembleLaunchKit(result)` to render a markdown launch kit from the full demo workflow. The output includes project pitch, RFP summary, bid counts, awarded providers, blocked providers with explicit reasons, mock order ids, and demo script beats. Tests verify the expected content and that buyer-only RFP secrets do not leak into the generated launch kit.

Verification:

```text
npm test          # 30 tests passed
npm run typecheck # passed
```

## 2026-06-18 — Slice 8: CLI demo and safe public export

Implemented `npm run demo`, which runs the launch-kit workflow and writes `outputs/launch-kit.md` plus `outputs/demo-result.json`. During verification, found that the initial JSON export leaked internal buyer-only RFP secrets. Root cause: the CLI wrote the internal workflow result directly. Fixed by adding `createPublicDemoExport(result)` so JSON output contains only the sanitized bid packet, bids, evaluations, awards, orders, and summary. Added regression tests for export redaction.

Verification:

```text
npm test          # 32 tests passed
npm run typecheck # passed
npm run demo      # generated outputs/launch-kit.md and outputs/demo-result.json
grep leak check   # no buyer-only secrets found in generated output files
```

## 2026-06-18 — Slice 9: README, CROO SDK skeleton, and audit cleanup

Implemented `.env.example`, README, and guarded `CrooSdkAdapter`. CROO mode is opt-in and fails closed if env vars or SDK are missing. The adapter maps awards to the documented CROO flow: `negotiateOrder → payOrder → getDelivery`. Added tests for missing-env failure and injected SDK call mapping.

Also resolved the npm audit issue. `npm audit fix` did not fix the low-severity esbuild advisory because the vulnerable dependency came through `vitest@3 → vite@7.3.5 → esbuild@0.27.7`. Upgraded Vitest to `4.1.9`, which removed the vulnerable dependency chain.

Verification:

```text
npm test                  # 36 tests passed
npm run typecheck         # passed
npm run demo              # generated outputs successfully
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
```

## 2026-06-18 — Slice 10: Static demo dashboard

Implemented `renderDashboardHtml(result)` and wired the CLI to generate `outputs/dashboard.html`. The static dashboard shows sanitized RFP summary, bid metrics, bid board decisions, blocked reasons, and awarded mock CROO orders. Added tests for dashboard content and redaction of buyer-only secret values.

Verification:

```text
npm test                  # 38 tests passed
npm run typecheck         # passed
npm run demo              # generated launch-kit.md, demo-result.json, dashboard.html
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
```

## 2026-06-18 — Slice 11: Provider-specific deliveries

Replaced generic mock delivery text with provider-specific deterministic content for PitchWriter, ReadmeAgent, and DemoScriptAgent. The launch-kit output now contains useful pitch, README outline, and demo script material generated by the awarded provider agents.

Verification:

```text
npm test                  # 41 tests passed
npm run typecheck         # passed
npm run demo              # generated updated outputs
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
```

## 2026-06-18 — Slice 12: Demo walkthrough artifacts

Implemented markdown and HTML demo walkthrough outputs. The walkthrough guides the presenter through pitch, privacy-labeled RFP, sanitized bid packet, five provider bids, blocked unsafe bids, safe awards, CROO-style mock orders, and final artifacts. CLI now generates `outputs/demo-walkthrough.md` and `outputs/demo-walkthrough.html` in addition to the dashboard, launch kit, and JSON.

Verification:

```text
npm test                  # 44 tests passed
npm run typecheck         # passed
npm run demo              # generated all five outputs
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
local server smoke test    # demo-walkthrough.html served successfully
```

## 2026-06-18 — Slice 13: Guided interactive frontend

Implemented `renderGuidedAppHtml(result)` and updated the CLI to generate `outputs/app.html`. This is the actual presenter-facing frontend: a step-by-step flow with left navigation, next/back controls, visual RFP privacy labels, bid cards, blocked attacker/overpriced bidder scene, safe awards, CROO-style order lifecycle, and links to final artifacts.

During implementation, two issues were found and fixed: nested template literals caused TypeScript/esbuild parse failures, and `exactOptionalPropertyTypes` rejected explicit `undefined` for an optional property. Both root causes were fixed and logged in `ISSUES.md`.

Verification:

```text
npm test                  # 47 tests passed
npm run typecheck         # passed
npm run demo              # generated app.html plus all prior outputs
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
local server smoke test    # app.html served successfully
```

## 2026-06-18 — Slice 14: Simplified one-page frontend

Replaced the click-heavy guided frontend with a plain-language one-page app. The new `outputs/app.html` shows the whole product flow in one scroll: write job, hide private info, agents bid, block bad bids, hire safe agents, and show resulting orders. Removed the guided app generator/tests and added simple app tests.

Verification:

```text
npm test                  # 47 tests passed
npm run typecheck         # passed
npm run demo              # generated simple app.html
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
local server smoke test    # app.html served successfully and contains no Next button flow
```

## 2026-06-18 — Slice 15: Real clickable demo app

Reworked the one-page frontend from static HTML into a small working browser app. The new `outputs/app.html` has live controls: `Start demo`, `Create request`, `Get offers`, `Hire this agent`, and `Reset`. It keeps the simple one-page layout, but now users can actually move the product flow forward and see hired agents/orders update on the page.

Verification:

```text
npm test                  # 48 tests passed
npm run typecheck         # passed
npm run demo              # regenerated interactive app.html
npm audit --audit-level=low # found 0 vulnerabilities
grep leak check           # no buyer-only secrets found in generated output files
local server smoke test    # app.html served and contains clickable controls/listeners
```

## 2026-06-18 — Slice 16: Product server, API-backed UI, live receipts

Started the real product conversion from generated HTML artifacts to a local web app backed by APIs. Added a Node HTTP server, safe config endpoint, browser UI under `src/client`, run receipt storage under `data/runs`, a run event bus/SSE formatter, task sanitization for worker-facing text, mock/dry-run payment approval, and tests for config safety, receipts, server routes, private-note exclusion, and refusal to fake live payment.

Also fixed a Windows/tsx entrypoint bug where `npm start` loaded the server file but never called `listen()`.

Verification:

```text
npm test                  # 56 tests passed
npm run typecheck         # passed
npm run demo              # existing generated artifacts still work
npm audit --audit-level=low # found 0 vulnerabilities
server smoke test          # http://127.0.0.1:4174 served UI, created run, approved mock payment, wrote secret-free receipt
```

## 2026-06-18 — Slice 17: Real CROO SDK runtime path

Installed `@croo-network/sdk@0.2.1` and implemented the live CROO runtime in `src/live/crooRuntime.ts`. The runtime uses two SDK clients: requester/task-giver and worker/provider. It connects CROO websockets, starts a real negotiation, lets the worker accept TenderBoard tasks, waits for a CROO order id, requires app payment approval, calls `payOrder`, records the returned tx hash, delivers after `OrderPaid`, and fetches delivery after `OrderCompleted`.

Added `tests/crooRuntime.test.ts`, an SDK-stub integration test that exercises the full CROO lifecycle shape without spending money: `negotiateOrder → NegotiationCreated → acceptNegotiation → OrderCreated → approve → payOrder → OrderPaid → deliverOrder → OrderCompleted → getDelivery`. The test verifies no mock tx hash is used and private notes are not stored.

A real receipt-store race was found during this test: concurrent event handlers could corrupt receipt JSON. Fixed by serializing `RunStore` mutations.

Verification:

```text
npm test                  # 57 tests passed
npm run typecheck         # passed
npm run demo              # existing static artifacts still work
npm audit --audit-level=low # found 0 vulnerabilities
server smoke test          # mock product path still serves UI, creates run, approves payment, and keeps receipt secret-free
```

Live payment has not been executed yet because credentials, funded requester AA wallet, worker service id, and explicit payment approval are still required.

## 2026-06-18 — Slice 18: Local `.env` loading for live credentials

Added `src/live/dotenv.ts` and wired it into the product server entrypoint so `npm start` loads local `.env` values without exposing them through API responses or tests. The loader does not override existing shell environment variables. Added `tests/dotenv.test.ts`.

Verification:

```text
npm test                  # 58 tests passed
npm run typecheck         # passed
npm run demo              # passed
npm audit --audit-level=low # found 0 vulnerabilities
```

## 2026-06-18 — Slice 19: Standalone worker agent option

Added `src/agents/workerAgent.ts` and `npm run worker` so the worker/provider can run as a separate live process instead of only being embedded in the product server. Added `TENDERBOARD_EMBED_WORKER=true|false`; embedded mode is still available for one-process demos, while external mode lets the server run the requester/task-giver and a separate terminal run the worker/provider.

Verification:

```text
npm test                  # 58 tests passed
npm run typecheck         # passed
npm run demo              # passed
server smoke test          # passed
npm audit --audit-level=low # found 0 vulnerabilities
```

## 2026-06-18 — Slice 20: Live preflight and no-credential live smoke

Added `npm run live:preflight`, `npm run live:start`, and `npm run live:worker`. The live scripts are Windows-safe and do not rely on shell `VAR=value` syntax. `live:preflight` loads `.env`, defaults to live mode, verifies required CROO settings, checks SDK import, and when credentials exist will query CROO orders/negotiations without sending payment. Also smoke-tested `live:start` with no credentials; it starts in live mode and reports missing CROO setup through `/api/config` instead of silently falling back to mock.

Verification:

```text
npm run live:preflight     # fails safely because .env/credentials are absent
npm run live:start smoke   # mode=live, readyForLive=false, missing settings reported
npm test                   # 58 tests passed
npm run typecheck          # passed
npm audit --audit-level=low # found 0 vulnerabilities
```

No live `payOrder` was executed. The machine currently has no `.env`, no requester SDK key, no worker SDK key, and no worker service id configured.

## 2026-06-18 — Slice 21: Run history, receipt downloads, and dry-run honesty

Added run history and receipt inspection to the product app. The server now supports `GET /api/runs` for receipt summaries and `GET /api/runs/:runId/receipt` for downloadable JSON proof. The browser UI now lists previous runs, lets the user reopen a run, reattaches the live event stream, and links directly to the receipt JSON.

Also tightened dry-run behavior: dry-run no longer creates a fake transaction hash. Mock mode can still use an obvious `mock_tx_...`; dry-run records `payment_skipped_dry_run` and leaves `paymentTxHash` empty.

Verification:

```text
npm test                  # 61 tests passed
npm run typecheck         # passed
npm run demo              # passed
npm audit --audit-level=low # found 0 vulnerabilities
server smoke test          # UI served, run created/approved, history listed it, receipt downloaded, private notes absent
```

## 2026-06-18 — Slice 22: Real Opportunity Scout worker

Changed the worker from canned output to real outside-world work. Added `src/agents/opportunityScout.ts`, which extracts a query from the paid task, searches public Hacker News and GitHub APIs, deduplicates results, and renders a link-backed report. Wired both embedded live worker delivery and standalone `npm run worker` delivery to use the scout. Mock/dry-run approval also uses the scout so the product can demonstrate real retrieval without CROO credentials.

Verification:

```text
npm test                  # 63 tests passed
npm run typecheck         # passed
npm run demo              # passed
npm audit --audit-level=low # found 0 vulnerabilities
```

## 2026-06-18 — Slice 23: Submission docs and proof exporter

Added hackathon-facing docs and proof export tooling. Root `README.md` explains TenderBoard, live setup, and run commands. `SUBMISSION.md` contains DoraHacks submission copy. `DEMO_VIDEO_SCRIPT.md` contains a 2–3 minute video script. Added `src/live/proof.ts` and `src/cli/exportProof.ts` with `npm run proof:latest` to turn the latest receipt JSON into a judge-readable markdown proof file under `proof/`.

Verification:

```text
npm test                  # 64 tests passed
npm run typecheck         # passed
npm run demo              # passed
npm audit --audit-level=low # found 0 vulnerabilities
```
