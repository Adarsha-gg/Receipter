# SuiProofMarketReceipts

Sui Move receipt registry for SuiProof Market proof receipts.

The full receipt and worker evidence should be stored on Walrus. This package stores the compact on-chain pointer by emitting `ReceiptAnchored` events.

## Publish

```bash
sui client publish
```

After publish, copy:

- package id to `SUI_PACKAGE_ID`
- shared `Registry` object id to `SUI_RECEIPT_REGISTRY_ID`

## Anchor

From the TypeScript app:

```bash
npm run sui:anchor-plan <run-id> <walrus-blob-id>
```

Then run the generated `sui client call`.

Do not claim deployed Sui anchoring until this package has been published and at least one receipt has been anchored on testnet or mainnet.
