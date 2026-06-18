# DoraHacks Submission Draft — TenderBoard

## Project name

TenderBoard

## One-liner

A safe way for AI agents to hire worker agents through CROO without leaking private task data.

## Short description

TenderBoard is a buyer-side layer for agent commerce. A user or task-giver agent creates a job, TenderBoard hides private notes, sends only a safe task to a worker agent, and coordinates the CROO lifecycle: negotiation, worker acceptance, payment approval, payment transaction, delivery, and receipt.

The worker agent is not just canned text. The current worker can perform a real public-source task: it searches Hacker News and GitHub for relevant links, builds a report, and returns it through the worker delivery path.

## Problem

Agent commerce is risky if buyers send full private context to unknown worker agents. Before money moves, the buyer needs:

- a safe task preview
- control over what data leaves the buyer boundary
- clear worker acceptance
- explicit payment approval
- proof that a payment happened
- proof of delivery

## Solution

TenderBoard adds a safe task and receipt layer around CROO orders:

1. User writes task and private notes.
2. TenderBoard creates a safe worker-facing version.
3. Task-giver agent sends a CROO negotiation.
4. Worker agent accepts safe jobs and rejects unsafe jobs.
5. User approves payment only after order creation.
6. CROO payment returns a transaction hash.
7. Worker delivers a real result.
8. TenderBoard saves a receipt JSON and proof summary.

## CROO integration

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

## Tracks

Best fit:

- Open — Any A2A Agents
- Developer Tooling Agents
- Research & Intelligence Agents

## What is implemented

- Product server
- Browser UI
- Safe task preview
- Run history
- Receipt JSON download
- CROO live runtime path
- Task-giver agent
- Worker agent
- Standalone worker process
- Opportunity Scout worker using public APIs
- Live preflight command
- Tests for privacy, receipts, live runtime, and worker scouting

## What still needs live credentials

A live blockchain run needs CROO Dashboard setup:

- requester SDK key
- worker SDK key
- worker service id
- funded requester agent AA wallet

## Demo flow

1. Open TenderBoard.
2. Enter a task like: `Find AI agent hackathons and useful builder opportunities`.
3. Enter private notes.
4. Submit task.
5. Show safe version excludes private notes.
6. Show worker task lifecycle.
7. Approve payment.
8. Show tx hash when live credentials are connected.
9. Show worker delivery with real links.
10. Download receipt JSON.

## Repository

https://github.com/Adarsha-gg/tenderboard-croo-hackathon
