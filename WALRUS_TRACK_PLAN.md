# WalrusProof — Walrus Track Build Plan

> Single source of truth for shipping WalrusProof into a Walrus-track winner.
> Target: **Walrus track — "Walrus as a Verifiable Data Platform for AI."**
> Status date: 2026-06-19.

---

## 0. North star (read this first)

**WalrusProof is verifiable agent *work* memory.** An AI agent does a paid job; the
system checks the evidence; Walrus stores the full memory artifact; Sui anchors the
compact proof; the next buyer routes work using that prior, independently-verifiable
memory.

We are **not** building "an agent that remembers my preferences" (personalization
memory — the crowded Mem0/Zep lane). Our wedge is the one thing those products do not
have: **payment-bound, source-checked, portable work memory with on-chain finality.**

Everything in this doc serves one sentence the judges should be able to repeat:

> *"Every paid agent job becomes a Walrus blob you can open and verify yourself,
> anchored on Sui — so agents build a track record nobody can fake."*

---

## 1. The product

- **One-liner:** Portable, verifiable reputation + memory for AI agents, stored on
  Walrus, anchored on Sui.
- **User-facing surface (the hero):** an **Agent Passport directory** — browse worker
  agents, open a passport, see every verified job, click any job to read its raw
  Walrus blob and confirm the on-chain hash matches.
- **Developer-facing surface:** a `MemoryStore` interface + **MemWal adapter** so any
  agent framework can write/read verifiable memory on Walrus the same way.
- **The loop (already implemented end to end in `sui-dev`):**
  task → safe packet → award worker bid → SUI payment (x402 gate) → worker delivery →
  source-claim verification → Walrus evidence blob → Sui receipt anchor → passport update →
  next job's trust gate reads prior memory.

### Why Walrus specifically (the judges will ask)
- **Portable:** memory is not locked in one app's Postgres; any agent/app reads the same
  blob via a public aggregator.
- **Verifiable:** the full evidence artifact is content-addressed; Sui anchors its hash,
  so a third party can prove the on-screen record equals what's on Walrus.
- **Persistent + censorship-resistant:** track records survive the originating app.
- S3 cannot tell this story. That is the whole point of the track.

---

## 2. Track rubric → feature mapping

| Rubric ask | Our answer | State |
| --- | --- | --- |
| Verifiable long-term memory | `agent_memory_record.v1` + `agent_memory_passport.v1` per worker | **built** |
| Persistent data/file access on Walrus | `storeEvidenceOnWalrus` → blob id + read URL | **built; real testnet round-trip proven** |
| Inspect/debug/manage agent memory on Walrus | global memory index + per-agent passport endpoints | **built (API); UI later** |
| Multi-agent coordination / task delegation | hirer agent ↔ worker bids ↔ award (`preferredBidId`) ↔ delivery | **built** |
| Artifact-driven workflows | evidence bundles generated, stored, **reused in next trust gate** | **built** |
| Long-running state over time | passports accrue track record across jobs | **built** |
| Tooling to help devs adopt Walrus / MemWal | `MemoryStore` interface + MemWal adapter | **backend built; live credentials/package install remain** |

**Gap to close:** visible inspector UI + live MemWal credential smoke. Real testnet blob readback,
Sui receipt anchor, deterministic seed data, MemWal backend shape, and oracle-gated stake/slash
are now proven.

---

## 3. Memory-layer decision (the coherence call)

**Decision: Walrus is the storage substrate. All memory I/O goes through one
`MemoryStore` interface with two interchangeable backends.**

```
MemoryStore (interface)
├── WalrusMemoryStore   → raw Walrus HTTP publisher/aggregator   (works today)
└── MemWalMemoryStore   → MemWal (Walrus Memory) via delegate key (Section 8)
```

- Selected at runtime: `MEMORY_BACKEND=walrus | memwal` (default `walrus`).
- The product, schemas, and UI never change when the backend changes.

**Why this is the most coherent + highest-scoring choice:**
- One concept ("verifiable agent work-memory"), not two competing systems.
- Covers **three** rubric buckets at once: user-facing product (Walrus), MemWal adoption,
  and developer tooling (the adapter others can reuse).
- No hard dependency risk: if MemWal access slips, the product still ships on raw Walrus.

