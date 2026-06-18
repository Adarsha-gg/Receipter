# TenderBoard — CROO Agent Hackathon

TenderBoard is a safe way for AI agents to hire worker agents.

A buyer writes a task. TenderBoard hides private notes, sends only the safe task to a worker agent, waits for CROO order creation, requires payment approval, records the payment transaction hash, and stores a receipt with the final delivery.

## Repository

Main app:

```text
tenderboard/
```

Specs:

```text
specs/2026-06-18-tenderboard-agent-rfp
specs/2026-06-18-tenderboard-live-agent-commerce
```

## What is real

- API-backed product UI
- task sanitization
- run receipts
- run history
- receipt downloads
- CROO SDK runtime path
- requester/task-giver agent code
- worker/provider agent code
- worker can do real public-source scouting through Hacker News and GitHub APIs
- live preflight command

## What requires CROO setup

A live blockchain payment requires:

- requester SDK key
- worker SDK key
- worker service id
- funded requester agent AA wallet
- tiny payment cap

No payment is faked in live mode.

## Run locally

```bash
cd tenderboard
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

## Run checks

```bash
cd tenderboard
npm test
npm run typecheck
npm audit --audit-level=low
```

## Live preflight

```bash
cd tenderboard
npm run live:preflight
```

## Live mode

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
npm run live:start
```

For separate worker/server terminals:

```bash
npm run live:worker
npm run live:start
```
