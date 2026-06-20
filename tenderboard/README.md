# WalrusProof Market - Walrus-Native Agent Memory Market

WalrusProof Market is a Walrus-native operator console for hiring worker agents safely. It exists to make agent work durable and reusable: every task becomes a paid work order, every delivery must produce source-backed evidence, every completed run becomes a portable Walrus memory record, and Sui owns the agent passport, payment/finality rail, receipt anchor, and stake/slash accountability layer.

The core product is the Walrus memory layer plus a Sui-native agent identity object. Walrus stores the full evidence and memory; Sui owns the `AgentPassport`, gates access with SUI-denominated x402-style paid HTTP access, anchors compact proof hashes, and attaches slashable stake to the passport.

## Core Product Loop

1. Buyer writes task, private notes, acceptance criteria, checker pack, and max SUI payment.
2. WalrusProof Market strips private notes and secret-looking lines.
3. WalrusProof Market creates a worker-facing safe packet.
4. WalrusProof Market scores the worker route against prior Walrus memory before execution.
5. WalrusProof Market creates a verification manifest, memory scope, and Sui work order id.
6. Worker task access is guarded by an x402-style HTTP 402 challenge.
7. The challenge carries a Sui Payment Kit-compatible URI plus Payment Intent metadata for that exact work order.
8. Hirer agent retries with a Sui payment payload.
9. The local Sui facilitator/verifier for the x402-style flow verifies run, resource, nonce, amount, receiver, worker, and Sui settlement.
10. Worker agent receives the paid task packet and delivers source-backed evidence.
11. The verification layer checks claim-to-source binding, evidence strength, Walrus readiness, and settlement blockers.
12. Full receipt/evidence is stored as a Walrus memory bundle only after delivery.
13. The Walrus bundle becomes the worker's portable agent memory record.
14. Compact proof fields are committed to the Sui receipt registry only when verification is admissible.
15. The worker reputation passport updates only after the Sui receipt anchor is recorded.
16. The Sui `AgentPassport` object points at the latest Walrus blob, latest memory hash, latest Sui anchor digest, and stake position.
17. Future work orders use the worker's Walrus memory passport in the pre-run trust gate.

## Walrus Memory Layer

Walrus is the durable memory substrate, not a side upload. Every delivered run produces a `suiproof.agent_memory_record.v1` with task summary, claim counts, average claim support, evidence strength, settlement action, Walrus blob id, Sui anchor digest, and a stable memory hash. Records roll up into a `suiproof.agent_memory_passport.v1` per worker and into a global `walrusproof.memory_index.v1`.

The backend writes memory through an injectable `MemoryStore` interface. The default `WalrusMemoryStore` wraps the raw Walrus HTTP publisher/aggregator path used in live testnet runs, while keeping the server ready for a future `MemWalMemoryStore` without changing the product API.

Passports are now Sui-native at the contract layer: `tenderboard::agent_passport::AgentPassport` is an owner-held Sui object with agent id, Walrus metadata pointer, latest memory hash, latest Walrus blob id, latest Sui anchor digest, record counts, challenge/slash counters, and a stake position reference. The API passport still exposes `ownerAddress` and `ownership` for app-level verification.

The memory layer gives the app its loop:

- workers remember across jobs through portable Walrus records
- buyers can inspect the exact memory that influenced routing
- future trust decisions include prior Walrus-backed performance
- weak prior claim support lowers the trust score before dispatch
- Sui anchors are compact finality signals for the larger Walrus memory bundle

Memory API:

```text
GET /api/walrus/memory                 global Walrus memory index
GET /api/walrus/memory/:workerAgentId  worker Walrus memory passport
GET /api/runs/:id/memory               run-level Walrus memory record
```

## Sui Passport, Payment, And Finality Layer

Move package:

```bash
cd sui
sui client publish
```