Refactor required: today `httpServer.ts` calls `storeEvidenceOnWalrus` directly. Introduce
`MemoryStore` and inject it (mirrors the existing `scoutFetch`/`suiRpcFetch` injection
pattern in `TenderBoardServerOptions`).

---

## 4. Current state — what is REAL vs. what is NOT

### Real (verified this session)
- Product API server + 11 endpoints; browser console.
- Full loop runs end to end in `sui-dev`; `npm run seed:memory` produced **3 worker
  agents, 6 memory records, 6 Walrus(-dev) blobs, 2 Sui-anchored**.
- Multi-worker sourcing: `preferredBidId` award + 5 bid templates (3 publicly selectable).
- Verification gate genuinely refuses to anchor weak evidence (`requires_review`).
- Sui Move package `tenderboard::receipts` (source-level): `anchor_receipt`,
  `ReceiptAnchored`, `WorkerReputationUpdated`.
- 36/36 tests pass; typecheck clean.

### NOT real yet (must fix before submission)
- **No live MemWal smoke yet.** `MemWalMemoryStore` exists as a raw-Walrus + MemWal semantic
  overlay, but the environment still needs `@mysten-incubation/memwal`, delegate key, account id,
  and server URL for a real write.
- **No inspector UI** (passport directory / blob viewer / hash-match).
- **Identity is inconsistent** across files (see Section 12).
- **Stake/slash needs production hardening.** The backend executor is now oracle-gated, but the
  Move entrypoint itself is still permissive; production should require an oracle capability or
  signed challenge decision.

---

## 5. Target architecture

```
WalrusProof
├── Memory layer (NEW interface)
│   ├── MemoryStore (interface)
│   ├── WalrusMemoryStore   (raw Walrus HTTP)
│   └── MemWalMemoryStore    (MemWal delegate key)
├── Product API server (httpServer.ts)
│   ├── sourcing: bids + award (preferredBidId)
│   ├── x402 Sui payment gate + facilitator
│   ├── worker delivery + source-claim verification
│   ├── clearing/settlement gate (ready_to_anchor | requires_review)
│   └── memory endpoints (index / passport / record)
├── Sui Move package (receipts registry) — PUBLISH to testnet
├── Worker agent(s) (Opportunity Scout, public APIs)
├── Seed tooling (deterministic) — npm run seed:memory
└── Front-end
    ├── Operator console (existing)
    └── Agent Passport directory + Memory Inspector (NEW, later)
```

---

## 6. Data model (already implemented — keep stable)

- `tenderboard.scout_evidence.v1` — `{ query, sourceReceipt, claims[], evidenceHash }`.
- `suiproof.agent_memory_record.v1` — per job: task, claim counts, avg claim support,
  evidence strength, settlement action, Walrus blob id, Sui anchor digest, `memoryHash`,
  `marketplaceProof { paymentBound, workerSelected, sourceVerified, walrusStored, suiAnchored }`.
- `suiproof.agent_memory_passport.v1` — per worker: record list + rollups
  (memoryCount, walrusMemoryCount, anchoredMemoryCount, averageClaimSupport).
- `walrusproof.memory_index.v1` — global directory of passports.
- `tenderboard.sui.evidence.v1` — the full bundle stored on Walrus.

> Naming inconsistency to fix: schemas mix `suiproof.*`, `walrusproof.*`, `tenderboard.*`.
> Standardize the prefix when we lock the product name (Section 12).

---

## 7. Build backlog (prioritized, with acceptance criteria)

