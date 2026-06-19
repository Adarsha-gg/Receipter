# WalrusProofMarketReceipts

Sui Move receipt registry for WalrusProof Market proof receipts.

The full receipt and worker evidence should be stored on Walrus. This package stores compact on-chain pointers by emitting `ReceiptAnchored` events, and records nonce-bound Sui x402 payments by emitting `PaymentIntentRecorded` events.

## Publish

```bash
sui client publish
```

After publish, copy:

- package id to `SUI_PACKAGE_ID`
- shared `Registry` object id to `SUI_RECEIPT_REGISTRY_ID`

## Testnet Deployment

```text
Package v2:      0xe87a8b5c87cfbf8e3251bed02f0be8a45220512f3f17e341f2c677a0154d4a47
Original pkg:    0x87a14a921a1ced0d2fd410ed0d6285d1722efabaf304d6a169971b902f6152c9
Registry:        0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb
Upgrade cap:     0xc50924def84e7bcadb6aaaea58f887017903102ace49363f82b9e18bad698b7d
Deployer:        0xb401ec7dde816354d0745fbba538674c51e5f7bcbb3816305df538f32d9c7727
V2 upgrade tx:   GRN22WmqYbZrM9kjgsZLw9wrvxZUixsh3AZ6YQXvZzo7
Smoke anchor tx: 3Yr14XHTAGLvHVa6RABeFsPXbxe2DRhhW5qZjRmhgmz8
Live x402 tx:    7rQS8zmCkjJkxu469UbVSQsjxwD88eVNpkaB2VAZoaYN
```

## Anchor

From the TypeScript app:

```bash
npm run sui:anchor-plan <run-id> <walrus-blob-id>
```

Then run the generated `sui client call`.

Do not claim mainnet anchoring until this package and the Walrus publisher path are redeployed on mainnet.
