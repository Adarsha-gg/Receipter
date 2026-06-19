# CROO Agent Hackathon — RetainerHub Build Plan

Generated: 2026-06-18

## Hackathon

**Name:** CROO Agent Hackathon  
**Platform:** DoraHacks  
**URL:** https://dorahacks.io/hackathon/croo-hackathon  
**Submission URL:** https://dorahacks.io/hackathon/croo-hackathon/buidl  
**Prize pool:** $10,200  
**Format:** Virtual  
**Submission window:** 2026-06-09 09:00 → 2026-07-12 09:00  
**Requirements:** GitHub/GitLab/Bitbucket link + demo video  
**Tags:** AI Agents, A2A, Web3, Blockchain, AI, OpenClaw, DeFi, Platform Technology, OpenAI

## Tracks

The hackathon lists these tracks:

1. **Research & Intelligence Agents**
2. **Data & Verification Agents**
3. **Creator & Content Ops Agents**
4. **DeFi / On-chain Ops Agents**
5. **Developer Tooling Agents**
6. **Open — Any A2A Agents**

## CROO context

CROO is infrastructure for agent commerce. Its core idea is that AI agents should become economic actors that can:

- have identity
- list services
- negotiate orders
- receive payments
- deliver outputs
- build reputation
- be discoverable by humans and other agents

The CROO Agent Protocol / SDK supports an order lifecycle:

1. Requester starts negotiation.
2. Provider accepts or rejects.
3. Order is created.
4. Requester pays.
5. Provider delivers.
6. Order completes.

The Node SDK exposes runtime methods like:

- `negotiateOrder(req)`
- `acceptNegotiation(negotiationId)`
- `rejectNegotiation(negotiationId, reason)`
- `payOrder(orderId)`
- `deliverOrder(orderId, req)`
- `getDelivery(orderId)`
- `listOrders(opts)`

And events like:

- `NegotiationCreated`
- `OrderCreated`
- `OrderPaid`
- `OrderCompleted`
- `OrderRejected`
- `OrderExpired`

## Rejected direction: generic verification

A generic “verification agent” is not the right build.

It sounds good at first, but it becomes awkward:

- user pays
- agent investigates
- agent often says “cannot verify without external source”
- buyer feels unsatisfied

For physical-world claims like package delivery, attendance, real revenue, or work completion outside the system, verification needs trusted external oracles: carrier APIs, signed webhooks, identity systems, receipts, photos, signatures, etc.

That is too broad and too brittle for this hackathon.

## Chosen direction

# RetainerHub

**Tagline:** Put agents on payroll, not prompts.

RetainerHub is a standing-order layer for agent commerce.

Instead of hiring an agent once, a user or another agent can create a recurring retainer:

> “Every weekday at 9am, scout new web3 hackathons, bounties, grants, and high-signal events. Rank them and deliver a brief.”

The retainer turns into scheduled paid agent work.

## Core idea

Most agent marketplaces focus on one-off tasks:

> “Do this once.”

But many useful agent jobs are recurring:

- daily opportunity scouting
- weekly market research
- recurring content ops
- portfolio monitoring
- grant/bounty discovery
- project status updates
- competitor tracking
- lead generation
- event scouting
- repo issue triage

RetainerHub productizes that.

It lets buyers define:

- what agent service they want
- schedule
- budget per run
- output format
- success criteria
- stop conditions
- delivery endpoint

Then it coordinates repeated orders through CROO.

## Why this fits CROO

CROO wants agents to become commercial service providers.

RetainerHub gives agents recurring revenue.

That maps directly to CROO’s thesis:

- agent services become products
- agents earn repeatedly
- reputation compounds over time
- buyers do not need to manually prompt every day
- A2A commerce becomes more realistic

A one-off order is like hiring a freelancer once.

A retainer is like putting an agent on payroll.

## Product wedge

The initial use case should be extremely concrete:

# Opportunity Scout Retainer

A recurring agent that finds high-signal opportunities for builders.

It searches for:

- hackathons
- bounties
- grants
- accelerator deadlines
- local events
- online builder programs
- protocol ecosystem opportunities

Then it returns:

- ranked opportunities
- deadlines
- why each matters
- effort estimate
- suggested action
- links
- “apply/build/ignore” recommendation

## Why Opportunity Scout is a good first retainer

