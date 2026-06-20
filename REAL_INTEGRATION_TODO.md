# Real Integration TODO

Last updated: 2026-06-20

This file tracks the places where WalrusProof still uses local CLI, demo, metadata-only, or operator-assisted paths. These are acceptable for hackathon smoke tests, but they should not be described as finished production integrations.

## Must Fix Before Calling It Production

- [ ] Replace backend Sui CLI payment execution with real wallet / sponsored transaction flow.
  - Current: `approve-payment` can execute `sui client ptb` through `SUI_CLI_PATH`.
  - Files: `tenderboard/src/server/httpServer.ts`, `tenderboard/src/sui/paymentExecutor.ts`.
  - Real version: frontend builds a Sui transaction block, wallet signs it, backend verifies it through the local Sui facilitator/verifier for the x402-style flow before unlocking worker access.

- [ ] Replace backend Sui CLI receipt anchoring with a signed transaction flow.
  - Current: `anchor-receipt` can execute `sui client call` through `SUI_CLI_PATH`.
  - Files: `tenderboard/src/server/httpServer.ts`, `tenderboard/src/sui/anchorExecutor.ts`.
  - Real version: app builds the anchor transaction, user/operator signs, backend verifies emitted receipt-registry event and stores the digest.

- [ ] Replace backend Sui CLI stake / challenge / slash execution with real signer flows.
  - Current: stake operations require `SUI_CLI_PATH`.
  - File: `tenderboard/src/sui/stakeExecutor.ts`.
  - Real version: signer-controlled PTBs for opening stake, challenging, resolving, and slashing, with event verification after execution.

- [ ] Remove the unverified manual digest bypass from payment approval.
  - Current: live Sui mode can still accept `suiPaymentDigest` directly on `/api/runs/:id/approve-payment`.
  - Risk: a UI or caller can submit a digest unless every path routes through `/api/x402/verify`.
  - Real version: only accept payment via verified x402 payload or server-built signed transaction result.

- [ ] Upgrade Payment Kit from metadata-only URI to real wallet UX.
  - Current: `paymentKitMode` is `sui_pay_uri_metadata_only`.
  - File: `tenderboard/src/sui/paymentPlan.ts`.
  - Real version: wallet connect, transaction preview, explicit signing, digest returned to verifier.

## Walrus / Memory Gaps

- [ ] Run a credentialed live MemWal flow, not just adapter/test coverage.
  - Current: MemWal adapter and smoke harness exist, but config says `memwalConfigured: false`.
  - Files: `tenderboard/src/live/memoryStore.ts`, `tenderboard/src/cli/runLiveMemWalSmoke.ts`.
  - Real version: `MEMWAL_DELEGATE_KEY`, `MEMWAL_ACCOUNT_ID`, and `MEMWAL_SERVER_URL` configured; every accepted receipt is remembered and recallable through MemWal.

- [ ] Add Seal encryption for private/deep memory.
  - Current: private notes are sanitized and excluded, but there is no live Seal encryption/decryption policy.
  - Real version: buyer-private evidence is Seal-encrypted, access is time-boxed, and decrypt/readback is verified.

- [ ] Decide whether to use Harbor or raw public Walrus publisher for the submission.
  - Current: raw Walrus testnet publisher/aggregator works.
  - Real version: either keep raw Walrus and say so, or wire Harbor if we want Seal-by-default / managed upload semantics.

## Sui Identity / Passport Gaps

- [ ] Bind every worker passport shown in the UI to an actual Sui `AgentPassport` object.
  - Current: one live passport object exists, but some generated passport index entries still show `ownership.proof = unbound`.
  - Files: `tenderboard/src/live/agentMemory.ts`, `tenderboard/src/client/index.html`.
  - Real version: every worker profile displays owner address, passport object ID, latest memory pointer, latest Walrus blob, and latest Sui anchor from chain-backed state.

- [ ] Update the Sui `AgentPassport` object automatically after every new accepted run.
  - Current: the object was minted/updated in live smoke work, but the normal UI create flow must reliably update it after anchor.
  - Real version: anchor success triggers passport memory pointer update and event verification.

## Product / Demo Honesty

- [x] Remove or clearly gate bundled demo records in the downloaded UI.
  - Completed: `index.html` now labels bundled records as sample data when the live API fails, and `?live=1` / `?judging=1` / `?mode=judging` fails loudly instead of falling back.
  - File: `tenderboard/src/client/index.html`.
  - Real version: judging/demo mode should fail loudly if the live API is unavailable, or show a visible "sample data" label.

- [ ] Replace built-in worker delivery with real external worker agent submission.
  - Current: `/worker-delivery` can call the built-in Opportunity Scout worker for demoability.
  - Files: `tenderboard/src/server/httpServer.ts`, `tenderboard/src/live/suiRuntime.ts`.
  - Real version: a separate worker agent signs/submits delivery and source evidence, or an agent runtime does it through an authenticated API key / wallet identity.

- [x] Keep `sui-dev` mode out of the hackathon pitch.
  - Completed: README, app README, submission package, and track plan now frame `sui-dev` only as local smoke/dev mode.
  - Files: `tenderboard/src/live/config.ts`, `tenderboard/src/live/suiRuntime.ts`, `tenderboard/src/live/walrusRuntime.ts`.
  - Real version: demo and submission should use `TENDERBOARD_MODE=sui` with real Walrus blob IDs and real Sui tx digests.

- [x] Be precise about x402 language.
  - Completed: docs now describe Sui-native x402-style paid HTTP access with a local Sui facilitator/verifier, not a Coinbase-hosted facilitator or official Sui x402 standard.
  - Files: `tenderboard/src/sui/facilitator.ts`, `tenderboard/src/live/x402.ts`.
  - Real wording: "x402-style paid HTTP access for agents on Sui, with a local Sui facilitator/verifier."

## Nice To Have After Core Loop

- [ ] Add wallet connect for Sui.
- [ ] Add zkLogin onboarding for non-crypto users.
- [ ] Add sponsored gas for first-time buyers.
- [ ] Add a production operator key policy instead of `.env` local key paths.
- [ ] Add replay-protection persistence outside local JSON files.
- [ ] Add hosted deployment docs that do not depend on a local CLI.
