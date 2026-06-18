# TenderBoard

TenderBoard is a safe way for AI agents to hire worker agents through CROO.

A user creates a task. TenderBoard keeps private notes local, sends only safe task text to the worker agent, waits for CROO order creation, requires payment approval, records the payment transaction hash, and saves a receipt with the worker delivery.

The worker is an Opportunity Scout: it searches public Hacker News and GitHub APIs and returns real links/results instead of canned text.

## Run the product app

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

## Core commands

```bash
npm test
npm run typecheck
npm audit --audit-level=low
npm run live:preflight
npm run proof:latest
```

## Live CROO mode

Create `.env`:

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

Preflight:

```bash
npm run live:preflight
```

Start one-process live mode:

```bash
npm run live:start
```

Or run worker separately:

```bash
npm run live:worker
npm run live:start
```

## What is implemented

- API-backed browser app
- safe task preview
- private-note exclusion
- run history
- receipt JSON download
- proof markdown export
- live config health
- CROO SDK runtime path
- requester/task-giver client
- embedded or standalone worker agent
- real Opportunity Scout worker using public APIs
- payment approval before `payOrder`
- receipt storage under `data/runs`

## What needs external setup

Live payment requires CROO Dashboard setup:

- requester SDK key
- worker SDK key
- worker service id
- funded requester agent AA wallet

No live payment is faked.

## Important files

```text
src/server/httpServer.ts       product API server
src/client/                    browser UI
src/live/crooRuntime.ts        real CROO runtime path
src/agents/workerAgent.ts      standalone worker process
src/agents/opportunityScout.ts real public-source worker task
src/live/proof.ts              receipt-to-markdown proof renderer
```

## Safety rules

- Do not commit `.env`.
- Do not paste private keys or seed phrases.
- Fund the requester agent AA wallet, not the controller wallet.
- Use a tiny payment cap for live runs.
- Approve payment only after the UI shows the order id.
