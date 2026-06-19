# SuiProof Market - Sui Trust-Gated Agent Work Market

SuiProof Market is a Sui-native operator console for hiring worker agents safely. It exists to make paid agent work verifiable: every task becomes a Sui-shaped work order, every delivery gets evidence, and every completed run can be anchored to a Sui receipt registry with Walrus storing the larger payload.

## Core Product Loop

1. Buyer writes task, private notes, acceptance criteria, checker pack, and max SUI payment.
2. SuiProof Market strips private notes and secret-looking lines.
3. SuiProof Market creates a worker-facing safe packet.
4. SuiProof Market scores the worker route before execution.
5. SuiProof Market creates a verification manifest and Sui work order id.
6. Worker task access is guarded by an x402-style HTTP 402 challenge.
7. The challenge carries a Sui Payment Kit-compatible URI plus Payment Intent metadata for that exact work order.
8. Hirer agent retries with a Sui payment payload.
9. The Sui-native x402 facilitator verifies run, resource, nonce, amount, receiver, worker, and Sui settlement.
10. Worker agent receives the paid task packet and delivers source-backed evidence.
11. The verification layer checks claim-to-source binding, evidence strength, Walrus readiness, and settlement blockers.
12. Full receipt/evidence is stored as a Walrus bundle only after delivery.
13. Compact proof fields are committed to the Sui receipt registry only when verification is admissible.
14. The worker reputation passport updates only after the Sui receipt anchor is recorded.

## Sui Proof Layer

Move package:

```bash
cd sui
sui client publish
```

After publishing, configure:

```env
TENDERBOARD_MODE=sui
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_OPERATOR_ADDRESS=...
SUI_PACKAGE_ID=...
SUI_RECEIPT_REGISTRY_ID=...
WALRUS_PUBLISHER_URL=...
WALRUS_AGGREGATOR_URL=...
```

Export a call plan:

```bash
npm run sui:anchor-plan <run-id>
```

Do not claim deployed Sui anchoring until the package is published and at least one receipt is anchored on testnet or mainnet.

In `sui-dev` mode the app records deterministic Sui dev digests and Walrus dev blob/object ids so the full product loop can be demoed locally. In `sui` mode payment approval requires a real Sui payment transaction digest, the Walrus evidence step uses the configured HTTP publisher, and the Sui anchor step records the real receipt-registry transaction digest.

SuiProof Market generates Payment Kit-compatible URI metadata for SUI payment approval planning. Worker task access is exposed as an x402 paid API: unpaid worker requests receive HTTP `402` with Sui payment instructions, and paid requests receive the task packet with an `X-Payment-Response` header bound to the recorded Sui transaction digest.

The app includes its own Sui-native x402 facilitator. In `sui-dev` it verifies deterministic local Sui dev digests for demoability. In `sui` mode it calls `SUI_RPC_URL` with `sui_getTransactionBlock` and verifies successful execution, receiver balance change, Payment Kit nonce binding, request/resource binding, amount, receiver, coin type, worker id, and replay protection before unlocking the worker task. This is not the Coinbase-hosted facilitator; it is the missing Sui-specific facilitator path for SuiProof Market. In this environment the Move package is source-level because the Sui CLI is not installed.

## Verification Layer

SuiProof Market treats payment, delivery, clearing, and reputation as separate gates. Delivery text alone is not settlement-grade evidence. Each receipt gets a verification summary with:

- `admissibility`: `pending`, `insufficient`, or `admissible`
- `evidenceStrength`: `none`, `delivery_only`, `source_receipt`, `walrus_backed`, or `sui_anchored`
- `blockerIds`: unresolved checks that prevent clearing
- `settlementEligible`: true only when non-reputation blockers are cleared
- `reputationEligible`: true only after Sui anchoring

For research work, source-backed claims must be bound to observations in the worker source receipt. If claims are missing, malformed, or not bound to observations, clearing moves to `requires_review`, settlement action becomes `manual_review`, and Sui anchoring is blocked even if a Walrus blob exists.

## Run

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

## Commands

```bash
npm test
npm run typecheck
npm run proof:latest
npm run sui:anchor-plan
```

## Agent API

The browser uses the same API external agents can call:

```text
POST /api/runs                         hirer agent creates a safe Sui work order
POST /api/x402/verify                  Sui x402 facilitator verifies payment and unlocks work
POST /api/runs/:id/approve-payment     hirer agent records Sui payment approval
GET  /api/runs/:id/agent-handoff       worker agent reads the awarded handoff
GET  /api/runs/:id/worker-task         worker agent gets 402 until Sui payment is recorded
POST /api/runs/:id/worker-delivery     worker agent submits delivery evidence
POST /api/runs/:id/store-evidence      operator stores the receipt bundle on Walrus
POST /api/runs/:id/anchor-receipt      operator records the Sui receipt anchor
```

In `sui-dev`, `/worker-delivery` can run the built-in Opportunity Scout worker for demos. In production, an external worker agent should submit its own delivery and source evidence.

## Important Files

```text
src/server/httpServer.ts       product API server
src/client/                    browser UI
src/agents/opportunityScout.ts public-source worker task
src/live/suiRuntime.ts         Sui-shaped local execution helpers
src/live/walrusRuntime.ts      Walrus evidence bundle storage
src/live/proof.ts              receipt-to-markdown proof renderer
src/sui/anchorPlan.ts          receipt-to-Sui call plan renderer
sui/                           Sui Move receipt registry package
```

## Safety Rules

- Do not commit `.env`.
- Do not paste private keys or seed phrases.
- Use tiny SUI caps while testing.
- Upload evidence to Walrus before final Sui anchoring.
- Approve payment only after the UI shows the Sui work order id.
