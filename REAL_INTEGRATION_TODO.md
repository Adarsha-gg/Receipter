# Real Integration TODO

Last updated: 2026-06-20

This file tracks the places where Receipter still uses local CLI, demo, metadata-only, or operator-assisted paths. These are acceptable for hackathon smoke tests, but they should not be described as finished production integrations.

## Must Fix Before Calling It Production

- [x] Replace backend Sui CLI payment execution with real wallet / sponsored transaction flow.
  - Completed: live Sui mode exposes `/api/runs/:id/payment-transaction` for wallet signing and requires `/api/x402/verify` for settlement verification. CLI payment is now an explicit test-only fallback.
  - Files: `receipter/src/server/httpServer.ts`, `receipter/src/sui/paymentExecutor.ts`.
  - Real version: frontend builds a Sui transaction block, wallet signs it, backend verifies it through the local Sui facilitator/verifier for the x402-style flow before unlocking worker access.

- [x] Replace backend Sui CLI receipt anchoring with a signed transaction flow.
  - Completed: live Sui mode exposes `/api/runs/:id/anchor-transaction` for wallet signing and requires an `anchorPayload` whose transaction is verified through Sui JSON-RPC events before recording the anchor. CLI anchoring is now an explicit test-only fallback.
  - Files: `receipter/src/server/httpServer.ts`, `receipter/src/sui/anchorExecutor.ts`.
  - Real version: app builds the anchor transaction, user/operator signs, backend verifies emitted receipt-registry event and stores the digest.

- [x] Replace backend Sui CLI stake / challenge / slash execution with real signer flows.
  - Completed: live Sui mode exposes signer-ready stake transaction requests for opening stake, attaching stake, creating the oracle registry, raising challenges, resolving challenge decisions, and direct slash flows. `/api/stake/verify` checks the signed transaction through Sui JSON-RPC events before accepting it.
  - Files: `receipter/src/sui/stakePlan.ts`, `receipter/src/sui/stakeVerifier.ts`, `receipter/src/server/httpServer.ts`.
  - Real version: signer-controlled PTBs for opening stake, challenging, resolving, and slashing, with event verification after execution.

- [x] Remove the unverified manual digest bypass from payment approval.
  - Completed: live Sui mode rejects raw `suiPaymentDigest` on `/api/runs/:id/approve-payment`; callers must submit a signed x402 payment payload to `/api/x402/verify`.
  - Risk: a UI or caller can submit a digest unless every path routes through `/api/x402/verify`.
  - Real version: only accept payment via verified x402 payload or server-built signed transaction result.

- [x] Upgrade Payment Kit from metadata-only URI to real wallet UX.
  - Completed: configured live Sui runs now carry `paymentKitMode = sui_wallet_transaction_request`, `paymentKitCompatibility = sui:wallet-standard-sign-and-execute-v1`, and an embedded signer-ready `walletTransactionRequest`. Underconfigured/local smoke runs keep the metadata-only `sui:pay` URI fallback.
  - File: `receipter/src/sui/paymentPlan.ts`.
  - Real version: wallet connect, transaction preview, explicit signing, digest returned to verifier.

## Walrus / Memory Gaps

- [ ] Run a credentialed live MemWal flow, not just adapter/test coverage.
  - Current: MemWal adapter and smoke harness exist, but config says `memwalConfigured: false`.
  - Files: `receipter/src/live/memoryStore.ts`, `receipter/src/cli/runLiveMemWalSmoke.ts`.
  - Real version: `MEMWAL_DELEGATE_KEY`, `MEMWAL_ACCOUNT_ID`, and `MEMWAL_SERVER_URL` configured; every accepted receipt is remembered and recallable through MemWal.

- [ ] Add Seal encryption for private/deep memory.
  - Current: private notes are sanitized and excluded, but there is no live Seal encryption/decryption policy.
  - Real version: buyer-private evidence is Seal-encrypted, access is time-boxed, and decrypt/readback is verified.

- [x] Decide whether to use Harbor or raw public Walrus publisher for the submission.
  - Completed: current submission path is raw public Walrus publisher/aggregator. Harbor remains an explicit unimplemented strategy, not a claim.
  - Real version: either keep raw Walrus and say so, or wire Harbor if we want Seal-by-default / managed upload semantics.