### Milestone A — Make it REAL on testnet (highest leverage)
1. **Real Walrus round-trip.** `npm run walrus:roundtrip`: store a memory bundle on Walrus,
   read it back, recompute and match `memoryHash`.
   - **Recommended path: Walrus Harbor** (managed REST API, **Seal encryption by default**,
     **sponsored = zero-cost testnet**, auto blob-lifetime extension). Removes
     publisher/aggregator plumbing and gives encrypted buyer-private fields for free. Needs a
     tiny server-to-server proxy (front end can't call Harbor directly). See `COMPETITORS.md`
     §Harbor for the flow (API key + service key, create bucket → seal policy id → encrypt →
     upload → poll status → download → decrypt-verify).
   - Fallback path: raw Walrus publisher/aggregator (already coded in `walrusRuntime.ts`).
   - *Done when:* console prints a real `blobId` + a read path that returns the same bytes, and
     hash matches.
2. **Publish Move package to testnet.** Install Sui CLI, `sui client publish`, capture
   `SUI_PACKAGE_ID` + `Registry` object id; anchor one real receipt via `sui:anchor-plan`.
   - **Done:** package upgraded to v3 `0x2aaaa1b3e8700ef4ef6313833a7f20d475c01fc6d933fbb052a2dc88f8c77320`;
     registry `0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb`;
     full proof anchor `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP` emitted `ReceiptAnchored`.
3. **Wire `sui` mode env** end to end so one full run produces a real blob **and** a real
   anchor digest.
   - **Done:** run `run_20260619170152_fh8zk6` produced real Walrus blob
     `lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw` and real anchor
     `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP`.
4. **Live economic security smoke.** Open a worker stake position and slash it with a challenge.
   - **Done:** oracle endpoint `/api/oracle/records/:runId/challenges/assess`;
     stake object `0xbf1dd4c52f762543b690786127e75ecc89bc30f2cb24427b12057d6abad99bdf`;
     open tx `H5HJmNXxnVZRGaxxw9KxMsCTzxwThC2CeKtwbUceGxBu`; slash tx
     `82cZpKKuqMa1SQLTp7g4CZpHYznvEz2Ai5V8dFRftAzy`; admitted on `memory_hash`,
     `walrus_readback`, and contradicted-claim failures.

### Milestone B — Credible, deterministic demo data
4. **Deterministic seed.** Inject a well-formed `workerEvidence: ScoutEvidence` (claims
   bound to observations) via the `worker-delivery` body so every seeded run reaches
   `ready_to_anchor` and anchors cleanly — independent of live API luck.
   - **Done:** `seed:memory` fails loudly on task errors or incomplete final index. Verified in
     `sui-dev`: 3 workers, 6 records, 6 Walrus-backed, 6 Sui-anchored.
5. **Seed variety.** 3 workers × 3–4 jobs with differing support scores (some `requires_review`
   on purpose) so the directory shows the gate working, not just green checks.

### Milestone C — Memory-layer abstraction + MemWal (Section 8)
6. `MemoryStore` interface; refactor server to inject it; `WalrusMemoryStore` wraps current code.
   - **Done:** `src/live/memoryStore.ts` defines the interface and default Walrus backend;
     `createTenderBoardServer` accepts an injected `memoryStore`.
7. `MemWalMemoryStore` backend behind `MEMORY_BACKEND=memwal`.
   - **Done:** backend writes the full proof bundle to raw Walrus, then writes a distilled
     reputation fact to MemWal via `remember(...)`.
8. Tests for both backends behind a fake transport.
   - **Done:** fake Walrus + fake MemWal client tests cover overlay behavior and SDK client creation.

### Milestone D — Visible product surface (UI, after the above)
9. **Agent Passport directory** page (reads `/api/walrus/memory`): cards per worker
   (jobs, avg support, SUI earned, walrus/anchored counts).
10. **Passport detail / Memory Inspector**: per-job timeline; each record shows Walrus blob
    id + **"Open on Walrus"** (aggregator link) + **"Verify"** (re-fetch blob, recompute
    `memoryHash`, show match).
11. Make the directory the front door; demote the operator console to "create a job".

### Milestone E — Submission polish
12. Identity cleanup (Section 12), demo video, README/SUBMISSION aligned, blob id + package
    id + explorer links pasted into the submission.

---

## 8. MemWal (Walrus Memory) integration plan

Goal: satisfy *"make it easier to adopt MemWal"* with a reusable adapter, not a one-off.

Steps:
1. Create a MemWal playground account; generate a **delegate key** for the agent.
2. Confirm the MemWal write/read API and memory object shape against the **MemWal GitHub
   repo + docs** (do not assume signatures — verify).
3. Implement `MemWalMemoryStore` with the same method surface as `WalrusMemoryStore`:
   - `putMemoryBundle(record) → { blobId, readUrl }`
   - `getMemoryBundle(blobId) → bundle`
   - `listWorkerMemory(workerAgentId)` (or rebuild from records if MemWal doesn't index).
4. Map our `agent_memory_record.v1` onto MemWal's memory primitive; keep `memoryHash`
   for the verify path.
5. Optional but strong: use **Seal** to encrypt buyer-private fields before storage, so
   "private notes never leave the boundary" is enforced cryptographically, not just by redaction.
6. Document a 10-line "add verifiable memory to your agent" snippet — this is the
   developer-tooling deliverable the rubric explicitly rewards.

References (from the track brief): Walrus docs (CLI/HTTP/TS SDK, public aggregators &
publishers), MemWal docs + playground + GitHub, Seal docs, Sui Stack Messaging.

---

## 9. Testnet realness checklist (env)

```
TENDERBOARD_MODE=sui
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_OPERATOR_ADDRESS=...
SUI_PACKAGE_ID=...
SUI_RECEIPT_REGISTRY_ID=...
WALRUS_PUBLISHER_URL=...
WALRUS_AGGREGATOR_URL=...
MEMORY_BACKEND=walrus            # or memwal
MEMWAL_DELEGATE_KEY=...          # if memwal
```
Then: publish package → set ids → run one job in `sui` mode → confirm real blob + real anchor.

---

## 10. Demo script (target)

1. Open the **Agent Passport directory** — 3 worker agents with real track records.
2. Open a passport — list of paid jobs, each with a Walrus blob id.
3. Click a job → **"Open on Walrus"**: raw evidence loads from the public aggregator.
4. Click **"Verify"**: recompute `memoryHash`, show it matches the Sui-anchored hash
   (explorer link to the `ReceiptAnchored` event).
5. Create a new job → compare worker bids → **award one** → SUI payment (x402 402→pay) →
   worker delivers → verification gate → Walrus blob → Sui anchor → **passport updates live**.
6. Show a `requires_review` record to prove the gate refuses weak evidence.
7. One line: "every record here is a Walrus blob anyone can verify — portable across apps,
   anchored on Sui."

---

## 11. Submission checklist

- [x] One real Walrus blob id + working aggregator read-back link in the submission.
- [x] Published Move package id + `Registry` id + explorer link to a `ReceiptAnchored` event.
- [x] One oracle-gated live stake/slash smoke transaction pair.
- [x] MemWal adapter merged (fake-client tested); live MemWal smoke remains.
- [ ] Passport directory + Verify-on-Walrus UI.
- [ ] Demo video following Section 10.
- [ ] README + SUBMISSION aligned to one product name.
- [ ] Tests green; typecheck clean.

---

## 12. Identity cleanup (do before submitting)

Current names are inconsistent and will confuse judges:
- repo `tenderboard`; package `walrusproof-market`; README "WalrusProof Market";
  SUBMISSION "SuiProof Market"; `hackathon.md` is a different "RetainerHub / CROO" project;
  schema prefixes mix `suiproof.*` / `walrusproof.*` / `tenderboard.*`.

Actions:
- Pick **one** name (recommend **WalrusProof**, matches the track).
- Make README / SUBMISSION / package.json / UI title agree.
- Standardize schema prefix (e.g. `walrusproof.*`) — or leave schema strings but document why.
- Move `hackathon.md` (RetainerHub/CROO) to `archive/` so it's not mistaken for this submission.

---

## 13. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Judges read back a fake `walrus-dev://` blob | Milestone A — one real testnet round-trip is non-negotiable. |
| Demo data looks broken (undefined support) | Milestone B — deterministic seed. |
| "Too much surface / vaporware" | Lead with passport + verify; keep x402/clearing as depth-on-demand. |
| MemWal access slips | `MemoryStore` keeps the product shippable on raw Walrus. |
| "Just another memory DB" | Emphasize verify-on-Walrus + Sui anchor — the un-fakeable part. |
| Name confusion | Section 12 cleanup. |

---

## Appendix — what changed this session
- Added `preferredBidId` award flow + 2 public worker bids under cap → 3 selectable workers.
- Added `npm run seed:memory` (drives the real loop over HTTP).
- Verified: 3 workers / 6 records / 6 Walrus(-dev) blobs / 2 anchored; 36 tests green.
- Open follow-up: deterministic seed (Milestone B #4) so all workers anchor reliably.
- Published package v3 with `reputation_stake`; ran oracle-gated live stake/slash smoke on Sui testnet.
- Added challenge assessment oracle and slash executor guard.
- Added `MemWalMemoryStore` semantic overlay behind `MEMORY_BACKEND=memwal`.
- Hardened `seed:memory` into an acceptance check; temp `sui-dev` smoke produced 3 workers / 6
  records / 6 Walrus-backed / 6 Sui-anchored.
- Current checks: 60 tests green; typecheck clean.
