# Receipter App

TypeScript app, API server, browser UI, MCP server, and Sui/Walrus integration code for Receipter.

Receipter creates verifiable receipts for paid AI agent work:

```text
work order -> scoped Sui payment -> worker evidence -> Walrus receipt artifact
-> Sui receipt anchor -> AgentPassport update
```

## Run

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

Main surfaces:

```text
/           overview
/hire       create and settle a work order
/explorer   Walrus Evidence Inspector and Agent Passport Directory
/developers API, MCP, agent-card, and stake tooling
```

## Validate

```bash
npm test
npm run typecheck
```

Current expected result:

```text
48 test files passed
202 tests passed
```

## Live Mode

Use Sui/Walrus testnet mode for judging and real verification:

```env
RECEIPTER_MODE=sui
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_OPERATOR_ADDRESS=...
SUI_PACKAGE_ID=...
SUI_RECEIPT_REGISTRY_ID=...
SUI_STAKE_ORACLE_REGISTRY_ID=...
RECEIPTER_WORKER_AGENT_PASSPORT_OBJECT_ID=...
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

Then open:

```text
http://127.0.0.1:4174?live=1
```

`?live=1` makes the UI fail loudly if live Walrus/Sui data is unavailable. Without it, the UI may use clearly labeled sample records for local review.

## Testnet Objects

```text
Package v5:       0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651
Receipt registry: 0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb
Stake registry:   0x78aeac24fbcde9b26b8d8ed5e9f51defde5258f6045bb91d8f2c4d3982e9dc35
AgentPassport:    0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e
```

Representative proof:

```text
Walrus blob:      lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw
Sui anchor:       Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP
Passport update:  7fKW9usVrqJ1XydV8SAhwaUYiRnqWkiSXBNNHaqLqnoW
```

## Commands

```bash
npm run mcp
npm run hire:agent -- --title "Find Sui AI grants" --instructions "Find public Sui or Walrus grants for AI agents. Include links and dates." --amount 0.05
npm run proof:latest
npm run sui:anchor-plan
npm run sui:x402-pay -- <run-id>
npm run smoke:x402-live
npm run smoke:full-live
```

## MCP

Receipter exposes a stdio MCP server for agent hosts:

```bash
npm run mcp
```

Example config:

```json
{
  "mcpServers": {
    "receipter": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "C:\\Users\\adars\\Coding\\hackathon\\receipter",
      "env": {
        "RECEIPTER_BASE_URL": "http://127.0.0.1:4174"
      }
    }
  }
}
```

## API

```text
POST /api/runs
GET  /api/runs/:id
GET  /api/runs/:id/payment-transaction
POST /api/x402/verify
GET  /api/runs/:id/worker-task
POST /api/runs/:id/worker-delivery
POST /api/runs/:id/store-evidence
GET  /api/runs/:id/anchor-transaction
POST /api/runs/:id/anchor-receipt
GET  /api/runs/:id/passport-update-transaction
POST /api/runs/:id/passport-update
GET  /api/walrus/memory
GET  /api/walrus/memory/:workerAgentId
GET  /api/oracle/records/:runId/verify
GET  /api/oracle/passports/:workerAgentId/verify
```

## Structure

```text
src/client/    browser UI
src/server/    HTTP API
src/live/      Walrus, receipts, verification, runtime logic
src/sui/       Sui transaction builders and verifiers
src/mcp/       MCP server
src/agents/    worker implementations
sui/           Move package
```

## Safety

- Do not commit `.env`.
- Do not commit private keys or seed phrases.
- Keep test payments small.
- Do not claim mainnet deployment until the Move package and Walrus publishing path are redeployed on mainnet.
