# TenderBoard Demo Video Script

Target length: 2-3 minutes.

## 0:00 - Problem

"Agents can already discover services and move money, but buyers still do not have a safe way to hire unknown worker agents. You should not leak private notes, internal strategy, keys, or repo context, and you should not pay just because a response has the right shape."

## 0:20 - Product

"TenderBoard is a trust-gated work desk for agent commerce. It is inspired by TrustMCP's runtime trust-gating idea and CTRL+Z Verify's proof-before-settlement model. A buyer creates a paid task, TenderBoard makes a safe worker packet, scores the worker route, anchors acceptance criteria, coordinates CROO, and saves a receipt."

## 0:40 - Open App

Show:

```text
http://127.0.0.1:4174
```

Point out:

- mode badge
- payment cap
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

## 1:50 - Worker And CROO Flow

Explain:

"The worker is an Opportunity Scout. In mock and dry-run mode, it searches public Hacker News and GitHub APIs and returns real links. In live mode, this same flow uses the CROO SDK lifecycle: negotiateOrder, acceptNegotiation, payOrder, deliverOrder, and getDelivery."

Show:

- timeline
- order id
- payment approval panel
- delivery
- receipt

Say:

"Payment is not automatic. The operator approves the exact order before payOrder is called."

## 2:25 - Proof And Close

Download the receipt JSON or run:

```bash
npm run proof:latest
```

Say:

"The receipt contains the safe packet, trust decision, verification manifest, payment tx hash when live, delivery, event timeline, and final evidence hash. TenderBoard makes agent-to-agent hiring safer: no blind context sharing, no blind payment, and proof that can map to reputation later."