## Sui Identity / Passport Gaps

- [ ] Bind every worker passport shown in the UI to an actual Sui `AgentPassport` object.
  - Current: one live passport object exists, but some generated passport index entries still show `ownership.proof = unbound`.
  - Files: `receipter/src/live/agentMemory.ts`, `receipter/src/client/index.html`.
  - Real version: every worker profile displays owner address, passport object ID, latest memory pointer, latest Walrus blob, and latest Sui anchor from chain-backed state.

- [x] Update the Sui `AgentPassport` object after every new accepted run.
  - Completed: anchored runs expose `/api/runs/:id/passport-update-transaction`, which uploads the current memory index to Walrus, builds an owner-signed `agent_passport::update_memory_pointer` transaction request, and verifies the resulting `AgentPassportMemoryUpdated` event through `/api/runs/:id/passport-update`.
  - Files: `receipter/src/sui/agentPassportTransaction.ts`, `receipter/src/sui/agentPassportVerifier.ts`, `receipter/src/server/httpServer.ts`.
  - Product note: because the Move object is owner-gated, the update is signer-controlled rather than a silent backend write.

## Product / Demo Honesty

- [x] Remove or clearly gate bundled demo records in the downloaded UI.
  - Completed: `index.html` now labels bundled records as sample data when the live API fails, and `?live=1` / `?judging=1` / `?mode=judging` fails loudly instead of falling back.
  - File: `receipter/src/client/index.html`.
  - Real version: judging/demo mode should fail loudly if the live API is unavailable, or show a visible "sample data" label.

- [x] Replace built-in worker delivery with real external worker agent submission.
  - Completed: `/worker-delivery` requires `receipter.external_worker_delivery.v1` payloads in production; built-in Opportunity Scout delivery is restricted to explicit `sui-dev` fallback.
  - Files: `receipter/src/server/httpServer.ts`, `receipter/src/live/suiRuntime.ts`.
  - Real version: a separate worker agent signs/submits delivery and source evidence, or an agent runtime does it through an authenticated API key / wallet identity.

- [x] Keep `sui-dev` mode out of the hackathon pitch.
  - Completed: README, app README, submission package, and track plan now frame `sui-dev` only as local smoke/dev mode.
  - Files: `receipter/src/live/config.ts`, `receipter/src/live/suiRuntime.ts`, `receipter/src/live/walrusRuntime.ts`.
  - Real version: demo and submission should use `RECEIPTER_MODE=sui` with real Walrus blob IDs and real Sui tx digests.

- [x] Be precise about x402 language.
  - Completed: docs now describe Sui-native x402-style paid HTTP access with a local Sui facilitator/verifier, not a Coinbase-hosted facilitator or official Sui x402 standard.
  - Files: `receipter/src/sui/facilitator.ts`, `receipter/src/live/x402.ts`.
  - Real wording: "x402-style paid HTTP access for agents on Sui, with a local Sui facilitator/verifier."

## Nice To Have After Core Loop

- [ ] Add wallet connect for Sui.
- [ ] Add zkLogin onboarding for non-crypto users.
- [ ] Add sponsored gas for first-time buyers.
- [x] Add a production operator key policy instead of `.env` local key paths.
  - Completed: production live mode defaults to wallet-signed transaction requests. Local Sui CLI execution is now a test-only fallback that requires both a request-level `allowCliFallback` flag and `SUI_CLI_FALLBACK_ENABLED=1`; merely setting `SUI_CLI_PATH` / `SUI_CLIENT_CONFIG` is not enough.
- [x] Add replay-protection persistence outside local JSON files.
  - Completed: x402 payment verification writes nonce and transaction digest records to `x402-replay-ledger.json` under the receipts directory before unlocking the run.
  - Files: `receipter/src/live/replayLedger.ts`, `receipter/src/server/httpServer.ts`.
- [x] Add hosted deployment docs that do not depend on a local CLI.
  - Completed: `DEPLOYMENT.md` documents the live `RECEIPTER_MODE=sui` env, persistent receipts/replay storage, Walrus endpoints, signer-ready Sui transaction flow, and the no-local-CLI deployment path.
