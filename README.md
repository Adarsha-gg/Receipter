# SuiProof Market

SuiProof Market is a Sui-native trust-gated work desk for agent commerce.

It turns an agent job into a Sui work contract: sanitized task packet, trust decision, acceptance criteria, SUI-denominated payment cap, Walrus evidence pointer, and an on-chain Sui receipt anchor.

## What It Does

1. A buyer writes a paid task, private notes, acceptance criteria, and a checker pack.
2. SuiProof Market removes private/secret-looking content before anything reaches the worker.
3. SuiProof Market creates a trust decision: score, tier, verdict, reasons, controls, and risk multiplier.
4. SuiProof Market creates a verification manifest with spec hash, checker pack, acceptance criteria, required checks, settlement rule, and reputation write-back note.
5. SuiProof Market creates a Sui-shaped work order and requires explicit payment approval.
6. The worker delivers evidence.
7. The full receipt/evidence payload is stored as a Walrus evidence bundle.
8. The compact proof pointer is anchored to the Sui receipt registry.

The wedge is simple: agents can do paid work, but buyers need proof of what was sent, why the worker was trusted, what "done" meant, where evidence lives, and why payment should count as reputation.

The longer-term product is agent-native sourcing on Sui: safe task intake, privacy labels, worker-agent bids, budget/risk filtering, award to a Sui work order, Walrus evidence, and Sui receipt-backed reputation.

## What Is Implemented

- API-backed browser operator console
- safe worker packet preview
- private-note exclusion
- env-style secret detection
- SUI-denominated payment cap
- buyer-defined acceptance criteria
- checker packs: `research`, `code`, `commerce`
- trust decision in each receipt
- verification manifest in each receipt
- Sui Move receipt registry package
- Sui/Walrus readiness checks
- Walrus evidence-bundle storage flow
- Sui receipt-anchor flow
- Sui anchor-plan export
- receipt JSON downloads
- proof markdown export
- run history
- Opportunity Scout worker using public Hacker News and GitHub APIs
- tests for privacy, receipts, trust/proof logic, Sui config, anchor plans, and worker scouting

## Product Direction

SuiProof Market should not become a generic marketplace or payment wrapper. The defensible lane is governed sourcing for agent work:

- publish only the safe worker-facing scope
- compare worker routes or bids by price, SLA, requested data, and risk
- block over-budget or unsafe routes before payment
- award one task into a Sui work order
- store evidence on Walrus and anchor reputation on Sui

## Repository Layout

```text
tenderboard/                                      main TypeScript app
tenderboard/sui                                  Sui Move receipt registry package
specs/2026-06-19-sui-overflow-tenderboard         Sui Overflow product spec
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
npm run proof:latest
npm run sui:anchor-plan
```

## Sui Setup

Before claiming deployed Sui integration:

- publish `tenderboard/sui` to Sui testnet or mainnet
- set `SUI_OPERATOR_ADDRESS`
- set `SUI_PACKAGE_ID`
- set `SUI_RECEIPT_REGISTRY_ID`
- configure `WALRUS_PUBLISHER_URL` and `WALRUS_AGGREGATOR_URL`
- store the receipt/evidence bundle on Walrus
- run the generated Sui anchor call from `npm run sui:anchor-plan <run-id>`
