# Submission Draft - TenderBoard

## Project Name

TenderBoard

## One-Liner

A Sui trust-gated work desk where agents can hire worker agents with safe context sharing, proof-before-settlement, Walrus evidence, and receipt-backed reputation signals.

## Short Description

TenderBoard is a buyer-side layer for Sui agent commerce. A user or task-giver agent creates a paid job with private notes, acceptance criteria, and a checker pack. TenderBoard removes private or secret-looking content before dispatch, scores the worker route with a TrustMCP-style trust gate, anchors a CTRL+Z-style verification manifest, stores full receipt/evidence payloads on Walrus, and prepares a Sui receipt-registry call with the spec hash, evidence hash, trust score, checker pack, payment reference, and Walrus blob id.

The worker agent is not canned text. The current worker is an Opportunity Scout that searches public Hacker News and GitHub APIs, returns useful links/results, and sends the result through the delivery path.

## Problem

Agent commerce is risky if buyers send full private context to unknown worker agents or pay just because an API returned a valid shape. Before money moves, the buyer needs:

- a safe worker-facing task packet
- control over what data leaves the buyer boundary
- a trust decision for the worker route
- explicit acceptance criteria
- bounded checker logic for what "done" means
- clear worker acceptance
- explicit payment approval
- proof that payment happened
- proof of delivery
- a receipt that can become a reputation signal

## Solution

TenderBoard turns agent work into a verifiable work contract:

1. Buyer writes task, private notes, acceptance criteria, checker pack, and max payment.
2. TenderBoard creates a sanitized worker-facing packet.
3. TenderBoard records a trust decision: score, tier, verdict, reasons, controls, and risk multiplier.
4. TenderBoard anchors a verification manifest: spec hash, checker pack, acceptance criteria, required checks, settlement rule, and reputation write-back note.
5. Task-giver agent sends a CROO negotiation.
6. Worker agent accepts safe jobs and rejects unsafe jobs.
7. User approves payment only after an order exists.
8. CROO payment returns a transaction hash in live mode.
9. Worker delivers a real result.
10. TenderBoard saves receipt JSON and a judge-readable proof summary.

## What Is Real

- Product server
- Browser operator console
- Safe task preview
- Private-note exclusion
- Secret-pattern policy including env-style assignments like `API_KEY=...`
- Buyer-defined acceptance criteria
- Checker packs: `research`, `code`, `commerce`
- TrustMCP-style trust decision stored in receipts
- CTRL+Z-style verification manifest stored in receipts
- Receipt JSON download
- Proof markdown export
- Sui Move receipt registry package under `tenderboard/sui`
- Sui/Walrus readiness checks in the browser console
- Sui anchor-plan export: `npm run sui:anchor-plan`
- Run history
- CROO live runtime path
- Task-giver agent
- Worker agent
- Standalone worker process
- Opportunity Scout worker using public APIs
- Live preflight command
- Tests for privacy, receipts, trust/proof logic, live runtime shape, and worker scouting

## Sui and Walrus Integration

TenderBoard includes a Sui Move package:

- package: `TenderBoardReceipts`
- module: `tenderboard::receipts`
- shared object: `Registry`
- entry function: `anchor_receipt`
- event: `ReceiptAnchored`

Walrus is the intended storage layer for full receipt JSON and worker evidence. Sui stores the durable, queryable proof pointer.

Current deployment status: package source and anchor-plan tooling are implemented. A real Sui Overflow submission still needs the package published to Sui testnet/mainnet and the resulting `SUI_PACKAGE_ID` and `SUI_RECEIPT_REGISTRY_ID` set in `.env`.

## Optional CROO Commerce Path

TenderBoard uses `@croo-network/sdk` and the documented runtime lifecycle:

- `AgentClient`
- `connectWebSocket`
- `negotiateOrder`
- `acceptNegotiation`
- `payOrder`
- `deliverOrder`
- `getDelivery`
- `EventType.NegotiationCreated`
- `EventType.OrderCreated`
- `EventType.OrderPaid`
- `EventType.OrderCompleted`

Live payment is not faked. If credentials or funds are missing, live mode reports exactly what is missing.

## Important Positioning

TenderBoard is inspired by TrustMCP and CTRL+Z Verify, and its receipts are designed to map to ERC-8004-style reputation flows. This submission does not claim direct TrustMCP or ERC-8004 registry integration yet.

## Tracks

Best fit for Sui Overflow:

- Agentic Web
- Walrus specialized track

## What Still Needs Live Setup

A deployable Sui Overflow submission needs:

- Sui testnet or mainnet package publish
- shared receipt registry object id
- Walrus publisher and aggregator configuration
- receipt/evidence upload to Walrus before anchoring

The optional CROO commerce path needs:

- requester SDK key
- worker SDK key
- worker service id
- funded requester agent AA wallet

## Demo Flow

1. Open TenderBoard.
2. Enter a task like `Find AI agent hackathons and useful builder opportunities`.
3. Enter acceptance criteria.
4. Pick the `research` checker pack.
5. Enter private notes.
6. Submit task.
7. Show safe version excludes private notes but includes acceptance criteria.
8. Show trust score, tier, verdict, and controls.
9. Show verification manifest with spec hash and required checks.
10. Show worker task lifecycle.
11. Approve payment.
12. Show tx hash when live credentials are connected.
13. Show worker delivery with real links.
14. Download receipt JSON or export proof markdown.
15. Run `npm run sui:anchor-plan <run-id> <walrus-blob-id>` and show the Sui `anchor_receipt` call.

## Repository

https://github.com/Adarsha-gg/tenderboard-croo-hackathon
