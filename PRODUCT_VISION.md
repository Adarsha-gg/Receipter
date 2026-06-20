# WalrusProof — Product Vision (the big swing)

> Companion to `WALRUS_TRACK_PLAN.md` (execution backlog) and `COMPETITORS.md` (field).
> This doc is the ambitious direction: **stop building an agent app, build the trust rail.**

---

## 0. North star

**WalrusProof is the verifiable reputation layer for the agent economy.**

Every paid job an agent completes becomes an **un-fakeable, Walrus-stored, Sui-anchored
credential** that *any* marketplace, buyer, or agent — on *any* platform — can read and
cryptographically verify. We are not another agent and not another marketplace. We are the
**trust rail they all plug into.**

> One sentence for judges:
> *"An agent's reputation should be a portable credential it owns and anyone can verify — not a
> number trapped in one company's database. WalrusProof turns every completed paid job into a
> Walrus-backed, Sui-anchored proof-of-work that travels with the agent across the whole
> economy."*

---

## 1. The reframe (why this beats the field)

The Walrus track is crowded with **agents that have memory** (Synapse, ChronicleOS) and
**dev tools** (WalGit). They all store *their own* memory for *their own* product. The lane
nobody owns:

| Everyone else | WalrusProof |
|---|---|
| An agent that remembers **itself** | The layer where **all agents publish verifiable work history** |
| Memory is **internal** to one product | Reputation is **portable across products** (the whole point of Walrus) |
| "Trust me, here's my memory" | "Verify me — open the blob, check the hash, see the stake" |
| App (crowded, execution race) | **Protocol / infrastructure** (defensible, network effects) |

Synapse is a great *agent*. We are the rail Synapse's agent would **publish its track record
into.** Infrastructure beats app on defensibility, and it's a strictly bigger story.

**The market insight:** in agent commerce the bottleneck isn't storage or even payments — it's
**trust between agents that have never worked together.** A worker agent has no way to prove "I
did 50 research jobs, 94% claim-supported, all paid, all verifiable." Reputation today is
siloed, self-reported, and fakeable. WalrusProof makes it **portable, verifiable, and costly to
fake.**

---

## 2. The system — six layers (most already exist)

```
┌──────────────────────────────────────────────────────────────────┐
│ 6. EXPLORER  — "Etherscan for agent work." Browse any agent,      │
│    open any job's Walrus blob, verify any hash. Public, no wallet. │
├──────────────────────────────────────────────────────────────────┤
│ 5. REPUTATION ORACLE + SDK  — verifyPassport(agentId) → crypto-    │
│    verified track record. MCP server + LangGraph adapter + REST.   │
│    THIS is what makes it a protocol, not an app.                  │
├──────────────────────────────────────────────────────────────────┤
│ 4. ECONOMIC SECURITY  — agents STAKE SUI on their passport;        │
│    provably-fraudulent work is SLASHABLE. Reputation has cost.    │
├──────────────────────────────────────────────────────────────────┤
│ 3. TRUST ROUTING  — match a task to the worker whose VERIFIABLE    │
│    memory best fits; gate by budget/risk. (bidBoard + trustProof)  │
├──────────────────────────────────────────────────────────────────┤
│ 2. AGENT PASSPORT  — portable, self-sovereign reputation profile   │
│    owned by the agent's Sui address. (buildAgentMemoryPassport)   │
├──────────────────────────────────────────────────────────────────┤
│ 1. PROOF-OF-WORK MEMORY  — one verified paid job → Walrus evidence │
│    bundle + Sui hash anchor. The atomic credential. (agentMemory)  │
└──────────────────────────────────────────────────────────────────┘
        Storage: Walrus (+ Harbor) · Privacy: Seal · Finality: Sui
```

### Layer 1 — Proof-of-Work Memory (PoWM)  ✅ have it
The atomic unit. A completed paid job, source-claim-verified, full evidence stored on Walrus,
compact `memoryHash` anchored on Sui. **Exists:** `agentMemory.ts`, `walrusRuntime.ts`, Move
`anchor_receipt`. Net-new: make the blob + anchor real (Milestone A).

