# Real Integration PRs Milestones

## 2026-06-20

- Started parallel implementation push from `REAL_INTEGRATION_TODO.md`.
- Spawned six implementation workers:
  - Worker A: Sui payment/anchor wallet transaction builders.
  - Worker B: Sui stake/challenge/slash signer transaction builders.
  - Worker C: MemWal, Seal, Harbor readiness and strategy seams.
  - Worker D: AgentPassport chain binding and update helpers.
  - Worker E: external worker delivery contract and validation.
  - Worker F: UI/demo honesty and wording cleanup.
- Found GitHub CLI auth blocker:
  - `gh auth status` reports invalid token for `Adarsha-gg`.
  - Local branches can be prepared, but GitHub PRs cannot be opened until `gh auth login -h github.com` is repaired.
- Found mixed dirty `main`; coordinator must avoid staging unrelated files blindly.

## Combined Worker Result

- Worker A completed Sui wallet transaction builders for payment and receipt anchoring.
- Worker B completed Sui stake/challenge/slash wallet request builders.
- Worker C completed MemWal readiness checks plus Seal/Harbor integration seams.
- Worker D completed AgentPassport chain binding and update helpers.
- Worker E completed external worker delivery payload validation and restricted built-in worker delivery to explicit `sui-dev` fallback.
- Worker F completed UI/demo honesty cleanup and x402 wording cleanup.

Validation from the combined checkout:

- `npm.cmd run typecheck` passed.
- `npm.cmd test` passed: 22 test files, 92 tests.

PR draft details are tracked in `PR_DRAFTS.md`.

Remaining process blocker:

- GitHub PRs cannot be opened until `gh auth login -h github.com` is repaired. `gh auth status` currently reports an invalid token for `Adarsha-gg`.

## Signed Wallet Flow Follow-Up

- Merged PR #1 into `main`.
- Started branch `codex/wallet-signed-flow`.
- Added live-mode payment signing endpoint:
  - `GET /api/runs/:id/payment-transaction`
  - `POST /api/x402/verify` remains the only live payment recording path.
  - Raw `suiPaymentDigest` is rejected in live `sui` mode.
- Added live-mode anchor signing endpoint:
  - `GET /api/runs/:id/anchor-transaction`
  - `POST /api/runs/:id/anchor-receipt` now accepts structured `anchorPayload` and verifies Sui JSON-RPC events.
  - Raw `suiAnchorDigest` is rejected in live `sui` mode.
- Validation:
  - `npm.cmd run typecheck` passed.
  - `npm.cmd test` passed: 22 files, 93 tests.

## Stake Signer Flow Follow-Up

- Started branch `codex/stake-signer-flow`.
- Added live-mode stake signing endpoints:
  - `GET /api/stake/oracle-registry-transaction`
  - `POST /api/stake/open-transaction`
  - `POST /api/stake/attach-transaction`
  - `POST /api/stake/challenge-transaction`
  - `POST /api/stake/resolve-challenge-transaction`
  - `POST /api/stake/slash-transaction`
  - `POST /api/stake/verify`
- Added Sui RPC verification for successful stake/challenge/slash transactions and expected `reputation_stake` events.

## AgentPassport Update Follow-Up

- Started branch `codex/passport-anchor-update`.
- Added `TENDERBOARD_WORKER_AGENT_PASSPORT_OBJECT_ID` so worker memory passports can bind to an actual owner-held Sui object.
- Added anchored-run passport update flow:
  - `GET /api/runs/:id/passport-update-transaction`
  - `POST /api/runs/:id/passport-update`
- The update flow stores the current memory index on Walrus, builds an owner-signed `agent_passport::update_memory_pointer` transaction request, and verifies the signed transaction through Sui RPC by checking `AgentPassportMemoryUpdated`.

## Replay Ledger Follow-Up

- Started branch `codex/replay-ledger`.
- Added file-backed x402 replay ledger:
  - records nonce tuple and Sui transaction digest in `x402-replay-ledger.json`
  - rejects duplicate nonce tuples and duplicate transaction digests across process restarts
  - wires the ledger into `/api/x402/verify` and x402 worker-task header settlement
