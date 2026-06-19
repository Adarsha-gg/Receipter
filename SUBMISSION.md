# Submission Draft - SuiProof Market

## Project Name

SuiProof Market

## One-Liner

A Sui-native trust and settlement desk for paid agent work, with Sui work orders, Walrus evidence, and on-chain receipt-backed reputation.

## Short Description

SuiProof Market lets buyers hire worker agents without leaking private context or paying blindly. A buyer creates a paid task in SUI, adds private notes and acceptance criteria, and chooses a checker pack. SuiProof Market strips private data, produces a worker-safe packet, scores the worker route, creates a verification manifest, stores the full evidence payload as a Walrus bundle, and anchors the compact proof pointer to a Sui receipt registry.

The worker is not canned text. The current worker is an Opportunity Scout that uses public Hacker News and GitHub APIs and returns real links/results through the delivery flow.

## Problem

Agent commerce needs a trust layer. Buyers need to know:

- what was sent to the worker
- what stayed private
- why a worker was allowed
- what "done" meant before payment
- where the evidence lives
- whether payment and delivery can become reputation

Without this, agent marketplaces become blind prompt forwarding plus blind payment.

The stronger product wedge is buyer-side sourcing. Human procurement already depends on intake, RFx, supplier comparison, risk gating, award decisions, and audit trails. Agent commerce needs the same thing for autonomous workers: a buyer should publish only the safe scope, compare worker routes by budget and risk, approve one work order, and turn the completed delivery into durable reputation.

## Sui-Native Solution

SuiProof Market turns agent work into a Sui work contract:

1. Buyer writes task, private notes, acceptance criteria, checker pack, and max SUI payment.
2. SuiProof Market creates a sanitized worker packet.
3. SuiProof Market records a trust decision: score, tier, verdict, reasons, controls, and risk multiplier.
4. SuiProof Market records a verification manifest: spec hash, checker pack, required checks, settlement rule, and reputation write-back note.
5. SuiProof Market creates a Sui work order id.
6. Operator approves payment only for that exact work order.
7. Worker delivers real evidence.
8. Full receipt/evidence is stored on Walrus.
9. Compact proof fields are anchored to Sui through `tenderboard::receipts::anchor_receipt`.

## What Is Real

- Product server
- Browser operator console
- SUI-denominated work contracts
- Safe task preview
- Private-note exclusion
- Secret-pattern policy including env-style assignments like `API_KEY=...`
- Buyer-defined acceptance criteria
- Checker packs: `research`, `code`, `commerce`
- Trust decision stored in every receipt
- Verification manifest stored in every receipt
- Sui Move receipt registry package
- Sui/Walrus readiness checks in the browser console
- Walrus evidence storage action in the browser console
- Sui receipt anchoring action in the browser console
- Sui anchor-plan export: `npm run sui:anchor-plan`
- Receipt JSON download
- Proof markdown export
- Run history
- Opportunity Scout worker using public APIs
- Tests for privacy, receipts, Sui config, proof logic, server behavior, and Sui anchor plans

## Sui and Walrus Integration

SuiProof Market includes a Sui Move package:

- package: `SuiProofMarketReceipts`
- module: `tenderboard::receipts`
- shared object: `Registry`
- entry function: `anchor_receipt`
- event: `ReceiptAnchored`

The Sui event records:

- receipt sequence
- sender
- run id
- spec hash
- evidence hash
- trust score
- trust verdict
- checker pack
- Sui payment/work-order reference
- Walrus blob id

Walrus is the evidence layer for full receipt JSON and worker delivery. Sui is the durable proof and reputation rail.

## Product Roadmap From Sourcing To Reputation

The current demo proves one buyer-controlled work order end to end. The next product step is competitive agent sourcing:

1. Buyer creates a task with privacy labels: `PUBLIC`, `PRIVATE_AFTER_AWARD`, `LOCAL_ONLY`, and `NEVER_SHARE`.
2. Multiple worker agents return bids with price, SLA, requested data, confidence, and risk flags.
3. SuiProof Market filters bids over budget or requesting unsafe data.
4. The buyer awards one bid, creating a Sui work order.
5. Payment approval, Walrus evidence, and Sui receipt anchoring make the result reusable as reputation.

This keeps SuiProof Market out of the crowded generic marketplace lane. It is the governed sourcing and settlement layer for paid agent work on Sui.

## Best Track

Primary track: **Agentic Web**.

Why: SuiProof Market is an AI-native workflow that deeply uses Sui primitives for trust, work-order state, evidence anchoring, and reputation. It is not a generic app with a token attached.

Secondary target: **Walrus**, if the final demo uses a real Walrus publisher and anchors the resulting blob id.

## Why It Can Win

SuiProof Market matches the judging criteria directly:

- Product & UX: clear operator console, safe packet preview, trust gate, manifest, timeline, receipt.
- Real-world application: companies will not let agents hire other agents without privacy controls, budget/risk filtering, approval gates, and proof.
- Technical implementation: Sui Move registry, Sui-shaped work orders, SUI caps, Walrus evidence pointer, typed receipts, tests.
- Presentation & vision: the product becomes the sourcing, trust, and reputation layer for agent work on Sui.

## What Still Needs Mainnet/Testnet Setup

- Publish `tenderboard/sui` to Sui testnet or mainnet.
- Capture package id.
- Capture shared `Registry` object id.
- Upload a receipt/evidence JSON to Walrus.
- Run the generated Sui anchor call.
- Add package id and blob id to the final submission.

## Demo Flow

1. Open SuiProof Market.
2. Show Sui readiness and SUI payment cap.
3. Enter a task like `Find Sui agent grants and useful builder opportunities`.
4. Enter acceptance criteria.
5. Pick the `research` checker pack.
6. Enter private notes.
7. Submit task.
8. Show safe version excludes private notes but includes acceptance criteria.
9. Show trust score, tier, verdict, and controls.
10. Show verification manifest with spec hash and required checks.
11. Show Sui work order id.
12. Approve payment.
13. Show Sui dev payment digest or real digest.
14. Show worker delivery with real links.
15. Store evidence and show the Walrus blob/object fields.
16. Anchor the receipt and show the Sui anchor digest.
17. Download receipt JSON or export proof markdown.
18. Run `npm run sui:anchor-plan <run-id>` and show the Sui `anchor_receipt` call.

## Repository

https://github.com/Adarsha-gg/tenderboard-sui-overflow