### Layer 2 — Agent Passport  ✅ have it
A portable profile aggregating an agent's PoWM records, **owned by its Sui address** (self-
sovereign, not our DB). Per-skill scores (research/code/commerce), volume, avg claim support,
SUI earned, anchored-job count. **Exists:** `buildAgentMemoryPassport`. Net-new: bind ownership
to a Sui address + a passport object on-chain that points at the Walrus record set.

**Update:** passport ownership is now implemented on Sui. Package v5 adds
`tenderboard::agent_passport::AgentPassport`, an owner-held Sui object that stores the agent id,
Walrus metadata pointer, latest memory hash, latest Walrus blob id, latest Sui anchor digest,
record counters, challenge/slash counters, and stake position reference. Live object:
`0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e`.

### Layer 3 — Trust Routing  ✅ have it
Given a task, rank workers by *verifiable* past performance and gate over-budget/unsafe routes.
**Exists:** `bidBoard.ts` (award flow), `trustProof.ts` (scoring against prior memory). Net-new:
score using on-chain-verified passports, not just local receipts.

### Layer 4 — Economic Security (staking + slashing)  🆕 the moat
Agents **stake SUI** on their passport. Cryptographic verification proves a record *exists*;
staking makes a *false* record **expensive**. If a delivered job is later shown fraudulent
(evidence hash mismatch, contradicted claims, non-existent Walrus blob), anyone can submit a
**challenge**; a successful challenge **slashes** the worker's stake and rewards the challenger.
This is the difference between "verifiable" and "trustworthy," and **no competitor has it.**

**Update:** the first live primitive is now deployed on Sui testnet in Move module
`reputation_stake`: open a worker stake position, add SUI stake, challenge a record by evidence
hash/reason, slash the position, and reward the challenger. Live smoke:
package `0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651`,
stake object `0x48273520a89927db522dd76c45ab333780998ec9ba336dc5d5666db8b44fc859`,
oracle registry `0x78aeac24fbcde9b26b8d8ed5e9f51defde5258f6045bb91d8f2c4d3982e9dc35`,
challenge decision `0xf3433158331908788eb465063f519be866f2e6393b4bc90629655af65a8c2f84`,
slash tx `GJz9y9nac2sgwMi9xp9PkuYryWU99wcgvbhAMyiYwCzA`. The slash was admitted only after
`memory_hash`, `walrus_readback`, and contradicted-claim failures were detected by the verifier,
then the Move slash consumed the oracle-issued `ChallengeDecision` object.

### Layer 5 — Reputation Oracle + SDK  ✅ API/SDK started
The adoption surface. Any marketplace/agent/buyer calls:
```ts
const rep = await walrusproof.verifyPassport(agentSuiAddress);
// → { jobs, skillScores, avgClaimSupport, stakedSui, slashes, lastVerifiedBlob }
//   every field independently recomputed from Walrus blobs + Sui events, not trusted from us
```
Ships as: an **npm SDK**, an **MCP server** (like WalGit — agents read reputation as a tool), a
**LangGraph adapter**, and a **REST endpoint**. This is the "developer tooling to adopt Walrus /
MemWal" the rubric explicitly rewards, and the thing that creates network effects.

**Update:** the REST endpoint and lightweight TypeScript client now exist:
`/api/oracle/passports/:workerAgentId/verify`, `/api/oracle/owners/:ownerAddress/passport/verify`,
`/api/oracle/records/:runId/challenges/assess`, and `createWalrusProofOracleClient()` with
`verifyPassport(...)`, `verifyPassportByOwner(...)`, `verifyRecord(...)`, and
`assessStakeChallenge(...)`. Remaining stretch: package it as npm/MCP/LangGraph.

### Layer 6 — The Explorer  🆕 the user-facing wow
A public **"Etherscan for agent work."** Search any agent → see its passport → open any job →
read the raw evidence **straight from Walrus** → click **Verify** to recompute the hash and match
it to the Sui anchor → see stake and any slashes. No wallet, no login. **This is the demo that
lands**, and it's built on endpoints you already serve.

---

## 3. Privacy & cross-agent sharing (Seal)  🆕

Public passports show *scores and proofs*; the *full evidence* can stay private. A worker
Seal-encrypts deep evidence and grants a **prospective buyer time-boxed decryption** so they can
**audit before they hire** ("try before you trust"). This hits three rubric items at once:
cross-agent memory sharing, Seal privacy, and artifact reuse. Pairs naturally with **Harbor**
(Seal-by-default, sponsored = zero-cost testnet).

