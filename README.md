# WalrusProof

WalrusProof is a Walrus-native reputation layer for AI agent work.

It turns every paid agent job into a verifiable proof-of-work memory: sanitized task packet, worker bid, SUI payment intent, source-checked evidence, Walrus evidence blob, Sui receipt anchor, and an owner-bound agent passport that other products can verify.

## What It Does

1. A buyer writes a paid task, private notes, acceptance criteria, and a checker pack.
2. WalrusProof removes private/secret-looking content before anything reaches the worker.
3. WalrusProof creates a trust decision: score, tier, verdict, reasons, controls, and risk multiplier.
4. WalrusProof creates a verification manifest with spec hash, checker pack, acceptance criteria, required checks, settlement rule, and reputation write-back note.
5. WalrusProof creates a Sui-shaped work order and requires explicit payment approval.
6. The worker delivers evidence.
7. The full receipt/evidence payload is stored as a Walrus evidence bundle.
8. The compact proof pointer is anchored to the Sui receipt registry.

The wedge is simple: agents can do paid work, but buyers need proof of what was sent, why the worker was trusted, what "done" meant, where evidence lives, and why payment should count as reputation.

The longer-term product is portable agent reputation: safe task intake, privacy labels, worker-agent bids, budget/risk filtering, Walrus evidence, Sui receipt-backed reputation, and SUI stake that can be slashed for provably fraudulent records.

## What Is Implemented

- API-backed browser operator console
- safe worker packet preview
- private-note exclusion
- env-style secret detection
- SUI-denominated payment cap
- buyer-defined acceptance criteria
- checker packs: `research`, `code`, `commerce`
- trust decision in each receipt
- verification manifest in each receipt
- Sui Move receipt registry package
- Sui/Walrus readiness checks
- Walrus evidence-bundle storage flow
- optional MemWal semantic memory overlay behind `MEMORY_BACKEND=memwal`
- Sui receipt-anchor flow
- owner-bound agent memory passports
- Sui `reputation_stake` module for worker stake, challenge, and slash
- oracle challenge assessment endpoint: `POST /api/oracle/records/:runId/challenges/assess`
- TypeScript oracle client for passport verification and stake challenge assessment
- Sui anchor-plan export
- live Sui testnet proof:
  - package v4: `0x168c0db7d093e00b54562480783480501eee5387f0d71b01f73b12758b2608bc`
  - receipt registry: `0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb`
  - real Walrus blob: `lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw`
  - receipt anchor tx: `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP`
  - configured-registry stake/slash txs: open `Fj4pwsmP5QkTqqREGYAQzxxG66GXFhM4DjALs77i96sX`, decision `GF8r7iieheTknpPKtXPbQqyD8PkeohopE9z56GijoSoy`, slash `3nGY1HoTgL1o55RWhJJhDxzQ2uQwBH25GteoH87uddXk`
- receipt JSON downloads
- proof markdown export
- run history
- Opportunity Scout worker using public Hacker News and GitHub APIs
- tests for privacy, receipts, trust/proof logic, Sui config, anchor plans, and worker scouting

## Product Direction

WalrusProof should not become a generic marketplace or payment wrapper. The defensible lane is governed sourcing for agent work:

- publish only the safe worker-facing scope
- compare worker routes or bids by price, SLA, requested data, and risk
- block over-budget or unsafe routes before payment
- award one task into a Sui work order
- store evidence on Walrus and anchor reputation on Sui

## Repository Layout

```text
tenderboard/                                      main TypeScript app
tenderboard/sui                                  Sui Move receipt + reputation stake package
specs/2026-06-19-sui-overflow-tenderboard         Sui Overflow product spec
SUBMISSION.md                                     submission copy
DEMO_VIDEO_SCRIPT.md                              demo script
```

## Run Locally

```bash
cd tenderboard
npm install
npm start
```

Open:

```text
http://127.0.0.1:4174
```

## Run Checks

```bash
cd tenderboard
npm test
npm run typecheck
npm run proof:latest
npm run sui:anchor-plan
npm run smoke:memwal-live   # requires MEMORY_BACKEND=memwal plus MemWal credentials/package
npm run smoke:stake-live
```

## Deterministic Seed Data

```bash
cd tenderboard
npm run seed:memory
```

The seed drives the real HTTP loop with deterministic worker evidence. It now exits non-zero unless all 6 seeded records are Walrus-backed and Sui-anchored in the final memory index.

## Sui Setup

Current testnet deployment:

- package v4: `0x168c0db7d093e00b54562480783480501eee5387f0d71b01f73b12758b2608bc`
- receipt registry: `0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb`
- stake oracle registry: `0x78aeac24fbcde9b26b8d8ed5e9f51defde5258f6045bb91d8f2c4d3982e9dc35`
- upgrade cap: `0xc50924def84e7bcadb6aaaea58f887017903102ace49363f82b9e18bad698b7d`

To run live mode locally, set `SUI_OPERATOR_ADDRESS`, `SUI_PACKAGE_ID`, `SUI_RECEIPT_REGISTRY_ID`, `SUI_STAKE_ORACLE_REGISTRY_ID`, `SUI_CLI_PATH`, `SUI_CLIENT_CONFIG`, `WALRUS_PUBLISHER_URL`, and `WALRUS_AGGREGATOR_URL`.

## Memory Backend

Default:

```text
MEMORY_BACKEND=walrus
```

Optional MemWal overlay:

```text
MEMORY_BACKEND=memwal
MEMWAL_DELEGATE_KEY=...
MEMWAL_ACCOUNT_ID=...
MEMWAL_SERVER_URL=...
MEMWAL_NAMESPACE=walrusproof
```

In MemWal mode, WalrusProof still stores the full evidence bundle on raw Walrus, then writes a distilled searchable reputation fact to MemWal.

Live MemWal smoke:

```bash
cd tenderboard
MEMORY_BACKEND=memwal npm run smoke:memwal-live
```

The smoke requires `@mysten-incubation/memwal`, `MEMWAL_DELEGATE_KEY`, `MEMWAL_ACCOUNT_ID`, and `MEMWAL_SERVER_URL`. It uploads the full proof bundle to Walrus, calls MemWal `remember(...)`, then reads the Walrus blob back through the aggregator.
