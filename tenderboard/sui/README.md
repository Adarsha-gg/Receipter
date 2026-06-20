# WalrusProofMarketReceipts

Sui Move package for WalrusProof Market agent passports, proof receipts, and reputation stake.

The full receipt and worker evidence should be stored on Walrus. This package stores compact on-chain pointers by emitting `ReceiptAnchored` events, records nonce-bound Sui x402 payments by emitting `PaymentIntentRecorded` events, mints owner-held `AgentPassport` objects, and supports stake/slash accountability through `reputation_stake`.

## Publish

```bash
sui client publish
```

After publish, copy:

- package id to `SUI_PACKAGE_ID`
- shared `Registry` object id to `SUI_RECEIPT_REGISTRY_ID`

## Testnet Deployment

```text
Package v5:      0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651
Original pkg:    0x87a14a921a1ced0d2fd410ed0d6285d1722efabaf304d6a169971b902f6152c9
Registry:        0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb
Upgrade cap:     0xc50924def84e7bcadb6aaaea58f887017903102ace49363f82b9e18bad698b7d
Deployer:        0xb401ec7dde816354d0745fbba538674c51e5f7bcbb3816305df538f32d9c7727
Passport object: 0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e
V5 upgrade tx:   75yRfdfQFTM167qzvS9iBvY1L9rpVWpopRAuJZhZ8fRD
Passport mint:   D7c7uuvKuxvcMiWWc6DjrE1DoWu6dhTZ21vZnKNw3AbL
Passport update: 7fKW9usVrqJ1XydV8SAhwaUYiRnqWkiSXBNNHaqLqnoW
Stake attached:  9RRyreY2BBuKE6kxVffGqvJj8Yr5WQtN1bZYqL9LAVAP
V2 upgrade tx:   GRN22WmqYbZrM9kjgsZLw9wrvxZUixsh3AZ6YQXvZzo7
Smoke anchor tx: 3Yr14XHTAGLvHVa6RABeFsPXbxe2DRhhW5qZjRmhgmz8
Live x402 tx:    7rQS8zmCkjJkxu469UbVSQsjxwD88eVNpkaB2VAZoaYN
Full proof tx:   Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP
```

## Anchor

From the TypeScript app:

```bash
npm run sui:anchor-plan <run-id> <walrus-blob-id>
```

Then run the generated `sui client call`.

Do not claim mainnet anchoring until this package and the Walrus publisher path are redeployed on mainnet.
