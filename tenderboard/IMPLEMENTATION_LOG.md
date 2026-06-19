# TenderBoard Implementation Log

## 2026-06-18 - Buyer-Side Sourcing Prototype

Built the first TenderBoard shape around safe task intake, privacy-labeled request fields, worker-agent offers, budget checks, blocked unsafe data requests, and award decisions.

Useful ideas kept for the Sui version:

- safe scope before worker execution
- privacy labels
- bid comparison by budget, requested data, and risk
- explicit award before payment
- secret redaction tests

Retired implementation details from that prototype were removed when the product became Sui-native.

## 2026-06-18 - API-Backed Operator Console

Converted the project from generated static demo artifacts into a local product server with:

- browser operator console
- task form
- safe worker packet preview
- server-sent event timeline
- run receipt storage
- receipt downloads
- proof export
- Opportunity Scout worker using public Hacker News and GitHub APIs

Validation:

```text
npm test
npm run typecheck
```

## 2026-06-19 - Trust Proof Receipts

Added trust decisions and verification manifests to every run receipt:

- worker route score
- tier and verdict
- reasons and controls
- checker pack
- buyer acceptance criteria
- spec hash
- evidence hash after delivery
- reputation write-back note

Also added secret-pattern regression tests and tightened receipt redaction.

## 2026-06-19 - Sui-Native Pivot

Replaced the retired non-Sui chain path with Sui as the core product rail:

- SUI-denominated payment caps
- Sui-shaped work order ids
- Sui Move receipt registry package
- Sui anchor-plan export
- Sui readiness checks
- receipt fields for package id, registry id, payment digest, and anchor digest

Validation:

```text
npm test
npm run typecheck
```

## 2026-06-19 - Walrus Evidence Flow

Added Walrus as the evidence layer:

- evidence bundle renderer
- Walrus HTTP publisher integration in `sui` mode
- deterministic local Walrus dev ids in `sui-dev`
- receipt fields for blob id, blob object id, read URL, and epoch metadata
- browser action to store evidence after worker delivery

## 2026-06-19 - Sui Receipt Anchoring Flow

Added the final Sui anchoring step:

- browser action to anchor the final receipt
- API endpoint requiring a real Sui transaction digest in `sui` mode
- local dev anchor digest in `sui-dev`
- UI dependency rail: work order -> SUI approval -> Walrus evidence -> Sui registry
- tests for approval, evidence storage, and anchoring

Validation:

```text
npm test                  # 9 files, 19 tests passed
npm run typecheck         # passed
full API smoke test       # create run -> approve -> store evidence -> anchor
```

## 2026-06-19 - Branch Salvage

Before removing retired branch refs, reviewed their product docs and brought forward the useful material:

- buyer-side sourcing positioning
- competitive worker-agent bid roadmap
- privacy labels
- budget and data-request risk filtering
- malicious worker gating
- award-to-Sui-work-order story

The retired chain-specific runtime and obsolete specs were not brought forward because they conflict with the Sui Overflow direction.
