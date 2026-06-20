# WalrusProof Hosted Deployment

This is the no-local-CLI deployment path for judges or a hosted demo.

## Runtime Mode

Use live Sui/Walrus mode:

```text
TENDERBOARD_MODE=sui
MEMORY_BACKEND=walrus
```

Do not depend on `SUI_CLI_PATH` or a local `client.yaml` in hosted mode. Payment, receipt anchor, AgentPassport update, stake, challenge, and slash flows all expose signer-ready transaction payloads and verify the signed Sui transaction through `SUI_RPC_URL`.

## Required Environment

```text
TENDERBOARD_MODE=sui
TENDERBOARD_RECEIPTS_DIR=/var/lib/walrusproof/runs
TENDERBOARD_WORKER_AGENT_ID=sui_opportunity_scout
TENDERBOARD_WORKER_AGENT_ADDRESS=<worker-owner-sui-address>
TENDERBOARD_WORKER_AGENT_PASSPORT_OBJECT_ID=<agent-passport-object-id>

SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_OPERATOR_ADDRESS=<operator-or-receiver-address>
SUI_PACKAGE_ID=<deployed-package-id>
SUI_RECEIPT_REGISTRY_ID=<receipt-registry-object-id>
SUI_STAKE_ORACLE_REGISTRY_ID=<stake-oracle-registry-object-id>

WALRUS_UPLOAD_STRATEGY=raw-walrus
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

Optional MemWal mode needs real credentials:

```text
MEMORY_BACKEND=memwal
MEMWAL_DELEGATE_KEY=<delegate-key>
MEMWAL_ACCOUNT_ID=<account-id>
MEMWAL_SERVER_URL=<memwal-server-url>
MEMWAL_NAMESPACE=walrusproof
```

Optional Seal encryption should only be enabled when a live policy and SDK path are configured:

```text
SEAL_ENCRYPTION_MODE=sdk
SEAL_POLICY_ID=<seal-policy-id>
SEAL_NAMESPACE=walrusproof
```

## Persistent Storage

`TENDERBOARD_RECEIPTS_DIR` must be backed by persistent disk, not ephemeral build storage.

The directory stores:

- run receipts as `*.json`
- x402 nonce and transaction replay ledger as `x402-replay-ledger.json`

If this directory is lost, the app can still verify Sui/Walrus artifacts by digest, but it loses local run history and replay memory.

## Live Signing Flow

Hosted mode should call these endpoints and hand `walletTransactionRequest` payloads to a Sui wallet/sponsor:

```text
GET  /api/runs/:id/payment-transaction
POST /api/x402/verify

GET  /api/runs/:id/anchor-transaction
POST /api/runs/:id/anchor-receipt

GET  /api/runs/:id/passport-update-transaction
POST /api/runs/:id/passport-update

GET  /api/stake/oracle-registry-transaction
POST /api/stake/open-transaction
POST /api/stake/attach-transaction
POST /api/stake/challenge-transaction
POST /api/stake/resolve-challenge-transaction
POST /api/stake/slash-transaction
POST /api/stake/verify
```

Raw digest bypasses are rejected in live mode for payment and receipt anchoring. The server verifies Sui RPC events before accepting signed transaction results.

## Deployment Checklist

- Deploy the Sui package and record package, receipt registry, stake registry, and passport object IDs.
- Fund the operator/receiver and worker owner addresses on Sui testnet.
- Configure a persistent `TENDERBOARD_RECEIPTS_DIR`.
- Configure a reachable Walrus publisher and aggregator.
- Start the server with the host's Node.js start command.
- Run `npm run check:live` and a real paid run before submitting the demo link.
