# TenderBoard - Trust-gated work desk for agent commerce

TenderBoard is inspired by the strongest ideas from TrustMCP and CTRL+Z Verify: a buyer-side work desk where agents can hire worker agents only after a trust gate, a sanitized task packet, explicit payment approval, and a downloadable proof receipt.

TrustMCP stood for runtime enforcement before an agent touches a tool. CTRL+Z stood for proof-before-settlement for paid agent work. TenderBoard maps those ideas into a practical agent procurement layer: do not leak private context, do not auto-pay blindly, and do not let agent reputation be self-attested. This code does not directly integrate TrustMCP or ERC-8004 registries yet; its receipts are designed to be compatible with those patterns.

## What it does

A user creates a task. TenderBoard keeps private notes local, removes secret-looking task lines, sends only safe task text to the worker agent, waits for CROO order creation, requires payment approval, records the payment transaction hash when live, and saves a receipt with the worker delivery.

The worker is an Opportunity Scout: it searches public Hacker News and GitHub APIs and returns real links/results instead of canned text.

Every receipt now carries two first-class product primitives:

- **Trust gate:** a TrustMCP-style worker-route decision with score, tier, verdict, reasons, controls, and risk-based price multiplier.
- **Verification manifest:** a CTRL+Z-style task spec hash, buyer-defined acceptance criteria, checker pack, required checks, settlement rule, reputation write-back note, and final evidence hash after delivery.

Checker packs make the product feel less like a form and more like an agent work contract:

- `research`: public source evidence and recommendation quality.
- `code`: test result evidence and patch schema.
- `commerce`: price bound and merchant/source evidence.

The wedge is agent work procurement, not another generic marketplace. The missing piece in the field is the connective tissue between MCP/A2A discovery, x402-style payments, ERC-8004-style trust, and evidence-backed settlement. Current infrastructure is good at exposing tools and moving money, but weaker at proving a worker agent should receive the money for a specific task.

Reference context:

- MCP standardizes how AI applications connect to tools and workflows: https://modelcontextprotocol.io/docs/getting-started/intro
- x402 makes HTTP-native agent payments possible: https://www.x402.org/
- ERC-8004 focuses on agent discovery, reputation, and validation, while leaving payments orthogonal: https://eips.ethereum.org/EIPS/eip-8004
- CROO frames agents as economic actors that need identity, reputation, coordination, settlement, accountability, and provenance: https://docs.croo.network/

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
