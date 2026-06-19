# TenderBoard Sui Overflow Pivot

## Goal

Make TenderBoard a credible Sui Overflow 2026 project that cannot exist without Sui.

## Current Truth

TenderBoard now treats Sui as the core product surface: work orders, SUI-denominated caps, receipt registry, evidence anchors, and reputation signals.

## Product Direction

TenderBoard becomes a Sui trust-gated work desk for agent commerce:

1. Buyer creates a worker-agent task.
2. TenderBoard strips private notes and secret-looking content.
3. TenderBoard records a trust decision for the worker route.
4. TenderBoard records a verification manifest with buyer-defined acceptance criteria.
5. Worker delivers evidence.
6. Full receipt/evidence JSON is stored on Walrus through the product flow.
7. A compact proof pointer is anchored to Sui through a Move receipt registry.

## Salvaged Product Thesis From Retired Branches

The retired commerce branches had useful product strategy even though their old non-Sui implementation path is no longer correct for Sui Overflow.

Keep these ideas:

- TenderBoard is buyer-side sourcing, not a generic marketplace.
- The valuable workflow is intake -> safe scope -> worker selection -> budget/risk gate -> award -> paid work order -> evidence -> reputation.
- Privacy labels matter: `PUBLIC`, `PRIVATE_AFTER_AWARD`, `LOCAL_ONLY`, and `NEVER_SHARE`.
- Competitive bids should eventually show price, SLA, requested data, risk flags, accept/reject reason, and award recommendation.
- A malicious or overreaching worker route should be blocked before it receives private data or payment authority.
- The demo story should make three things obvious: competition saves money, data minimization prevents leakage, and the awarded job becomes a Sui work contract.

Do not keep the retired implementation details:

- old non-Sui runtime
- non-Sui payment assumptions
- non-Sui token-specific config
- old mode language

Those are replaced by Sui work orders, SUI caps, Walrus evidence, and Sui receipt anchoring.

## Sui Role

Sui is the durable proof and reputation rail:

- shared receipt registry object
- `anchor_receipt` entry function
- `ReceiptAnchored` event per completed run
- event fields include run id, spec hash, evidence hash, trust score, verdict, checker pack, payment reference, and Walrus blob id

## Walrus Role

Walrus stores the larger evidence payload:

- full receipt JSON
- worker delivery text
- optional judge/demo artifacts

Sui stores only the compact pointer and hashes.

## Roadmap

1. Current: one buyer-approved Sui work order with trust scoring, Walrus evidence, and Sui receipt anchoring.
2. Next: multi-worker bid table with price, SLA, requested data, and risk flags.
3. Next: privacy-labeled task fields so only awarded agents can receive approved context.
4. Next: Sui object model for work orders, bid commitments, escrow/payment references, and receipt reputation.
5. Next: searchable reputation over `ReceiptAnchored` events and Walrus evidence bundles.

## Non-Claims

Do not claim:

- deployed Sui package until `SUI_PACKAGE_ID` exists
- on-chain anchoring until `anchor_receipt` is called on testnet/mainnet
- Walrus evidence storage until a real blob id is produced

Allowed claims:

- includes a Sui Move receipt registry package
- generates Sui anchor plans from TenderBoard receipts
- stores deterministic Walrus/Sui dev receipts locally in `sui-dev`
- can store evidence through a configured Walrus HTTP publisher in `sui`

## Submission Blockers

- publish `tenderboard/sui` to Sui testnet or mainnet
- capture package id
- capture shared `Registry` object id
- upload a receipt/evidence JSON to Walrus
- run the generated Sui anchor call
- include package id and demo evidence in submission
