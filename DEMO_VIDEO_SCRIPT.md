# WalrusProof Demo Video Script

Target length: 4-5 minutes.

## 0:00 - Problem

"AI agents are starting to do paid work, but their memory and reputation are still fragile. A future buyer cannot usually verify what an agent did, what evidence it used, whether private context was protected, or whether the reputation score came from real completed work."

## 0:25 - Product

"WalrusProof is portable, verifiable reputation for AI agent work. Every paid job becomes a Walrus memory blob you can open, hash-check, and anchor on Sui. The next buyer can route work using that prior record instead of trusting a platform score."

## 0:50 - Passport Directory

Show:

```text
http://127.0.0.1:4174
```

Point out:

- Agent Passport directory
- worker agents
- completed job counts
- average claim support
- Walrus-backed record count
- Sui-anchored record count
- SUI earned or payment-bound history

Say:

"This is the product surface: a portable work history for agents. The records are not just app rows. Each one points to a Walrus blob and a Sui receipt."

## 1:35 - Memory Inspector

Open one passport and one job.

Show:

- task title
- source-claim support score
- Walrus blob id
- public aggregator read URL
- Sui anchor digest
- memory hash
- verify result

Say:

"The judge can open the raw Walrus artifact, read it back, recompute the memory hash, and confirm it matches the anchored proof."

## 2:20 - Create A New Paid Agent Job

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

Private notes example:

```text
Prioritize Sui primitives, Walrus evidence, object ownership, verifiable settlement, and ecosystem growth. Do not expose this field.
```

Say:

"WalrusProof keeps the acceptance criteria but strips private notes and secret-looking content before the worker sees the task."

## 3:00 - Bid, Payment, Verification

Show:

- worker bids
- selected worker
- SUI payment cap
- x402-style Sui payment requirement, verified by the local Sui facilitator/verifier
- worker delivery
- claim verification
- settlement action

Say:

"This is not blind payment. The worker is selected under budget and risk rules, then the delivered evidence has to pass the checker before the record can become reputation."

## 3:45 - Walrus And Sui Finality

Show:

- real Walrus blob id: `lDssvU3Jw6eRyE2N0X0fvCE3b_oCV5peftFj4UkAklw`
- Sui package v5: `0x57efddeb8888ff788487deb2e21042fe6ead4ee10dadd8d8386ecad8df17e651`
- Sui AgentPassport object: `0x8a136d56df3a6d616498524f537074133d1cb63d24ac556f3a6aa81cd6fbb06e`
- receipt registry: `0x62b35a579149dcf50127e68f4ad00107e72df975ed57993ab5d825e0400fa1bb`
- receipt anchor tx: `Hxxuk6jCAMFvUyiif8q6GLjDQ6w6m1BjMAnUb1zNEDLP`
- passport txs: `D7c7uuvKuxvcMiWWc6DjrE1DoWu6dhTZ21vZnKNw3AbL`, `7fKW9usVrqJ1XydV8SAhwaUYiRnqWkiSXBNNHaqLqnoW`, `9RRyreY2BBuKE6kxVffGqvJj8Yr5WQtN1bZYqL9LAVAP`
- stake/slash proof txs: `Fj4pwsmP5QkTqqREGYAQzxxG66GXFhM4DjALs77i96sX`, `GF8r7iieheTknpPKtXPbQqyD8PkeohopE9z56GijoSoy`, `3nGY1HoTgL1o55RWhJJhDxzQ2uQwBH25GteoH87uddXk`

Say:

"Walrus stores the full evidence memory. Sui owns the agent passport object, anchors the compact receipt, and backs the reputation with challengeable stake."

## 4:30 - Close

"WalrusProof makes agent reputation portable, inspectable, and costly to fake. Every record is a Walrus blob anyone can verify, anchored on Sui, and reusable by the next agent workflow."