---

## 4. The flywheel (why a judge sees a real company)

```
more agents publish PoWM  →  richer reputation graph  →  more marketplaces adopt the oracle
        ↑                                                              │
        └────────  agents go where their reputation is read  ◀─────────┘
```

Staking adds a second loop: high-reputation agents stake more → command higher pay / lower
escrow → reputation becomes a **yield-bearing economic asset**, not a vanity score.

---

## 5. What we already have vs. what's net-new

| Capability | Status | Module / action |
|---|---|---|
| Paid work-order loop (sourcing→pay→deliver→verify) | ✅ built | `httpServer.ts`, `bidBoard.ts`, `x402.ts` |
| Source-claim verification + admission gate | ✅ built | `trustProof.ts`, `clearingObjects.ts` |
| PoWM record + passport + global index | ✅ built | `agentMemory.ts` |
| Walrus evidence storage | ✅ live round-trip proven | real blob `lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw`; `walrusRuntime.ts` |
| Sui receipt anchor (Move pkg) | ✅ deployed + anchored | package v5 `0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651`; receipt anchor `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP` |
| Multi-worker award | ✅ built (this week) | `preferredBidId` |
| **Passport bound to Sui address** | ✅ on-chain object live | Move `agent_passport::AgentPassport`; object `0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e`; mint tx `D7c7uuvKuxvcMiWWc6DjrE1DoWu6dhTZ21vZnKNw3AbL` |
| **Stake + slash** | ✅ live primitive + oracle decision object | Move `reputation_stake`; `/api/oracle/records/:runId/challenges/assess`; decision tx `FCsWy75sSrheYpk2ah1B9MFLzbHodx6SHhu2396Lf4Li`, slash tx `GJz9y9nac2sgwMi9xp9PkuYryWU99wcgvbhAMyiYwCzA` |
| **Reputation Oracle SDK / MCP / LangGraph** | ✅ REST + TS client started | `src/oracle`; MCP/LangGraph remains |
| **Explorer UI (verify-on-Walrus)** | ✅ built | Agent Passport directory + per-record Verify action |
| **Seal-gated deep-memory sharing** | 🆕 | Seal + Harbor |
| **Cross-platform portability demo** | 🆕 | second "marketplace" frontend reading same passport |

Roughly **80% exists** for the hackathon submission; the remaining work is hosted deployment,
demo recording, and optional credentialed MemWal / Seal / MCP stretch integrations.

---

## 6. How it wins the Walrus track (rubric, head-to-head)

| Rubric ask | WalrusProof answer | Edge over field |
|---|---|---|
| Verifiable long-term memory | PoWM credential, hash-anchored | portable + **stake-secured**, not just stored |
| Persistent files on Walrus | every job's evidence bundle | the file **is** the credential, not a side log |
| Inspect/manage memory on Walrus | the **Explorer** (verify-on-Walrus) | public, walletless, recomputes hashes live |
| Multi-agent coordination | hire/route across strangers | **cross-buyer**, not intra-product like Synapse |
| Artifact-driven workflows | evidence reused in routing + audit | reused **across platforms** via the oracle |
| Long-running state | passports accrue + slash over time | economic state, not just logs |
| Dev tooling / MemWal adoption | Oracle SDK + MCP + LangGraph adapter | reusable rail, not a one-off app |
| Seal | audit-before-hire, encrypted deep memory | concrete cross-agent sharing use case |

**Versus Synapse specifically:** they're a vertical agent that remembers itself. We're the
horizontal rail their agent publishes into. When a judge asks "how is this different from
Synapse," the answer is one line: *"Synapse is an agent with memory; we're the reputation
protocol every agent — including Synapse — can publish to and be verified by."*

---

## 7. Phased build (each phase is demoable on its own)

**Phase 0 — Table stakes.** Complete: one real Walrus blob, one deployed + anchored Move receipt,
deterministic seed data, and live stake/slash proof.

**Phase 1 — The Explorer.** Complete: public passport directory + per-job Walrus link + **Verify**
button backed by `/api/oracle/records/:runId/verify`.

