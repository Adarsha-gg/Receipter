# PR Drafts

GitHub PR creation is currently blocked because `gh auth status` reports an invalid token for `Adarsha-gg`.
After re-authentication, these can be turned into draft PRs.

## 1. Sui Wallet Transaction Builders

Branch: `codex/sui-wallet-transaction-builders`

Title: `Add Sui wallet transaction builders for payment and receipt anchoring`

Body:

```md
## Summary
- Add typed wallet-facing Sui transaction request objects for x402-style payment and receipt anchoring.
- Build payment PTB recipes with SUI transfer plus PaymentIntentRecorded marker.
- Build receipt anchor Move call recipes with typed object/u16/u64/vector args.
- Keep local `SUI_CLI_PATH` execution as fallback/test-only and return request/payload metadata.

## Tests
- npm.cmd run typecheck
- npm.cmd test
```

## 2. Stake Transaction Builders

Branch: `codex/sui-stake-transaction-builders`

Title: `Productionize stake transaction request builders`

Body:

```md
## Summary
- Add typed Sui stake wallet transaction request objects for open, attach, challenge, resolve, slash, and oracle registry paths.
- Add validation helpers for package/object ids, u64 MIST amounts, and Move UTF-8 text payloads.
- Keep CLI executor fallback and add attach-stake PTB fallback coverage.

## Tests
- npm.cmd run typecheck
- npm.cmd test
```

## 3. MemWal / Seal / Harbor Readiness

Branch: `codex/memwal-seal-harbor-readiness`

Title: `Harden MemWal readiness and add Seal/Harbor integration seams`

Body:

```md
## Summary
- Fail loud for incomplete MemWal production configuration.
- Add typed Seal privacy encryption seam with deterministic non-live test provider.
- Redact buyer-private upload payloads when encryption metadata is present.
- Add Walrus upload strategy selection for raw Walrus vs Harbor, with Harbor explicitly non-live/unimplemented.

## Tests
- npm.cmd run typecheck
- npm.cmd test

## Notes
- This does not claim live Seal or Harbor support.
```

## 4. AgentPassport Binding

Branch: `codex/agent-passport-binding`

Title: `Bind AgentPassport memory indexes to Sui ownership and update calls`

Body:

```md
## Summary
- Add explicit Sui AgentPassport binding metadata to Walrus memory passports and memory indexes.
- Include owner address, passport object id, latest memory pointer, latest Walrus blob, and latest Sui anchor digest.
- Add typed AgentPassport update transaction helpers for `agent_passport::update_memory_pointer`.
- Represent unbound and owner-only passports explicitly.

## Tests
- npm.cmd run typecheck
- npm.cmd test
- sui.exe move build
```

## 5. External Worker Delivery

Branch: `codex/external-worker-delivery`

Title: `Require external worker delivery payloads`

Body:

```md
## Summary
- Add a typed external worker delivery contract with worker/run/source evidence binding and optional identity proof metadata.
- Validate worker submissions before receipt storage, including source evidence hashes, claim binding, selected worker/run binding, and private data leakage checks.
- Restrict the built-in Opportunity Scout path to an explicit `sui-dev` demo fallback.

## Tests
- npm.cmd run typecheck
- npm.cmd test
```

## 6. Demo Honesty And Wording

Branch: `codex/demo-honesty-wording`

Title: `Clarify live demo honesty and x402-style Sui wording`

Body:

```md
## Summary
- Gate bundled UI sample records behind visible sample-data labeling.
- Make `?live=1`, `?judging=1`, and `?mode=judging` fail loudly if the live API is unavailable.
- Tighten docs around Sui-native x402-style paid HTTP access with a local facilitator/verifier.
- Keep `sui-dev` framed as local smoke/dev mode, not the hackathon pitch.
- Mark only completed honesty cleanup items in `REAL_INTEGRATION_TODO.md`.

## Tests
- npm.cmd run typecheck
- npm.cmd test
```
