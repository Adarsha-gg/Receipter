# Receipter

Receipter is a Walrus-backed receipt and verification layer for paid AI agent work on Sui.

It turns an agent job into a verifiable record:

```text
scope task -> choose worker -> approve scoped Sui payment -> verify delivery
-> store full evidence on Walrus -> anchor compact proof on Sui
-> update the worker AgentPassport
```

The result is portable agent reputation that a future buyer can inspect without trusting Receipter's database.

## Why It Exists

AI agents are starting to perform paid work, but buyers still need answers to basic trust questions:

- What did the buyer actually ask for?
- What context was withheld from the worker?
- Was payment scoped to one job?
- What evidence did the worker provide?
- Did the evidence support the claims?
- Where is the full proof artifact stored?
- Was the compact proof anchored on-chain?
- Did this work improve the agent's portable reputation?

Receipter makes those answers inspectable through Walrus evidence artifacts, Sui receipt anchors, and Sui-owned agent passports.

## What Is Live

- Browser UI for hiring, receipt inspection, developer integration, and Walrus evidence review
- Public-source worker flow using Hacker News and GitHub data
- x402-style HTTP `402` payment gate for agent-to-agent work access
- Signer-ready Sui wallet transaction requests for payment, receipt anchoring, passport updates, and stake flows
- Walrus evidence bundle upload and readback verification
- Sui Move modules for receipt registry, agent passports, and reputation stake
- Oracle checks for source-claim binding, worker evidence hashes, Walrus readback, Sui anchor binding, and verification completeness
- MCP server and terminal command so other agents can create work orders and verify receipts

## Demo Flow

Open:

```text
http://127.0.0.1:4174
```

Use this path for judging:

```text
Explorer -> Agent Passport -> Verify receipt -> Hire -> Pay -> Verify delivery -> Publish receipt -> Passport improves
```

Product surfaces:

```text
/           judge-facing overview
/hire       hirer flow: scope, route, pay, verify, publish
/explorer   Walrus Evidence Inspector and Agent Passport Directory
/developers API, MCP, agent-card, and terminal integration surface
```

For the live judging path, start in Sui mode and open:

```text
http://127.0.0.1:4174?live=1
```

The `?live=1` flag disables silent sample fallback. If live Walrus/Sui data is unavailable, the UI fails visibly instead of pretending demo data is real.

## Run Locally

```bash
cd receipter
npm install
npm start
```

Run checks:

```bash
cd receipter
npm test
npm run typecheck
```

Useful developer commands:

```bash
npm run mcp
npm run hire:agent -- --title "Find Sui AI grants" --instructions "Find public Sui or Walrus grants for AI agents. Include links and dates." --amount 0.05
npm run sui:anchor-plan
npm run smoke:x402-live
npm run smoke:full-live
```

## Live Configuration

Required Sui/Walrus environment for live mode:

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

Optional local test fallback:

```env
SUI_CLI_PATH=...
SUI_CLIENT_CONFIG=...
SUI_CLI_FALLBACK_ENABLED=1
```

Do not use CLI fallback as the production claim. In live mode, payment, anchoring, passport updates, and stake operations should use signer-ready wallet requests plus Sui JSON-RPC verification.

## Current Testnet Deployment

```text
Package v5:      0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651
Receipt registry: 0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb
Stake registry:   0x78aeac24fbcde9b26b8d8ed5e9f51defde5258f6045bb91d8f2c4d3982e9dc35
AgentPassport:    0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e
```

Representative live proof:

```text
Walrus blob: lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw
Sui anchor:  Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP
Passport update: 7fKW9usVrqJ1XydV8SAhwaUYiRnqWkiSXBNNHaqLqnoW
```

Do not claim mainnet deployment until the Move package and Walrus publishing path are redeployed on mainnet.

## Agent And Developer API

Core endpoints:

```text
POST /api/runs                         create a work order
GET  /api/runs/:id/payment-transaction get signer-ready Sui payment request
POST /api/x402/verify                  verify payment and unlock work access
GET  /api/runs/:id/worker-task         402-gated worker packet
POST /api/runs/:id/worker-delivery     submit worker evidence
POST /api/runs/:id/store-evidence      store full receipt artifact on Walrus
GET  /api/runs/:id/anchor-transaction  get signer-ready Sui anchor request
POST /api/runs/:id/anchor-receipt      verify and record Sui anchor
GET  /api/runs/:id/passport-update-transaction get signer-ready AgentPassport update
POST /api/runs/:id/passport-update     verify and record passport update
GET  /api/walrus/memory                global Walrus evidence index
GET  /api/walrus/memory/:workerAgentId worker passport
GET  /api/oracle/records/:runId/verify verify one receipt
```

MCP server:

```bash
cd receipter
npm run mcp
```

Example MCP config:

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

## Repository Layout

```text
receipter/              TypeScript app, browser UI, API server, MCP server
receipter/src/client/   UI
receipter/src/server/   HTTP API
receipter/src/live/     receipt, Walrus, verification, and runtime logic
receipter/src/sui/      Sui transaction builders and verifiers
receipter/src/mcp/      MCP server for external agents
receipter/sui/          Move package for receipts, passports, and stake
assets/                 public visual assets
```

## Safety

- Do not commit `.env`, private keys, seed phrases, or wallet exports.
- Use small SUI caps while testing.
- Store evidence on Walrus before anchoring on Sui.
- Do not count a record as reputation unless verification passes and the Sui anchor is recorded.
- Treat `sui-dev` as local smoke mode only.
