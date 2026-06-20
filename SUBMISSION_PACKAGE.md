# WalrusProof Submission Package

## Project Name

WalrusProof

## Track

Primary track: Walrus

Secondary narrative fit: Agentic Web

## One-Liner

Portable, verifiable reputation for AI agent work: every paid job becomes a Walrus memory blob, anchored on Sui, and reusable in the next trust decision.

## Description

WalrusProof is a sovereign work-memory and reputation layer for AI agents. It turns completed agent jobs into portable proof records: a sanitized task packet, worker bid, SUI payment intent, source-checked evidence, full Walrus evidence bundle, compact Sui receipt anchor, and an owner-held Sui AgentPassport that future buyers can verify.

The core product is the Agent Passport directory. A judge can open a worker passport, inspect each job, open the raw Walrus blob, and run record-level verification against the stored memory hash and Sui anchor. This makes reputation portable across apps instead of trapped in one marketplace database.

## Why Walrus

Walrus is the product's memory substrate, not a side storage layer. The full proof bundle for each job is stored as a Walrus blob and exposed through a public aggregator link. That gives every agent record a portable, persistent artifact that can be opened and verified independently.

## Why Sui

Sui provides finality and economic security:

- compact receipt anchors through Move
- SUI-denominated payment intent
- worker reputation stake
- oracle-issued challenge decisions
- slash transactions for provably bad records

## Logo

`assets/walrusproof-logo.png`

## Public GitHub Repo

https://github.com/Adarsha-gg/tenderboard-croo-hackathon

## Website / Demo URL

Local demo server:

```text
http://127.0.0.1:4174
```

If deploying before submission, use the deployed app URL here.

Live judging URL for local review:

```text
http://127.0.0.1:4174?live=1
```

The `?live=1` path requires the live API. If the API is unavailable, the UI shows a failure instead of bundled sample records.

## Testnet Deployment

- Sui package v5: `0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651`
- receipt registry: `0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb`
- AgentPassport object: `0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e`
- stake oracle registry: `0x78aeac24fbcde9b26b8d8ed5e9f51defde5258f6045bb91d8f2c4d3982e9dc35`

## Live Proofs

- real run: `run_20260619170152_fh8zk6`
- real Walrus blob: `lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw`
- Sui payment tx: `Es2rZN4rvyhJ4GHTS4Cmcvi9JDsqj77UEZr5RNqNFMSU`
- Sui receipt anchor tx: `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP`
- stake open tx: `Fj4pwsmP5QkTqqREGYAQzxxG66GXFhM4DjALs77i96sX`
- passport mint tx: `D7c7uuvKuxvcMiWWc6DjrE1DoWu6dhTZ21vZnKNw3AbL`
- passport memory update tx: `7fKW9usVrqJ1XydV8SAhwaUYiRnqWkiSXBNNHaqLqnoW`
- passport stake attach tx: `9RRyreY2BBuKE6kxVffGqvJj8Yr5WQtN1bZYqL9LAVAP`
- challenge decision tx: `GF8r7iieheTknpPKtXPbQqyD8PkeohopE9z56GijoSoy`
- slash tx: `3nGY1HoTgL1o55RWhJJhDxzQ2uQwBH25GteoH87uddXk`

## What To Show In The Video

1. Open the Agent Passport directory.
2. Show 3 worker agents and the memory index rollups.
3. Open `sui_opportunity_scout`.
4. Open the real Walrus blob for `run_20260619170152_fh8zk6`.
5. Click Verify and show `verified: true`.
6. Create a new task.
7. Show worker bid filtering.
8. Approve payment, submit delivery, store Walrus evidence, anchor on Sui.
9. Show the passport updating.
10. Show a requires-review record to prove weak evidence does not automatically become reputation.

## Commands For Judges / Reviewers

```bash
cd tenderboard
npm install
npm test
npm run typecheck
npm start
```

Optional live checks:

```bash
npm run smoke:full-live
npm run smoke:stake-live
```

Optional MemWal check, only with MemWal credentials:

```bash
MEMORY_BACKEND=memwal npm run smoke:memwal-live
```

## Known Honest Limitations

- The credentialed MemWal live smoke requires `@mysten-incubation/memwal`, `MEMWAL_DELEGATE_KEY`, `MEMWAL_ACCOUNT_ID`, and `MEMWAL_SERVER_URL`.
- The current public product is local/demo-server first. Deploy the UI before submission if you want a hosted website URL.
- x402 is implemented as Sui-native x402-style paid HTTP access with a local Sui facilitator/verifier, not a Coinbase-hosted facilitator or official Sui x402 standard.
- Backend Sui CLI flows and the built-in worker delivery helper are demo/dev paths; production should use wallet/signer flows and external worker submission.
- Some internal package and schema names retain stable legacy identifiers (`tenderboard`, `suiproof`) to avoid breaking the deployed testnet package and existing receipts. Public branding is WalrusProof.
