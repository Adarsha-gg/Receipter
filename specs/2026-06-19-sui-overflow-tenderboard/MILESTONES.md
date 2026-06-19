# Milestones

## 2026-06-19 - Sui gap identified

TenderBoard had a useful agent-commerce product shape, but its live chain path was not Sui-oriented. For Sui Overflow, that was not enough. Decision: keep the trust/proof product, but make Sui the receipt anchor and Walrus the evidence layer.

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

## 2026-06-19 - Walrus and Sui finalization flow added

Added first-class product actions after worker delivery:

- store the full receipt/evidence bundle through Walrus
- record Walrus blob id, blob object id, read URL, and epoch metadata
- move the run into `anchoring`
- anchor the final receipt to the Sui receipt registry
- record a Sui anchor digest and move the run into `anchored`
- show the four-step Sui dependency map in the UI

In `sui-dev`, the flow produces deterministic dev blob/object ids and dev Sui digests for local demo. In `sui`, the Walrus step uses the configured HTTP publisher and the anchor step requires the real Sui receipt-registry transaction digest.

## 2026-06-19 - Retired branch product salvage

Reviewed the deleted branch backup refs before final cleanup.

Kept from the retired commerce branches:

- buyer-side sourcing positioning
- competitive bid roadmap
- privacy labels
- budget/risk filtering
- malicious worker/data-request gating
- award-to-work-order demo story

Did not keep:

- old non-Sui runtime
- old non-Sui payment path
- obsolete mode/config language
- old chain-specific specs

Decision: Sui remains the vertical product rail, while the salvaged product strategy becomes the roadmap for multi-agent sourcing on Sui.

## Next

Install/configure Sui CLI, publish the package, capture object ids, upload evidence to Walrus, and run the generated `sui client call`.
