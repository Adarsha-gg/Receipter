# TenderBoard Demo Video Script

Target length: 2-3 minutes.

## 0:00 - Problem

"Agents can already discover services and move money, but buyers still do not have a safe way to hire unknown worker agents. You should not leak private notes, internal strategy, keys, or repo context, and you should not pay just because a response has the right shape."

## 0:20 - Product

"TenderBoard is a Sui trust-gated work desk for agent commerce. It is inspired by TrustMCP's runtime trust-gating idea and CTRL+Z Verify's proof-before-settlement model. A buyer creates a paid task, TenderBoard makes a safe worker packet, scores the worker route, anchors acceptance criteria, stores evidence on Walrus, and anchors compact receipt proofs to Sui."

## 0:40 - Open App

Show:

```text
http://127.0.0.1:4174
```

Point out:

- mode badge
- payment cap
- Sui anchor readiness
- task form
- acceptance criteria
- checker pack selector
- private notes field
- safe worker packet preview
- trust gate panel
- verification manifest panel
- live timeline
- receipt panel
- run ledger

## 1:00 - Create A Work Contract

Task example:

```text
Find AI agent hackathons and useful builder opportunities.
```

Acceptance criteria:

```text
Return at least 5 public-source opportunities with links.
Flag deadline, sponsor, prize/funding, and fit when visible.
End with a ranked recommendation and why.
```

Checker pack:

```text
research
```

Private notes example:

```text
Prioritize agent-commerce, MCP, verification, x402, and reputation ecosystems. Do not expose this field.
```

Click **Send safe task**.

Say:

"The worker packet keeps the acceptance criteria but removes private notes and secret-looking content."

## 1:25 - Trust Gate And Verification Manifest

Show:

- trust verdict
- score and tier
- worker route
- controls
- spec hash
- checker pack
- required checks

Say:

"This is the key product upgrade. TenderBoard does not just send a task. It creates a trust decision and an anchored verification contract before payment."

## 1:50 - Worker, Evidence, And Sui Anchor

Explain:

"The worker is an Opportunity Scout. In mock and dry-run mode, it searches public Hacker News and GitHub APIs and returns real links. The full receipt and delivery evidence are meant for Walrus, while the Sui receipt registry stores the compact proof pointer: spec hash, evidence hash, trust score, checker pack, payment reference, and Walrus blob id."

Show:

- timeline
- order id
- payment approval panel
- delivery
- receipt
- Sui anchor plan command

Say:

"Payment is not automatic. The operator approves the exact order, then the completed receipt can be anchored to Sui."

## 2:25 - Proof And Close

Download the receipt JSON or run:

```bash
npm run proof:latest
npm run sui:anchor-plan <run-id> <walrus-blob-id>
```

Say:

"The receipt contains the safe packet, trust decision, verification manifest, payment tx hash when live, delivery, event timeline, and final evidence hash. The Sui anchor turns that receipt into a durable proof pointer for reputation and dispute review. TenderBoard makes agent-to-agent hiring safer: no blind context sharing, no blind payment, and no self-attested reputation."