It is useful, demoable, and not too risky.

It does not require moving funds, trading, or making irreversible actions.

It still creates obvious economic value:

- find opportunities early
- avoid stale events
- avoid wasting time on low-signal stuff
- turn scattered internet data into decisions

It can also be bought by other agents:

- a startup scout agent buys opportunity reports
- a builder agent buys hackathon scans
- a content agent buys event calendars
- a research agent buys source lists

## Demo story

### Demo title

**RetainerHub: recurring paid work for AI agents**

### Demo flow

1. User creates a retainer:

```json
{
  "name": "Daily Web3 Opportunity Scout",
  "schedule": "weekdays 09:00",
  "budget_per_run": "0.25 USDC",
  "service": "opportunity_scout",
  "requirements": {
    "topics": ["AI agents", "Web3", "x402", "CROO", "hackathons"],
    "location": "NYC / New Jersey / remote",
    "min_relevance": 70,
    "output": "ranked markdown + JSON"
  }
}
```

2. RetainerHub determines a run is due.
3. It creates or simulates a CROO order.
4. The provider agent accepts.
5. After payment, the agent runs the scout job.
6. The agent delivers:

```json
{
  "retainer_id": "ret_001",
  "run_id": "run_2026_06_18",
  "status": "delivered",
  "opportunities": [
    {
      "title": "CROO Agent Hackathon",
      "deadline": "2026-07-12",
      "score": 96,
      "action": "build RetainerHub MVP"
    }
  ]
}
```

7. Dashboard shows:

- active retainer
- last run
- next run
- delivered brief
- spend so far
- output quality / status

## Judge-facing pitch

> Agents should not wait for prompts. Useful agents should have recurring commercial jobs.

> RetainerHub turns CROO orders into scheduled services, starting with an Opportunity Scout that gets paid to find high-signal hackathons, bounties, grants, and events.

## Why this is stronger than another chatbot

A chatbot is not commerce.

A recurring paid agent service is commerce.

RetainerHub demonstrates:

- recurring demand
- paid delivery
- service packaging
- schedule-based coordination
- agent revenue
- agent retention
- real user value

## Tracks it fits

### Open — Any A2A Agents

Retainers can be created by humans or agents. One agent can pay another agent for recurring work.

### Research & Intelligence Agents

Opportunity Scout is a recurring research/intelligence service.

### Creator & Content Ops Agents

The same retainer pattern can support recurring content calendars, trend monitoring, post drafts, or creator ops.

### Developer Tooling Agents

RetainerHub is also infrastructure for agent developers: package services, schedules, pricing, and outputs.

## MVP scope

### Must-have

1. Retainer config format

```json
{
  "id": "ret_001",
  "name": "Daily Web3 Opportunity Scout",
  "service": "opportunity_scout",
  "schedule": "daily",
  "budget_per_run": "0.25 USDC",
  "status": "active",
  "requirements": {}
}
```

2. Retainer runner

Command:

```bash
retainerhub run-due
```

It should:

- load active retainers
- detect due runs
- create a run record
- call the provider agent
- write output
- update run status

3. Opportunity Scout provider

It should:

- search/fetch web sources
- filter stale opportunities
- rank by relevance
- produce markdown + JSON

4. CROO provider skeleton

Use `@croo-network/sdk` to show the real integration path:

- connect websocket
- accept negotiation
- wait for `OrderPaid`
- run retainer job
- call `deliverOrder`

5. Mock mode

If CROO credentials are missing, demo the full lifecycle locally with mock orders.

6. Demo UI

A simple UI with:

- Create Retainer
- Run Now
- Last Delivery
- Next Run
- Spend
- Output Preview

### Should-have

- run history
- per-run cost
- retry failed run
- pause/resume retainer
- output schema validation
- sample buyer/provider personas

### Do-not-build

- full marketplace
- complex calendar scheduler
- real token transfers outside CROO
- generic verification
- physical-world oracle claims
- autonomous DeFi execution
- broad multi-agent swarm

## Technical architecture

```text
RetainerHub
├── retainer config store
├── scheduler / run-due engine
├── order adapter
│   ├── CROO adapter
│   └── mock adapter
├── provider agents
│   └── OpportunityScout
├── delivery store
└── demo dashboard
```

## Data model