Current testnet deployment:

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
```

Current live Sui-mode proof:

```text
Run:        run_20260619164447_9t7mn9
Payment:    DmH3uwtvvZsrnyG4gj9d8yj5UbisT6jyjGUeHxwgURSG
Walrus:     zxPV1VpSPiJCzRREbs6uqdz4M6Oc-low6JFs4oFs8Ss
Walrus URL: https://aggregator.walrus-testnet.walrus.space/v1/blobs/zxPV1VpSPiJCzRREbs6uqdz4M6Oc-low6JFs4oFs8Ss
Sui anchor: 9VjUCNMheL4MjAucxSPHgCZF4m62M4aAPbK6roH5PSJH
Verifier:   walrus_readback=passed, sui_anchor_binding=passed
```

Current live x402 Sui payment proof:

```text
Run:       run_20260619165718_nnxw1z
Payment:   7rQS8zmCkjJkxu469UbVSQsjxwD88eVNpkaB2VAZoaYN
Package:   0xe87a8b5c87cfbf8e3251bed02f0be8a45220512f3f17e341f2c677a0154d4a47
Event:     PaymentIntentRecorded
Verifier:  requestBound, nonceBound, amountBound, receiverBound, workerBound, suiSettlementVerified, replayProtected
```

Current full live product proof:

```text
Run:        run_20260619170152_fh8zk6
Payment:    Es2rZN4rvyhJ4GHTS4Cmcvi9JDsqj77UEZr5RNqNFMSU
Walrus:     lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw
Walrus URL: https://aggregator.walrus-testnet.walrus.space/v1/blobs/lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw
Sui anchor: Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP
Memory:     memory_1cd5c44288de305a
Verifier:   memory_hash, source_receipt_hash, worker_evidence_hash, walrus_binding, sui_anchor_binding, walrus_readback all passed
```

After publishing, configure:

```env
TENDERBOARD_MODE=sui
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_OPERATOR_ADDRESS=...
SUI_PACKAGE_ID=0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651
SUI_RECEIPT_REGISTRY_ID=0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb
SUI_CLI_PATH=C:\Users\adars\.sui-bin\testnet-v1.73.1\sui.exe
SUI_CLIENT_CONFIG=C:\Users\adars\.sui\sui_config\client.yaml
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
```

The configured Walrus Testnet endpoints are the Mysten Labs reference publisher and aggregator from the Walrus Network Reference. Mainnet does not provide a public unauthenticated publisher, so production uploads need a private authenticated publisher, upload relay, or SDK integration.

Export a call plan:

```bash
npm run sui:anchor-plan <run-id>
```

In live `sui` mode, clients request signer-ready transaction data from `GET /api/runs/:id/payment-transaction` and `GET /api/runs/:id/anchor-transaction`. Payment settlement is accepted through `/api/x402/verify`; receipt anchoring is accepted through `POST /api/runs/:id/anchor-receipt` with the structured `anchorPayload` returned by the wallet flow. Raw `suiPaymentDigest` and `suiAnchorDigest` bypasses are rejected in live mode. `SUI_CLI_PATH` remains an explicit test-only fallback.

Do not claim mainnet anchoring until the package and Walrus publisher path are redeployed on mainnet.

In `sui` mode payment approval requires a verified signed x402-style Sui payment payload, the Walrus evidence step uses the configured HTTP publisher, and the Sui anchor step verifies the signed receipt-registry transaction through Sui JSON-RPC events before recording the digest. `sui-dev` remains a local smoke mode only; do not use it for the hackathon demo pitch.

WalrusProof Market generates Payment Kit-compatible URI metadata for SUI payment approval planning. Worker task access is exposed as x402-style paid HTTP access for agents on Sui: unpaid worker requests receive HTTP `402` with Sui payment instructions, and paid requests receive the task packet with an `X-Payment-Response` header bound to the recorded Sui transaction digest.

The app includes its own local Sui facilitator/verifier for this x402-style flow. In `sui` mode it calls `SUI_RPC_URL` with `sui_getTransactionBlock` and verifies successful execution, receiver balance change, a package-owned `PaymentIntentRecorded` event, Payment Kit nonce binding, request/resource binding, amount, receiver, coin type, worker id, and replay protection before unlocking the worker task. This is not a Coinbase-hosted facilitator and not an official Sui x402 network standard.

## Verification Layer

WalrusProof Market treats payment, delivery, memory admission, clearing, and reputation as separate gates. Delivery text alone is not settlement-grade memory. Each receipt gets a verification summary with:

- `admissibility`: `pending`, `insufficient`, or `admissible`
- `evidenceStrength`: `none`, `delivery_only`, `source_receipt`, `walrus_backed`, or `sui_anchored`
- `blockerIds`: unresolved checks that prevent clearing
- `settlementEligible`: true only when non-reputation blockers are cleared
- `reputationEligible`: true only after Sui anchoring

For research work, source-backed claims must be bound to observations in the worker source receipt. Each claim receives a support verdict: `supported`, `weak`, `stale`, `unbound`, or `contradicted`. The checker compares claim URL, title, statement, source record, record hash, and freshness. If claims are missing, stale, weak, malformed, or not bound to observations, clearing moves to `requires_review`, settlement action becomes `manual_review`, and Sui anchoring is blocked even if a Walrus blob exists.

## Competitive Positioning

Agent memory is an active category. The leading products prove the need, but most focus on app-local context retrieval rather than verifiable, portable work memory.

| Product | What they have | What they do not have that WalrusProof adds |
| --- | --- | --- |
| Mem0 | Drop-in persistent memory for agents and apps, SDK integrations, memory compression, governance, audit logs, and enterprise controls. | No Walrus-backed portable memory bundle, no Sui payment-gated work order, no source-claim admission gate, no on-chain finality for compact memory proofs. |
| Zep / Graphiti | Enterprise agent memory with temporal context graphs, business/user/work memory, and benchmarked graph retrieval. | No decentralized blob memory layer, no paid agent-work marketplace, no Sui receipt registry anchor, no settlement blocker model before memory admission. |
| Letta | Stateful agents with memory blocks, shared memory, archival memory, long-running executions, and multi-agent patterns. | No Walrus-native storage target by default, no worker reputation passport derived from stored evidence, no x402-style Sui payment unlock, no proof object tying memory to payment and source evidence. |
| LangGraph memory | Short-term thread checkpoints and long-term memory stores for semantic/profile/episodic/procedural memory. | Framework primitives rather than a product loop; no durable Walrus memory ledger, no payment-bound agent marketplace, no automatic source-claim clearing, no Sui finality rail. |
| Plain RAG/vector DBs | Fast retrieval, embeddings, and app-specific context search. | Retrieval is not memory governance: no source-backed admission, no worker performance passport, no portable blob proof, no payment/finality coupling. |

WalrusProof does not try to beat these products at generic personalization memory. It focuses on a narrower wedge: **verifiable agent work memory**. A worker does a paid job, the system checks the evidence, Walrus stores the full memory artifact, Sui anchors the compact proof, and the next buyer can route work using that prior memory.

Sources used for this positioning:

- Mem0: https://mem0.ai/
- Zep: https://www.getzep.com/
- Letta docs: https://docs.letta.com/guides/core-concepts/stateful-agents
- LangGraph memory docs: https://docs.langchain.com/oss/javascript/concepts/memory
- Walrus docs: https://docs.wal.app/
- Walrus paper: https://arxiv.org/abs/2505.05370

## Run

```bash
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

