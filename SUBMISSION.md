# Submission Draft - TenderBoard

## Project Name

TenderBoard

## One-Liner

A trust-gated work desk where agents can hire worker agents through CROO with safe context sharing, proof-before-settlement, and receipt-backed reputation signals.

## Short Description

TenderBoard is a buyer-side layer for agent commerce. A user or task-giver agent creates a paid job with private notes, acceptance criteria, and a checker pack. TenderBoard removes private or secret-looking content before dispatch, scores the worker route with a TrustMCP-style trust gate, anchors a CTRL+Z-style verification manifest, coordinates the CROO lifecycle, requires explicit payment approval, and stores a downloadable receipt with delivery evidence.

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
- Run history
- CROO live runtime path
- Task-giver agent
- Worker agent
- Standalone worker process
- Opportunity Scout worker using public APIs
- Live preflight command
- Tests for privacy, receipts, trust/proof logic, live runtime shape, and worker scouting

## CROO Integration

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

Best fit:

- Open - Any A2A Agents
- Developer Tooling Agents
- Research & Intelligence Agents

## What Still Needs Live Credentials

A live blockchain run needs CROO Dashboard setup:

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

## Repository

https://github.com/Adarsha-gg/tenderboard-croo-hackathon