**Phase 2 — The Oracle SDK.** `verifyPassport()` as npm + REST + **MCP server**. Independent
re-verification from Walrus blobs + Sui events. The protocol moment.

**Phase 3 — Economic security.** Move `reputation_stake` module: stake on a passport, challenge a
record, slash on proof. **Oracle-decision live smoke is complete**: backend verifier gates
admissibility, Sui stores the `ChallengeDecision`, and `slash_with_decision` consumes that object.
Remaining production hardening is canonicalizing the oracle registry in config/governance.

**Phase 4 — Portability proof.** A second, differently-branded "marketplace" frontend reading the
**same** passport via the oracle — visually proving the reputation is portable, not ours. This is
the screenshot that wins the track.

**Phase 5 — Seal deep-memory + LangGraph adapter.** Audit-before-hire with Seal; one-line
integration into an existing agent framework.

---

## 8. The demo that wins (target)

1. Open the **Explorer** — a graph of agents with real, Sui-anchored job histories.
2. Pick a worker → open one job → **"Open on Walrus"** loads raw evidence from the aggregator →
   **"Verify"** recomputes the hash and matches the on-chain `ReceiptAnchored` event (Suiscan link).
3. Hire that worker from **Marketplace A** → it runs a real job → new PoWM credential anchors →
   passport updates live.
4. Open **Marketplace B** (totally different frontend) → the **same** verified passport is there.
   *"We never moved data — both apps read the agent's portable Walrus reputation."*
5. Submit a **forged** record → anyone challenges it → the worker's **stake gets slashed** on
   Suiscan. *"Reputation here isn't just verifiable — it's expensive to fake."*
6. One line: *"This is the trust rail for the agent economy, and every byte of it lives on
   Walrus."*

---

## 9. Identity

Public identity is **WalrusProof**. The old CROO/RetainerHub doc is archived, and submission
copy, demo script, README, logo, and UI all use the same public name.

---

## 10. Risks & honest scoping

- **Scope is large.** Phases 0–2 are the real submission; 3–5 are the vision multiplier. Ship 0–2
  solid before reaching. A working Explorer + Oracle + one real anchored blob already beats most
  of the field on the *protocol* angle.
- **Staking/slashing is the wow but also the hardest Move work.** If time-boxed, ship a **stub +
  spec + one live slash tx** rather than a full economic system — the *demonstrated mechanism*
  is what scores, not completeness.
- **Don't out-Synapse Synapse.** Do not add DeFi/treasury/enclave features — that's their turf.
  Stay horizontal: reputation, portability, verification, tooling.
- **Keep the trust-gate/x402 internals, drop them from the pitch.** The story is reputation +
  portability, not policy gating (Edge/Synapse own that).

---

## 11. High-leverage integrations (added 2026-06-19 — sponsor stack research) 🔥

> Flagged delta: these came out of researching the live Walrus/Sui stack. Each is real, shipping,
> and raises our ceiling. Adopt the first three; the fourth is a stretch wow.

### 11.1 MemWal as our semantic memory layer — **the blessed adoption path** ✅ adopt
MemWal (Walrus Memory) is a **real, shipping SDK** (`@mysten-incubation/memwal`, TS + Python) and
it gives us, for free, three things we were going to hand-roll: **semantic recall**, **Seal
encryption**, and **Sui-enforced ownership** — all scoped by `owner + namespace`.

Key facts (from MemWal `SKILL.md` / API ref):
- Methods: `rememberAndWait(text, namespace?)`, `recall({ query, limit?, namespace?, maxDistance? })`,
  `analyze(text)` (extract facts), `restore(namespace)`; lower-level `rememberManual({ blobId,
  vector, namespace })` + `recallManual({ vector })`.
- Every memory returns a **`blob_id`** (the Walrus blob) → still independently verifiable. 
- Delegate key + account ID from `memory.walrus.xyz` (Ed25519). Vercel AI SDK middleware
  (`withMemWal`) + OpenClaw/NemoClaw plugins already exist.
- **Important constraint:** MemWal is for **text memories, not large files.**

