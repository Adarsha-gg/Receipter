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
6. Full receipt/evidence JSON is stored on Walrus.
7. A compact proof pointer is anchored to Sui through a Move receipt registry.

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

## Non-Claims

Do not claim:

- deployed Sui package until `SUI_PACKAGE_ID` exists
- on-chain anchoring until `anchor_receipt` is called on testnet/mainnet
- Walrus evidence storage until a real blob id is produced

Allowed claims:

- includes a Sui Move receipt registry package
- generates Sui anchor plans from TenderBoard receipts

## Submission Blockers

- publish `tenderboard/sui` to Sui testnet or mainnet
- capture package id
- capture shared `Registry` object id
- upload a receipt/evidence JSON to Walrus
- run the generated Sui anchor call
- include package id and demo evidence in submission
