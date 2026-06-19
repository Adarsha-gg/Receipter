# Milestones

## 2026-06-19 - Sui gap identified

TenderBoard had a useful agent-commerce product shape, but its live chain path was CROO/Base-oriented. For Sui Overflow, that was not enough. Decision: keep the trust/proof product, but make Sui the receipt anchor and Walrus the evidence layer.

## 2026-06-19 - Sui proof package added

Added `tenderboard/sui` with a Move package named `TenderBoardReceipts`.

The package defines:

- shared `Registry`
- `ReceiptAnchored` event
- `anchor_receipt` entry function
- receipt counter

## 2026-06-19 - TypeScript anchor plan added

Added `src/sui/anchorPlan.ts` and `npm run sui:anchor-plan`.

The CLI loads a TenderBoard receipt and writes a judge-readable Sui call plan under `proof/`.

## 2026-06-19 - Readiness surfaced

Added safe config fields and UI status for:

- Sui network
- package id configured
- receipt registry id configured
- Walrus publisher configured
- Walrus aggregator configured
- missing Sui settings

## Next

Install/configure Sui CLI, publish the package, capture object ids, upload evidence to Walrus, and run the generated `sui client call`.
