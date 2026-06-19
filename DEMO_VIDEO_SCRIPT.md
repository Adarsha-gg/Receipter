# TenderBoard Demo Video Script

Target length: 2-3 minutes.

## 0:00 - Problem

"Agent commerce cannot scale if buyers leak private context to unknown worker agents or pay just because a response looks valid. Before agents can hire other agents, we need work orders, privacy boundaries, acceptance criteria, evidence, and reputation."

## 0:20 - Product

"TenderBoard is a Sui-native trust desk for paid agent work. A buyer creates a SUI-denominated task, TenderBoard creates a safe worker packet, scores the worker route, creates a verification manifest, prepares evidence for Walrus, and anchors the final proof to a Sui receipt registry."

## 0:40 - Open App

Show:

```text
http://127.0.0.1:4174
```

Point out:

- mode badge
- SUI payment cap
- Sui readiness
- Walrus readiness
- task form
- acceptance criteria
- checker pack selector
- private notes field
- safe worker packet preview
- trust gate panel
- verification manifest panel
- execution timeline
- receipt panel
- run ledger

## 1:00 - Create A Sui Work Contract

Task example:

```text
Find Sui agent grants and useful builder opportunities.
```

Acceptance criteria:

```text
Return at least 5 public-source Sui opportunities with links.
Flag deadline, sponsor, prize/funding, and fit when visible.
End with a ranked recommendation and why.
```

Checker pack:

```text
research
```

Private notes example:

```text
Prioritize Sui primitives, Walrus evidence, object ownership, verifiable settlement, and ecosystem growth. Do not expose this field.
```

Click **Send safe task**.

Say:

"The worker packet keeps acceptance criteria but removes private notes and secret-looking content. This is the privacy boundary."

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

"TenderBoard does not just send a task. It creates a Sui-bound verification contract before payment approval."

## 1:50 - Sui Work Order, Evidence, And Anchor

Show:

- Sui work order id
- payment approval panel
- Sui dev payment digest or real digest
- worker delivery
- evidence hash
- Walrus upload pending state or blob id
- Sui anchor plan command

Say:

"The completed receipt becomes a compact Sui proof pointer: spec hash, evidence hash, trust score, checker pack, payment reference, and Walrus blob id."

## 2:25 - Proof And Close

Download the receipt JSON or run:

```bash
npm run proof:latest
npm run sui:anchor-plan <run-id> <walrus-blob-id>
```

Say:

"TenderBoard is the missing trust layer for agent commerce on Sui: no blind context sharing, no blind payment, evidence stored on Walrus, and reputation backed by Sui receipts."
