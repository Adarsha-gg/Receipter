# Submission Draft - WalrusProof

## Project Name

WalrusProof

## One-Liner

Portable, verifiable reputation for AI agent work: every paid job becomes a Walrus memory blob, anchored on Sui, and reusable in the next trust decision.

## Short Description

WalrusProof turns agent work into durable, inspectable memory. A buyer creates a paid task, WalrusProof strips private context, compares worker-agent bids, records the verification rules, checks the delivered evidence, stores the full proof bundle on Walrus, and anchors the compact receipt on Sui.

The product is not a generic marketplace. The wedge is verifiable agent work memory: a worker's track record is made from prior completed jobs, not self-reported claims. Other agents, apps, and buyers can open the Walrus blob, verify the hash, and route future work using that portable history.

## Problem

AI agents are starting to do paid work, but their reputation is still brittle:

- buyers cannot tell what was actually sent to a worker
- private context can leak into worker prompts
- evidence is often just text in an app database
- reputation is self-reported and trapped inside one platform
- future buyers cannot independently verify prior work

For agent commerce to matter, completed work needs to become portable memory that anyone can inspect and verify.

## Walrus-Native Solution

WalrusProof uses Walrus as the source of truth for agent work memory:

1. Buyer defines a paid task, private notes, acceptance criteria, and checker pack.
2. WalrusProof creates a sanitized worker packet.
3. Worker agents submit bids with price, SLA, requested data, confidence, and risk flags.
4. The buyer or policy awards one bid.
5. The worker delivers evidence with source-backed claims.
6. WalrusProof verifies claim support and settlement readiness.
7. The full receipt/evidence bundle is stored as a Walrus blob.
8. The blob is read back and hash-checked.
9. A compact receipt is anchored on Sui.
10. The worker's Agent Passport updates and can be reused by the next trust gate.

This is why Walrus matters: the memory is persistent, portable, content-addressed, and independently readable through a public aggregator.

## Sui Integration

Sui is used for finality and economic security:

- Sui-denominated work/payment intent
- Sui package v5: `0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651`
- AgentPassport object: `0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e`
- receipt registry: `0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb`
- `tenderboard::receipts::anchor_receipt` emits `ReceiptAnchored`
- `reputation_stake` lets worker reputation be economically backed and slashed through an oracle-issued challenge decision
- configured stake oracle registry: `0x78aeac24fbcde9b26b8d8ed5e9f51defde5258f6045bb91d8f2c4d3982e9dc35`

Move package and schema names retain some internal `tenderboard` and `suiproof` prefixes as stable protocol identifiers. The public product name is WalrusProof.

## What Is Real

- API-backed product server
- browser operator console
- Agent Passport directory and Memory Inspector with record-level verify actions
- safe worker packet preview
- private-note exclusion and secret-pattern filtering
- worker bid board and award flow
- SUI-denominated payment cap and x402-style paid HTTP access on Sui, verified by a local Sui facilitator/verifier
- source-claim verification and settlement gate
- Walrus evidence storage with readback verification
- owner-bound Agent Passports
- global memory index and per-agent memory endpoints
- MemWal-compatible `MemoryStore` adapter shape, fake-client tests, and a live smoke command for credentialed MemWal writes
- Sui receipt anchoring on testnet
- oracle-gated stake/slash smoke on testnet
- deterministic seed data for three worker agents
- tests for privacy, receipts, trust/proof logic, Sui config, payment plans, memory, oracle challenge assessment, and worker scouting

## Live Proofs

- real run: `run_20260619170152_fh8zk6`
- real Walrus blob: `lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw`
- Sui receipt anchor tx: `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP`
- live payment tx: `Es2rZN4rvyhJ4GHTS4Cmcvi9JDsqj77UEZr5RNqNFMSU`
- configured-registry stake open tx: `Fj4pwsmP5QkTqqREGYAQzxxG66GXFhM4DjALs77i96sX`
- challenge decision tx: `GF8r7iieheTknpPKtXPbQqyD8PkeohopE9z56GijoSoy`
- slash tx: `3nGY1HoTgL1o55RWhJJhDxzQ2uQwBH25GteoH87uddXk`

## Best Track

Primary track: **Walrus**.

Why: WalrusProof is fundamentally a verifiable data and memory product for AI agents. Walrus is not file storage bolted on after the fact; it is the durable agent-memory layer that makes the product useful. Sui anchors the compact proof and enforces economic security around the reputation record.

Secondary fit: **Agentic Web**, because the worker selection, verification, payment gate, and challenge assessment are AI-agent workflows using Sui primitives.

## Why It Can Win

- Product & UX: a concrete Agent Passport and inspector surface, not just protocol plumbing.
- Real-world application: buyers need proof before autonomous agents can spend money or earn reputation.
- Technical implementation: Walrus blobs, public readback, Sui anchors, Move stake/slash, typed receipts, and tests.
- Presentation & vision: WalrusProof turns agent reputation from a platform score into portable work memory.

## Demo Flow

1. Open the Agent Passport directory.
2. Show three worker agents with prior jobs, support scores, Walrus counts, and anchored counts.
3. Open a passport and select a job.
4. Open the raw Walrus blob through the aggregator.
5. Verify the memory hash matches the anchored receipt.
6. Create a new paid task.
7. Compare worker bids and award one route.
8. Approve the SUI payment intent.
9. Show worker delivery, claim support, and settlement readiness.
10. Store the full proof bundle on Walrus.
11. Anchor the compact proof on Sui.
12. Show the passport update.
13. Show a weak evidence record that requires review and cannot be anchored automatically.

## Repository

https://github.com/Adarsha-gg/tenderboard-croo-hackathon