**Architecture decision (the bridge):**
- Full evidence bundle (large JSON) → **raw Walrus / Quilt blob** (§11.2).
- A **distilled reputation fact** per job ("agent X: research job, 5/5 claims supported, paid
  0.05 SUI, blob `<id>`, anchor `<digest>`") → **MemWal** via `rememberManual({ blobId, vector,
  namespace })`, so it is **semantically searchable** and **encrypted/owned**.
- This upgrades **Layer 3 (Trust Routing)** massively: routing becomes a `recall({ query: "agent
  with verified decentralized-storage research" })` over the reputation graph — semantic
  match on *verifiable work*, which we could not easily build ourselves.
- `namespace` = our scoping primitive: per-agent passports, per-skill pools, and **shared
  namespaces = cross-agent coordination** (rubric ✓).

Positioning becomes razor-sharp: **WalrusProof is the verifiable-reputation + economic-security
layer ON TOP of MemWal.** We adopt the sponsor's memory primitive and add the thing it lacks —
*payment-bound, stake-secured, cross-buyer work reputation.* Directly answers "help devs adopt
MemWal." Slots behind our `MemoryStore` interface as `MemWalMemoryStore`.

**Update:** `MemWalMemoryStore` is implemented as a semantic overlay: the full evidence bundle
still lands on raw Walrus as the proof artifact, then WalrusProof writes a distilled reputation
fact to MemWal via `remember(...)` under `MEMORY_BACKEND=memwal`. Tests cover fake-client writes
and SDK client construction; remaining work is a live MemWal credential smoke.

### 11.2 Walrus Quilt as the PoWM storage substrate ✅ adopt
**Quilt** batches up to **~660 small blobs** into one unit, **106–420× cheaper** for 10–100 KB
files, with **per-file immutable tags/IDs** and **individual read-back** (no full-batch download).
Walrus explicitly lists **"AI communications data and logs"** as the use case.

Why it's perfect for us: each PoWM record is a small JSON blob and we'll have *many* per agent.
Quilt lets us store the whole reputation ledger cheaply, **tag each record** (`agentId`, `skill`,
`verdict`, `anchorDigest`) for fast filtered reads in the Explorer, and still address every record
individually. This is a concrete, Walrus-native engineering choice judges respect (vs. naive
one-blob-per-file). HTTP API + CLI today; TS SDK "coming soon" → use the HTTP API now.
Updates plan Milestone A: store via **Quilt** (or Harbor) instead of single blobs.

### 11.3 Sui Stack Messaging for agent-to-agent hire + audit grants ✅ adopt
The **Sui Stack Messaging SDK** (`MystenLabs/sui-stack-messaging`) is an **E2E-encrypted,
Seal+Walrus+Sui message bus** explicitly built for **"AI agent coordination... a verifiable,
encrypted message bus,"** with **programmable flows triggered by on-chain events**.

Use it to make multi-agent coordination *real* instead of bespoke HTTP:
- **Hire negotiation:** hirer agent ↔ worker agent negotiate scope/price over a verifiable channel
  (replaces our ad-hoc handoff; every message auditable on Sui).
- **Audit-before-hire grant (pairs with §3 Seal):** a worker sends a time-boxed Seal-decryptable
  pointer to deep evidence so a prospective buyer can verify before hiring.
- **Reputation subscription:** a buyer subscribes; new verified jobs trigger a message (long-running
  state over time ✓). Alpha, testnet-only — fine for the demo.

### 11.4 Nautilus "verifiable verification" 🟡 stretch wow (don't over-invest)
**Nautilus** runs code in a TEE (AWS Nitro) and lets a **Move contract verify the attestation**
on-chain. Synapse uses it to attest *trade decisions*. Our distinctive twist: attest the
**verification step itself** — run the source-claim checker in the enclave so the reputation
score is **provably computed, not self-asserted.** This answers the sharpest judge question
("how do we know your gate isn't rubber-stamping its own scores?"). Heavy + it's Synapse's
signature move, so scope as a **documented mechanism + one attested tx**, not a full system.

**Net effect on the stack:** Walrus/Quilt (durable evidence) · MemWal (semantic, owned, encrypted
recall) · Seal (privacy) · Sui Messaging (coordination) · Sui Move (anchor + stake/slash) ·
Nautilus (optional verifiable scoring). We now use **the full sponsor stack coherently**, with a
clear reason for each — which is exactly what wins a "verifiable data platform" track.
