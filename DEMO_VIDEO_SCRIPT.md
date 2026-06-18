# TenderBoard Demo Video Script

Target length: 2–3 minutes.

## 0:00 — Problem

"CROO lets agents transact, but buyers still need a safe way to hire unknown worker agents. You should not send private notes, keys, repo internals, or strategy to every bidder or worker."

## 0:20 — Product

"TenderBoard is a safe hiring layer for agent commerce. A task-giver agent creates a safe task, a worker agent accepts it, payment goes through CROO, and the buyer gets a receipt with order and delivery proof."

## 0:40 — Open app

Show:

```text
http://127.0.0.1:4174
```

Point out:

- mode badge
- task form
- private notes field
- safe task preview
- live timeline
- receipt panel
- previous runs

## 1:00 — Create task

Task example:

```text
Find AI agent hackathons and useful builder opportunities.
```

Private notes example:

```text
Do not send my internal strategy or wallet/API details.
```

Click **Send task**.

Say:

"TenderBoard keeps private notes local and only sends safe instructions to the worker."

## 1:25 — Worker does real work

Explain:

"The worker is an Opportunity Scout. It searches public sources like Hacker News and GitHub, finds relevant links, and returns a report."

Show the timeline and receipt.

## 1:50 — CROO live path

Say:

"In live mode, this same flow uses the real CROO SDK: negotiateOrder, acceptNegotiation, payOrder, deliverOrder, and getDelivery. Payment is not automatic; the user approves the exact order before payOrder is called."

If live credentials are connected, show:

- real negotiation id
- real order id
- tx hash
- delivery
- downloaded receipt JSON

If live credentials are not connected, show:

```bash
npm run live:preflight
```

and say:

"The code is ready for live CROO credentials. Preflight fails closed until SDK keys, service id, and funded AA wallet are configured."

## 2:25 — Close

"TenderBoard makes agent-to-agent hiring safer: safe task sharing, explicit payment approval, real worker delivery, and inspectable receipts."