For the live judging/demo path, use `TENDERBOARD_MODE=sui` with the Sui and Walrus testnet env vars above, then open:

```text
http://127.0.0.1:4174?live=1
```

With `?live=1`, `?judging=1`, or `?mode=judging`, the downloaded UI fails loudly if `/api/walrus/memory` is unavailable instead of falling back to bundled sample records. Without those flags, bundled records are allowed only as clearly labeled sample data for UI review.

## Commands

```bash
npm test
npm run typecheck
npm run proof:latest
npm run sui:anchor-plan
npm run sui:x402-pay -- <run-id>
npm run smoke:x402-live
npm run smoke:full-live
```

## Agent API

The browser uses the same API external agents can call:

```text
POST /api/runs                         hirer agent creates a safe Sui work order
GET  /api/runs/:id/payment-transaction hirer gets signer-ready Sui payment transaction data
POST /api/x402/verify                  local Sui facilitator/verifier checks payment and unlocks work
POST /api/runs/:id/approve-payment     sui-dev or explicit CLI fallback only
GET  /api/runs/:id/agent-handoff       worker agent reads the awarded handoff
GET  /api/walrus/memory                read the global Walrus memory index
GET  /api/walrus/memory/:id            read the worker's Walrus memory passport
GET  /api/runs/:id/memory              read a run's Walrus memory record
GET  /api/agents/:id/memory            read the worker's Walrus/Sui memory passport
GET  /api/oracle/owners/:address/passport/verify verify a passport by Sui owner address
GET  /api/stake/oracle-registry-transaction get signer-ready stake oracle registry tx
POST /api/stake/open-transaction       get signer-ready SUI stake-open transaction
POST /api/stake/attach-transaction     get signer-ready add-stake transaction
POST /api/stake/challenge-transaction  get signer-ready challenge-decision transaction
POST /api/stake/resolve-challenge-transaction get signer-ready slash-with-decision tx
POST /api/stake/slash-transaction      get signer-ready direct challenge-and-slash tx
POST /api/stake/verify                 verify signed stake/challenge/slash tx through Sui RPC
GET  /api/runs/:id/worker-task         worker agent gets 402 until Sui payment is recorded
POST /api/runs/:id/worker-delivery     worker agent submits delivery evidence
POST /api/runs/:id/store-evidence      operator stores the memory bundle on Walrus
GET  /api/runs/:id/anchor-transaction  operator gets signer-ready Sui anchor transaction data
POST /api/runs/:id/anchor-receipt      operator submits verified anchorPayload from signed Sui tx
```

CLI/dev-only today: explicit backend Sui CLI fallback for payment and receipt anchoring; the built-in Opportunity Scout delivery helper; `sui-dev` deterministic local smoke mode; and credentialed MemWal smoke unless MemWal env vars are configured. Live stake, challenge, and slash routes produce signer-ready transaction requests and verify the signed Sui transaction through RPC events. In production, an external worker agent should submit its own delivery and source evidence.

## Important Files

```text
src/server/httpServer.ts       product API server
src/client/                    browser UI
src/agents/opportunityScout.ts public-source worker task
src/live/suiRuntime.ts         Sui-shaped local execution helpers
src/live/walrusRuntime.ts      Walrus evidence bundle storage
src/live/memoryStore.ts        injectable memory backend interface
src/live/agentMemory.ts        Walrus-backed worker memory records/passports
src/oracle/                    lightweight oracle client for external integrations
src/live/proof.ts              receipt-to-markdown proof renderer
src/sui/anchorPlan.ts          receipt-to-Sui call plan renderer
sui/                           Sui Move passport, receipt registry, and reputation stake package
```

## Safety Rules

- Do not commit `.env`.
- Do not paste private keys or seed phrases.
- Use tiny SUI caps while testing.
- Upload evidence to Walrus before final Sui anchoring.
- Approve payment only after the UI shows the Sui work order id.
