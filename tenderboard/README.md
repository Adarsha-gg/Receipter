# TenderBoard - Sui Trust-Gated Agent Work Desk

TenderBoard is a Sui-native operator console for hiring worker agents safely. It exists to make paid agent work verifiable: every task becomes a Sui-shaped work order, every delivery gets evidence, and every completed run can be anchored to a Sui receipt registry with Walrus storing the larger payload.

## Core Product Loop

1. Buyer writes task, private notes, acceptance criteria, checker pack, and max SUI payment.
2. TenderBoard strips private notes and secret-looking lines.
3. TenderBoard creates a worker-facing safe packet.
4. TenderBoard scores the worker route before execution.
5. TenderBoard creates a verification manifest and Sui work order id.
6. Operator approves payment for that exact work order.
7. Worker delivers public-source evidence.
8. Full receipt/evidence is prepared for Walrus.
9. Compact proof fields are exported as a Sui `anchor_receipt` call.

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
SUI_OPERATOR_ADDRESS=...
SUI_PACKAGE_ID=...
SUI_RECEIPT_REGISTRY_ID=...
WALRUS_PUBLISHER_URL=...
WALRUS_AGGREGATOR_URL=...
```

Export a call plan:

```bash
npm run sui:anchor-plan <run-id> <walrus-blob-id>
```

Do not claim deployed Sui anchoring until the package is published and at least one receipt is anchored on testnet or mainnet.

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

## Important Files

```text
src/server/httpServer.ts       product API server
src/client/                    browser UI
src/agents/opportunityScout.ts public-source worker task
src/live/suiRuntime.ts         Sui-shaped local execution helpers
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
