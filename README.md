# TenderBoard

TenderBoard is a Sui trust-gated work desk for agent commerce.

It lets a buyer or task-giver agent hire a worker agent without leaking private context or paying blindly. The product is inspired by TrustMCP's runtime trust-gating idea and CTRL+Z Verify's proof-before-settlement model, but it does not directly integrate TrustMCP or ERC-8004 registries yet.

For Sui Overflow, TenderBoard now includes a Sui proof rail: completed receipts can be stored on Walrus and anchored to a Sui Move receipt registry. The Move package is in `tenderboard/sui`; the project should not claim deployed Sui anchoring until that package is published and real package/object/blob ids are configured.

## What It Does

1. A buyer writes a paid task, private notes, acceptance criteria, and a checker pack.
2. TenderBoard removes private/secret-looking content before anything reaches the worker.
3. TenderBoard creates a TrustMCP-style trust decision: score, tier, verdict, reasons, controls, and risk multiplier.
4. TenderBoard anchors a CTRL+Z-style verification manifest: spec hash, checker pack, acceptance criteria, required checks, settlement rule, and reputation write-back note.
5. The receipt is prepared for Walrus storage and Sui anchoring.
6. The optional CROO commerce path waits for an order id and explicit operator approval.
7. The worker delivers through CROO.
8. TenderBoard saves a receipt with the safe packet, trust decision, verification manifest, payment tx hash when live, delivery, timeline, and final evidence hash.

The wedge is simple: agents can already discover tools and move money, but buyers still need to know what was sent, whether the worker route was safe, what "done" meant, and why payment was released.

## What Is Implemented

- API-backed browser operator console
- safe worker packet preview
- private-note exclusion
- env-style secret detection
- buyer-defined acceptance criteria
- checker packs: `research`, `code`, `commerce`
- TrustMCP-style trust decision in each receipt
- CTRL+Z-style verification manifest in each receipt
- receipt JSON downloads
- proof markdown export
- Sui Move receipt registry package
- Sui anchor-plan export
- Sui/Walrus readiness checks
- run history
- live mode readiness checks
- CROO SDK runtime path
- requester/task-giver agent
- embedded or standalone worker agent
- real Opportunity Scout worker using Hacker News and GitHub public APIs
- payment approval before `payOrder`
- tests for privacy, receipts, trust/proof logic, live runtime shape, and worker scouting

## Repository Layout

```text
tenderboard/                                      main TypeScript app
tenderboard/sui                                  Sui Move receipt registry package
specs/2026-06-18-tenderboard-agent-rfp            earlier agent RFP spec
specs/2026-06-18-tenderboard-live-agent-commerce  live CROO/product spec
specs/2026-06-19-sui-overflow-tenderboard         Sui Overflow pivot spec
SUBMISSION.md                                     submission copy
DEMO_VIDEO_SCRIPT.md                              demo script
```

## Run Locally

```bash
cd tenderboard
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

## Run Checks

```bash
cd tenderboard
npm test
npm run typecheck
npm run sui:anchor-plan
npm audit --audit-level=low
```

## Sui Overflow Setup

Before claiming deployed Sui integration:

- publish `tenderboard/sui` to Sui testnet or mainnet
- set `SUI_PACKAGE_ID`
- set `SUI_RECEIPT_REGISTRY_ID`
- configure `WALRUS_PUBLISHER_URL` and `WALRUS_AGGREGATOR_URL`
- upload receipt/evidence JSON to Walrus and pass its blob id to `npm run sui:anchor-plan <run-id> <walrus-blob-id>`

## Live CROO Mode

Live blockchain payment requires:

- requester SDK key
- worker SDK key
- worker service id
- funded requester agent AA wallet
- tiny payment cap

Create `tenderboard/.env`:

```env
TENDERBOARD_MODE=live
TENDERBOARD_EMBED_WORKER=true
TENDERBOARD_PORT=4174
TENDERBOARD_MAX_PAYMENT_USDC=0.05
TENDERBOARD_RECEIPTS_DIR=data/runs

CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
BASE_RPC_URL=https://mainnet.base.org

CROO_REQUESTER_SDK_KEY=...
CROO_WORKER_SDK_KEY=...
CROO_WORKER_SERVICE_ID=...
```

Then:

```bash
npm run live:preflight
npm run live:start
```

No live payment is faked. If credentials or funds are missing, the app reports what is missing instead of silently falling back to mock mode.
