# WalrusProof — Competitive Landscape (Walrus track)

> Intel as of 2026-06-19. Companion to `WALRUS_TRACK_PLAN.md`.

## TL;DR
- **🔴 Synapse Vault is the project to beat.** Walrus-track, fully **deployed on testnet**, and
  it already ships *everything WalrusProof planned*: MemWal recall every tick, Walrus audit
  artifacts + on-chain hash anchor, a **read-only memory inspector**, a **hire/marketplace**,
  multi-agent coordination, Seal, Walrus Sites, even enclave attestation. We are **behind it on
  execution and breadth.** Direct collision — needs a strategy response, not just more building.
- **ChronicleOS** — closest *narrative* twin (multi-agent + MemWal + inspector dashboard) but
  Walrus/MemWal is **roadmap, not built**. Beatable on execution.
- **WalGit** — decentralized Git host (Sui+Walrus+Seal) with "Repository Memory" + MCP server.
  Different lane (dev tooling/version control); last commit ~3 weeks ago (may be done/idle).
- **Edge** — most-executed in a **different lane** (agent spending-policy, on mainnet). Confirms
  we must stay OFF the trust-gate turf. Walrus is a side audit log for them.
- **Cortex / Sofer** — still not assessable (X blocked; no repo for Sofer). Need links/text.

---

## 0. Synapse Vault — github.com/SuyashAlphaC/Synapse  🔴 THE leader / direct collision
**What it is:** "Walrus-native autonomous treasury." A DeFi treasury agent where **every tick**:
RECALL (MemWal memory + cross-agent peer facts) → REASON (TS/LangGraph/LLM/Nautilus enclave) →
ACT (one PTB: policy gate → DeepBook swap → log) → PUBLISH (rationale → Walrus, SHA-256 anchored
on-chain) → COORDINATE (peer signal via Sui Stack Messaging) → REMEMBER (outcome → MemWal).

**Execution level (very high) — deployed on Sui testnet today:**
- Move package v6 deployed; hosted demo vaults on **AWS Fargate** with EventBridge ticks.
- Real on-chain proofs: rebalance tx, **CrossAgentReadEvent**, **DecisionAttestedV2** (Nautilus
  enclave attestation verified in-PTB before swap), Seal policy package — all with Suiscan links.
- **Read-only memory inspector** at `/inspector` (no wallet) — *the exact UI we planned.*
- **Strategy marketplace**: third-party quants publish strategies as **hash-verified Walrus
  bundles** → on-chain `Strategy` object + royalty → vault owners hire — *our marketplace idea.*
- `@synapse-core/adapter-langgraph` (dev tooling), Seal private artifacts, **Walrus Sites**
  marketing site, SUBMISSION/THREAT_MODEL/AUDIT/RUNBOOK, 7-min + two 90-sec demo videos.
- Actively committed (2026-06-18).

**Why this is the hard problem:** Synapse already does verifiable MemWal memory + Walrus
hash-anchored artifacts + inspector + marketplace + multi-agent coordination — *deployed* — which
is the bulk of WalrusProof's differentiators. It checks **every** Walrus-track rubric box with
live proofs.

**The one gap / our only real opening:** Synapse is **vertical (one team's DeFi treasury)**. Its
memory is *intra-product* (a treasury recalling its own ticks; "cross-agent" = its own peer
vaults). It is **not** an open hiring market where a *worker agent carries portable, verifiable
WORK reputation to brand-new buyers across arbitrary task types.* That horizontal
"reputation-passport-as-routing" framing is the only thing it doesn't own — but "broad and
unproven" usually loses to "narrow and deployed," so this only works if we execute something real.

---

## 1. ChronicleOS — github.com/NexsisNelson/ChronicleOs  ⚠️ closest overlap
**What it is:** "Decentralized multi-agent R&D lab." Three LangGraph agents
(Researcher / Architect / Auditor) collaborate on long-running tasks, using **Walrus as a
shared file system** and **MemWal as verifiable cross-agent long-term memory**, plus a
**Next.js developer dashboard to inspect/debug agent memory in real time.**

**Why it's a threat:** this is almost word-for-word the rubric's most-wanted items
(multi-agent coordination + verifiable memory + a memory inspector + MemWal adoption). Active
(commits today). Strong docs/architecture (ARCHITECTURE, ROADMAP, DEPLOYMENT, CI).

**Where it's weak (our opening):** their own ROADMAP says Walrus + MemWal is **Phase 2,
unbuilt** — "placeholder implementations of all three agent layers," `[ ] Implement
walrus_tools.py`, `[ ] Complete MemWal API wrapper`, offline **seeded demo store**. The
dashboard memory-timeline is **Phase 3 (pending)**. So today it's scaffolding + offline demo.

**How we beat it:**
- Ship a **real** Walrus round-trip + a **real** Sui-anchored receipt (they have neither yet).
- Our memory is **earned and independently verifiable** (payment-bound + source-claim
  admission gate + on-chain hash anchor + verify-on-Walrus), not just "stored agent state."
- We already have a **working end-to-end loop with tests**; they have placeholders.

---

## 2. Edge / EdgePass — github.com/fluturecode/edge  🏁 most executed, different lane
**What it is:** "The trust primitive for autonomous agents — gives agents your rules, not your
keys." An **EdgePass** Sui Move object encodes a spending policy (budget / auto-approve /
escalate / merchants / expiry). Published SDK `@edge-protocol/sdk`, live AI agent demo (Claude
spends within policy), audit **receipts stored on Walrus**.