### Retainer

```json
{
  "id": "ret_001",
  "created_at": "2026-06-18T12:00:00",
  "name": "Daily Web3 Opportunity Scout",
  "buyer": "human_or_agent_id",
  "provider_service": "opportunity_scout",
  "schedule": {
    "type": "daily",
    "time": "09:00",
    "timezone": "America/New_York"
  },
  "budget_per_run": {
    "amount": "0.25",
    "currency": "USDC"
  },
  "requirements": {
    "topics": ["AI agents", "Web3", "CROO", "x402", "hackathons"],
    "location": "NYC / NJ / remote",
    "freshness": "future deadlines only"
  },
  "status": "active"
}
```

### Run

```json
{
  "id": "run_001",
  "retainer_id": "ret_001",
  "started_at": "2026-06-18T09:00:00",
  "completed_at": "2026-06-18T09:02:11",
  "order_id": "croo_order_or_mock_order",
  "status": "delivered",
  "cost": {
    "amount": "0.25",
    "currency": "USDC"
  },
  "deliverables": {
    "markdown": "outputs/run_001.md",
    "json": "outputs/run_001.json"
  }
}
```

### Opportunity

```json
{
  "title": "CROO Agent Hackathon",
  "url": "https://dorahacks.io/hackathon/croo-hackathon",
  "deadline": "2026-07-12",
  "location": "Virtual",
  "category": "hackathon",
  "score": 96,
  "why": "Direct fit for AI agent commerce and CROO SDK integration.",
  "recommended_action": "Build RetainerHub MVP and submit."
}
```

## Scoring rubric for opportunities

Score 0–100 based on:

- deadline is future
- prize/reward size
- fit with requested topics
- build feasibility
- sponsor/platform fit
- location fit
- likelihood of useful contacts
- clarity of submission requirements
- novelty / low competition

## What makes it extraordinary

The product is not “an agent that finds hackathons.”

The bigger idea is:

> a recurring payment primitive for useful agent services.

Opportunity Scout is just the first service.

Other services later:

- grant scout
- competitor tracker
- repo issue triager
- content trend scout
- DeFi risk monitor
- investor lead scout
- event scout
- calendar briefing agent

## Risks

### Risk: judges think it is just cron jobs

Mitigation:

Frame it as **commercial retainers**, not scheduling.

Show:

- priced service
- repeated paid runs
- CROO order lifecycle
- delivery history
- buyer/provider model

### Risk: CROO integration is hard

Mitigation:

Build mock mode first, then CROO adapter.

Demo both:

- local lifecycle works
- CROO SDK skeleton is real

### Risk: Opportunity Scout feels too simple

Mitigation:

Make the retainer system the product.

Scout is the first service that proves the recurring agent-commerce primitive.

### Risk: recurring payments are not directly supported

Mitigation:

Do not claim CROO has native subscriptions.

RetainerHub can create repeated standard orders from a standing agreement.

## Demo script

1. Open RetainerHub.
2. Create “Daily Web3 Opportunity Scout.”
3. Click “Run now.”
4. Show mock/CROO order created.
5. Provider accepts.
6. Payment event occurs.
7. Agent runs scout.
8. Delivery appears.
9. Show run history and next scheduled run.
10. Show JSON/Markdown deliverable.
11. Explain that any agent service can be put on retainer.

## Build plan

### Day 1

- Create repo/app scaffold.
- Define retainer/run/opportunity schemas.
- Build mock order lifecycle.

### Day 2

- Build Opportunity Scout.
- Add source search/fetch pipeline.
- Add future-deadline filtering and scoring.

### Day 3

- Build dashboard.
- Add create retainer, run now, output preview.

### Day 4

- Add CROO SDK provider skeleton.
- Add environment config and README.

### Day 5

- Add run history, pause/resume, retry.
- Polish deliverables.

### Day 6

- Record demo video.
- Improve README and submission text.

### Day 7

- Final bug fixes.
- Submit GitHub + video to DoraHacks.

## Final recommendation

Build **RetainerHub** with **Opportunity Scout** as the first paid recurring agent service.

This avoids the weak generic-verification trap and directly demonstrates agent commerce:

```text
standing need → scheduled order → paid agent run → delivered brief → recurring revenue
```

It is useful, buildable, demoable, and aligned with CROO.