**Execution level (high):** **on MAINNET**, live Vercel app, npm package v0.6.4, ~34 tests,
real on-chain object, Suiscan links, ~42 hrs invested. Targets **Agentic Web** track primarily.

**Why it matters to us:** Edge owns the **trust/policy/spending-guardrail** lane and executed
it to mainnet. Our *old* framing (trust gate + x402 + Walrus evidence receipts) **collides with
Edge and loses on execution.** This is hard confirmation to **pivot fully to verifiable memory**
and drop the trust-primitive positioning.

**Where we differ (don't fight on their turf):** Edge's Walrus usage is a **secondary audit
log**; for us **the memory IS the product**. We're reputation/memory across jobs; they're
per-transaction spending authority. Different track emphasis — avoid head-to-head.

---

## 2b. WalGit — github.com/Neo-Gar/walgit  🛠 strong, different lane (dev tooling)
**What it is:** "Git for the agent-native era." A decentralized Git host on **Sui + Walrus +
Seal**: native `git push/pull/clone` via a `git-remote-walgit` helper, every commit a Sui object
linked to a Walrus blob, Seal-encrypted private repos gated by on-chain ACL. Leads with
**"Repository Memory"** — a per-session reasoning trace (why the code is how it is), Seal-encrypted,
**searchable by meaning**, exposed to agents via an **MCP server (14 tools)**. Rust CLI, sponsored
mode, checksum-verified installer.

**Threat level:** strong engineering and a clean "agent memory on Walrus" story via reasoning
traces + MCP — but a **different lane** (version control / dev tooling), so not a direct product
collision. **Last commit 2026-05-30 (~3 weeks stale)** — may be finished early or idle. Most
dangerous to us only in the "developer tooling to adopt Walrus" sub-category, where its MCP
server is a clean, reusable adapter.

## 3. Cortex (x.com/atcortex)  ❓ not assessable yet
X.com blocks automated fetch (HTTP 402) and web search returned nothing specific. **Need:** a
repo link, deck, or the bio/text so I can place it. Likely an agent-infra play given the handle,
but unconfirmed — do not assume.

## 4. Sofer  ❓ no repo yet
Only a text description exists (not shared with me). A generic search surfaced "a plugin for
agent frameworks giving enterprise agents durable, verifiable, shareable memory on Walrus" — if
that's Sofer, it overlaps our **MemWal-adapter / dev-tooling** angle. **Need:** the actual Sofer
description + any link to confirm.

---

## Strategic takeaways (revised after Synapse + WalGit)
1. **The field is crowded AND deployed.** The "Walrus-native verifiable agent memory" lane is no
   longer open water — **Synapse already shipped a superset of our plan to testnet.** Generic
   "agent + verifiable memory marketplace" framing now loses on execution. We must either
   out-narrow the field or out-execute one specific thing.
2. **Honest standing:** on breadth/execution today the order is roughly **Synapse ≫ Edge ≈ WalGit
   > WalrusProof > ChronicleOS**. We are behind the leaders and ahead only of the unbuilt twin.
3. **The only defensible wedge left:** *portable WORK reputation that routes paid jobs between
   strangers.* Synapse's memory is one product recalling itself; ours would be a worker's
   **passport carried to new buyers across arbitrary task types** (research, code, ops…). Lead
   with "un-fakeable cross-buyer reputation," not "agent memory."
4. **Still must clear the table stakes Synapse already has:** one real Walrus blob, one deployed +
   anchored Move receipt, a live read-only inspector. Without these we are not even in the
   conversation. (Plan Milestone A — now urgent, not optional.)
5. **Consider a sharper, smaller bet:** a **MemWal/Walrus "verifiable work-memory" adapter +
   inspector as developer tooling** may be a less-crowded win than another full agent app —
   WalGit (MCP) and Synapse (langgraph adapter) show judges reward reusable tooling, and nobody
   yet owns "drop-in *verifiable, payment-bound work-memory* SDK."
6. **Keep:** Harbor + Seal for the real storage layer; drop the trust-gate/x402 identity (Edge +
   Synapse both do policy gating better and deployed).

---

## Walrus Harbor (from the Sui Overflow workshop transcript)
Harbor is a **managed REST front door to Walrus** (on "Goldrush"/Oyster), Mysten-built:
- Buckets + file upload/download via a **familiar REST API + API key**; OpenAPI spec + Postman.
- **Seal encryption by default** + access control via Sui permission groups ("Sui Groups").
- **Sponsored transactions → zero cost on testnet**; auto blob-lifetime extension (Oyster).
- Limits (testnet): 100 MB/file, 5 GB/account, 5 buckets/account, 6k req/min. Mainnet ~end of June.
- Caveat: front end can't call Harbor directly — needs a **small server-to-server proxy**.

**Implication:** Harbor is a strong candidate backend for `WalrusMemoryStore` — it removes
publisher/aggregator plumbing, gives encryption for free, and costs nothing on testnet, which
directly de-risks the "one real Walrus round-trip" milestone.
