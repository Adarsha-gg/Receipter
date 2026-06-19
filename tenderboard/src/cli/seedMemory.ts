/**
 * Seed verifiable agent work-memory by driving the real product loop over HTTP.
 *
 * For each task it: creates a Sui work order, approves the SUI payment,
 * runs the worker delivery, stores the evidence bundle on Walrus, and anchors
 * the compact receipt on Sui. The result populates the Walrus memory index and
 * per-worker memory passports with real records.
 *
 * Usage:
 *   npm run seed:memory                 # against http://127.0.0.1:4174
 *   BASE_URL=http://127.0.0.1:4174 npm run seed:memory
 */

import { stableHash } from '../live/hash.js';
import type { ScoutClaim, ScoutEvidence, ScoutSourceKind, SourceObservation, SourceReceipt } from '../live/types.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:4174').replace(/\/+$/, '');

export interface SeedTask {
  title: string;
  instructions: string;
  acceptanceCriteria: string[];
  privateNotes?: string;
  checkerPack: 'research' | 'code' | 'commerce';
  requestedDataLabel: 'public' | 'buyer_private' | 'secret';
  amount: string;
  preferredBidId: string;
  sources: Array<{
    title: string;
    url: string;
    source: ScoutSourceKind;
    sourceLabel: string;
    note: string;
  }>;
}

export interface SeedMemoryIndexSummary {
  workerCount: number;
  totalMemoryRecords: number;
  walrusBackedRecords: number;
  suiAnchoredRecords: number;
  passports?: Array<{
    workerAgentId: string;
    memoryCount: number;
    averageClaimSupport?: number | undefined;
    anchoredMemoryCount: number;
  }>;
}

const SEED_TASKS: SeedTask[] = [
  {
    title: 'Find AI agent hackathons and builder programs',
    instructions:
      'Search public sources for active AI agent hackathons, grants, and builder programs. Return the strongest opportunities with links and a short recommendation.',
    acceptanceCriteria: [
      'Return at least 5 public-source opportunities with links.',
      'Flag deadline, sponsor, and fit when visible.',
      'End with a ranked recommendation and why.',
    ],
    privateNotes: 'Internal angle: prioritize Walrus, Sui, and verifiable memory. Do not expose this field.',
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_standard',
    sources: [
      {
        title: 'Sui Overflow 2026 Agentic Web Track',
        url: 'https://overflow.sui.io/agentic-web',
        source: 'github',
        sourceLabel: 'Sui Overflow',
        note: 'Agentic Web rewards AI-native agents that use Sui primitives meaningfully.',
      },
      {
        title: 'Walrus Track Builder Brief',
        url: 'https://overflow.sui.io/walrus',
        source: 'github',
        sourceLabel: 'Sui Overflow',
        note: 'Walrus track focuses on persistent, verifiable memory for agents.',
      },
      {
        title: 'OpenZeppelin Secure Move Patterns Workshop',
        url: 'https://go.sui.io/overflow26-oz-workshop',
        source: 'github',
        sourceLabel: 'Sui Workshop',
        note: 'Security workshop is relevant for Move packages that anchor work receipts.',
      },
      {
        title: 'Walrus Harbor Workshop',
        url: 'https://go.sui.io/harbor-workshop',
        source: 'github',
        sourceLabel: 'Sui Workshop',
        note: 'Harbor provides a managed REST path to Walrus storage for testnet demos.',
      },
      {
        title: 'DeepBook Predict Workshop',
        url: 'https://go.sui.io/db-predict-workshop',
        source: 'github',
        sourceLabel: 'Sui Workshop',
        note: 'DeepBook materials help agent projects understand composable Sui DeFi surfaces.',
      },
    ],
  },
  {
    title: 'Scout decentralized storage and data-availability projects',
    instructions:
      'Find high-signal projects and discussions on decentralized storage, blob storage, and verifiable data availability. Return links and why each matters.',
    acceptanceCriteria: [
      'Return at least 5 source-backed items with links.',
      'Note the angle relevant to agent memory when visible.',
      'End with a ranked recommendation.',
    ],
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_deep',
    sources: [
      {
        title: 'Walrus Verifiable Data Platform',
        url: 'https://docs.wal.app',
        source: 'github',
        sourceLabel: 'Walrus Docs',
        note: 'Walrus stores persistent blobs that can back agent memory and audit artifacts.',
      },
      {
        title: 'Walrus Public Aggregators',
        url: 'https://docs.wal.app/usage/web-api.html',
        source: 'github',
        sourceLabel: 'Walrus Docs',
        note: 'Public aggregator reads allow third parties to inspect stored artifacts.',
      },
      {
        title: 'Walrus Sites',
        url: 'https://docs.wal.app/walrus-sites/intro.html',
        source: 'github',
        sourceLabel: 'Walrus Docs',
        note: 'Walrus Sites can serve a project front door directly from Walrus.',
      },
      {
        title: 'Seal Privacy Layer',
        url: 'https://github.com/MystenLabs/seal',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Seal can encrypt buyer-private evidence while preserving permissioned auditability.',
      },
      {
        title: 'MemWal Walrus Memory',
        url: 'https://github.com/MystenLabs/memwal',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'MemWal provides semantic memory primitives backed by Walrus.',
      },
    ],
  },
  {
    title: 'Track open-source agent-memory frameworks',
    instructions:
      'Survey active open-source agent memory frameworks and recent releases. Return repositories and notable threads with links and short notes.',
    acceptanceCriteria: [
      'Return at least 5 repositories or threads with links.',
      'Note stars, recency, or traction when visible.',
      'End with a ranked recommendation.',
    ],
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_lite',
    sources: [
      {
        title: 'LangGraph Memory Concepts',
        url: 'https://langchain-ai.github.io/langgraph/concepts/memory/',
        source: 'github',
        sourceLabel: 'LangGraph Docs',
        note: 'LangGraph separates short-term and long-term memory for agent workflows.',
      },
      {
        title: 'Mem0 Open Source Memory',
        url: 'https://github.com/mem0ai/mem0',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Mem0 shows demand for reusable agent memory but lacks native Walrus proof anchors.',
      },
      {
        title: 'Zep Memory Platform',
        url: 'https://github.com/getzep/zep',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Zep focuses on agent memory storage and retrieval for production apps.',
      },
      {
        title: 'Letta Agent Memory',
        url: 'https://github.com/letta-ai/letta',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Letta demonstrates persistent agent state and memory as a developer platform.',
      },
      {
        title: 'WalGit Repository Memory',
        url: 'https://github.com/Neo-Gar/walgit',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'WalGit applies Walrus memory to code repositories and reasoning traces.',
      },
    ],
  },
  {
    title: 'Monitor verifiable-compute and proof tooling',
    instructions:
      'Find recent work on verifiable compute, proofs, and on-chain attestation tooling relevant to agent workflows. Return links and why each matters.',
    acceptanceCriteria: [
      'Return at least 5 source-backed items with links.',
      'Flag the relevance to agent settlement or proof when visible.',
      'End with a ranked recommendation.',
    ],
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_deep',
    sources: [
      {
        title: 'Sui Object Model',
        url: 'https://docs.sui.io/concepts/object-model',
        source: 'github',
        sourceLabel: 'Sui Docs',
        note: 'Sui objects are useful for anchoring durable receipt and reputation state.',
      },
      {
        title: 'Sui Programmable Transaction Blocks',
        url: 'https://docs.sui.io/concepts/transactions/prog-txn-blocks',
        source: 'github',
        sourceLabel: 'Sui Docs',
        note: 'PTBs can atomically bind payment, proof, and settlement actions.',
      },
      {
        title: 'OpenZeppelin Move Security',
        url: 'https://github.com/OpenZeppelin/sui-contracts',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Audited Move libraries and patterns are relevant to receipt and stake modules.',
      },
      {
        title: 'Sui GraphQL RPC',
        url: 'https://docs.sui.io/references/sui-api/sui-graphql',
        source: 'github',
        sourceLabel: 'Sui Docs',
        note: 'GraphQL can support independent verifier and explorer queries.',
      },
      {
        title: 'Suiscan Testnet Explorer',
        url: 'https://suiscan.xyz/testnet',
        source: 'github',
        sourceLabel: 'Suiscan',
        note: 'Explorer links make Sui anchors inspectable by judges without local tooling.',
      },
    ],
  },
  {
    title: 'Find Sui ecosystem builder opportunities',
    instructions:
      'Search public sources for Sui ecosystem grants, hackathons, and builder programs. Return the strongest opportunities with links and recommendations.',
    acceptanceCriteria: [
      'Return at least 5 public-source opportunities with links.',
      'Flag deadline and funding when visible.',
      'End with a ranked recommendation.',
    ],
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_standard',
    sources: [
      {
        title: 'Sui Overflow 2026 Handbook',
        url: 'https://overflow.sui.io',
        source: 'github',
        sourceLabel: 'Sui Overflow',
        note: 'Sui Overflow requires meaningful Sui and Walrus integration for strong submissions.',
      },
      {
        title: 'Sui Founder Starter Pack',
        url: 'https://www.sui.io/founder-starter-pack',
        source: 'github',
        sourceLabel: 'Sui',
        note: 'Sui ecosystem resources help teams turn hackathon projects into durable companies.',
      },
      {
        title: 'Awesome Sui',
        url: 'https://github.com/sui-foundation/awesome-sui',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Awesome Sui catalogs ecosystem libraries, apps, and builder resources.',
      },
      {
        title: 'Sui TypeScript SDK',
        url: 'https://sdk.mystenlabs.com/typescript',
        source: 'github',
        sourceLabel: 'Mysten SDK Docs',
        note: 'The TypeScript SDK is the integration path for verifier and oracle clients.',
      },
      {
        title: 'Sui Move Book',
        url: 'https://move-book.com',
        source: 'github',
        sourceLabel: 'Move Book',
        note: 'Move education supports building the receipt registry and future staking module.',
      },
    ],
  },
  {
    title: 'Survey AI agent payment and settlement rails',
    instructions:
      'Find current work on agent payments, x402, and on-chain settlement for autonomous agents. Return links and why each matters.',
    acceptanceCriteria: [
      'Return at least 5 source-backed items with links.',
      'Note the settlement or payment angle when visible.',
      'End with a ranked recommendation.',
    ],
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_lite',
    sources: [
      {
        title: 'x402 Payment Protocol',
        url: 'https://www.x402.org',
        source: 'github',
        sourceLabel: 'x402',
        note: 'x402 standardizes HTTP-native paid resource access for agents.',
      },
      {
        title: 'Coinbase x402 Documentation',
        url: 'https://docs.cdp.coinbase.com/x402/docs/welcome',
        source: 'github',
        sourceLabel: 'Coinbase Docs',
        note: 'x402 facilitator patterns are relevant to agent-to-agent payment settlement.',
      },
      {
        title: 'Sui Payment Links and Wallet Flows',
        url: 'https://docs.sui.io/standards',
        source: 'github',
        sourceLabel: 'Sui Docs',
        note: 'Sui payment standards can help wallet UX for paid agent jobs.',
      },
      {
        title: 'EdgePass Agent Spend Policy',
        url: 'https://github.com/fluturecode/edge',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'EdgePass shows a competing spend-policy approach for autonomous agents.',
      },
      {
        title: 'Synapse Vault Treasury Agent',
        url: 'https://github.com/SuyashAlphaC/Synapse',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'Synapse demonstrates policy-gated agent financial actions on Sui.',
      },
    ],
  },
];

export function buildSeedEvidence(task: SeedTask, index: number): ScoutEvidence {
  const generatedAt = `2026-06-19T18:${String(index).padStart(2, '0')}:00.000Z`;
  const observations: SourceObservation[] = task.sources.map((source, sourceIndex) => {
    const record = {
      title: source.title,
      url: source.url,
      note: source.note,
      source: source.source,
      recommendation: `Use ${source.title} as source-backed evidence for ${task.title}.`,
    };
    return {
      observationId: `seed_${index + 1}_obs_${sourceIndex + 1}`,
      source: source.source,
      sourceLabel: source.sourceLabel,
      endpoint: source.url,
      query: task.title,
      observedAt: generatedAt,
      title: source.title,
      url: source.url,
      score: 100 - sourceIndex,
      publishedAt: generatedAt,
      recordHash: stableHash(record),
      record,
    };
  });
  const sourceReceiptBody = {
    schema: 'tenderboard.source_receipt.v1' as const,
    generatedAt,
    query: task.title,
    observations,
    warnings: [],
  };
  const sourceReceipt: SourceReceipt = {
    ...sourceReceiptBody,
    receiptId: `seed_source_receipt_${index + 1}`,
    receiptHash: stableHash(sourceReceiptBody),
  };
  const claims: ScoutClaim[] = observations.map((observation, claimIndex) => ({
    claimId: `seed_${index + 1}_claim_${claimIndex + 1}`,
    resultIndex: claimIndex + 1,
    title: observation.title,
    url: observation.url,
    sourceObservationId: observation.observationId,
    statement: `${observation.sourceLabel} source "${observation.title}" supports the recommendation: ${
      (observation.record as { note: string }).note
    }`,
  }));
  const evidenceBody = {
    schema: 'tenderboard.scout_evidence.v1' as const,
    generatedAt,
    query: task.title,
    sourceReceipt,
    claims,
  };
  return {
    ...evidenceBody,
    evidenceHash: stableHash(evidenceBody),
  };
}

export function buildSeedDeliveryText(task: SeedTask, evidence: ScoutEvidence): string {
  const lines = evidence.claims.map((claim, index) => `${index + 1}. ${claim.title} - ${claim.url}`);
  return [
    `Completed deterministic source-backed scout for: ${task.title}`,
    '',
    'Ranked findings:',
    ...lines,
    '',
    `Recommendation: prioritize ${evidence.claims[0]?.title ?? 'the first sourced item'} because it best matches the requested work.`,
  ].join('\n');
}

async function api<T = unknown>(method: string, pathName: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE_URL}${pathName}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${pathName} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function seedOne(task: SeedTask, index: number): Promise<void> {
  const label = `[${index + 1}/${SEED_TASKS.length}] ${task.title}`;
  const created = await api<{ runId: string }>('POST', '/api/runs', {
    title: task.title,
    instructions: task.instructions,
    acceptanceCriteria: task.acceptanceCriteria,
    privateNotes: task.privateNotes,
    checkerPack: task.checkerPack,
    requestedDataLabel: task.requestedDataLabel,
    preferredBidId: task.preferredBidId,
    maxPayment: { amount: task.amount, currency: 'SUI' },
  });
  const runId = created.runId;

  const workerEvidence = buildSeedEvidence(task, index);
  await api('POST', `/api/runs/${runId}/approve-payment`, {});
  await api('POST', `/api/runs/${runId}/worker-delivery`, {
    deliveryText: buildSeedDeliveryText(task, workerEvidence),
    workerEvidence,
  });
  await api('POST', `/api/runs/${runId}/store-evidence`, {});
  const anchored = await api<{ workerAgentId?: string; walrusBlobId?: string; suiAnchorDigest?: string }>(
    'POST',
    `/api/runs/${runId}/anchor-receipt`,
    {},
  );

  console.log(
    `${label}\n   worker=${anchored.workerAgentId ?? 'n/a'} blob=${anchored.walrusBlobId ?? 'n/a'} anchor=${
      anchored.suiAnchorDigest ?? 'n/a'
    }`,
  );
}

export function validateSeedMemoryIndex(index: SeedMemoryIndexSummary, expectedRecordCount = SEED_TASKS.length): void {
  if (index.totalMemoryRecords < expectedRecordCount) {
    throw new Error(`Seed memory index only has ${index.totalMemoryRecords}/${expectedRecordCount} expected records.`);
  }
  if (index.walrusBackedRecords < expectedRecordCount) {
    throw new Error(`Seed memory index only has ${index.walrusBackedRecords}/${expectedRecordCount} Walrus-backed records.`);
  }
  if (index.suiAnchoredRecords < expectedRecordCount) {
    throw new Error(`Seed memory index only has ${index.suiAnchoredRecords}/${expectedRecordCount} Sui-anchored records.`);
  }
  const broken = (index.passports ?? []).filter(
    (passport) => passport.memoryCount > 0 && (passport.averageClaimSupport === undefined || passport.anchoredMemoryCount === 0),
  );
  if (broken.length > 0) {
    throw new Error(`Seed produced incomplete passport(s): ${broken.map((passport) => passport.workerAgentId).join(', ')}.`);
  }
}

async function main(): Promise<void> {
  console.log(`Seeding verifiable agent memory against ${BASE_URL}\n`);
  const failures: string[] = [];
  for (let index = 0; index < SEED_TASKS.length; index += 1) {
    try {
      await seedOne(SEED_TASKS[index]!, index);
    } catch (error) {
      const message = `[${index + 1}/${SEED_TASKS.length}] ${SEED_TASKS[index]!.title}: ${(error as Error).message}`;
      failures.push(message);
      console.error(`   failed: ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Seed failed for ${failures.length} task(s):\n${failures.join('\n')}`);
  }

  const index = await api<SeedMemoryIndexSummary>('GET', '/api/walrus/memory');
  validateSeedMemoryIndex(index);
  console.log(
    `\nWalrus memory index: workers=${index.workerCount} records=${index.totalMemoryRecords} walrusBacked=${index.walrusBackedRecords} suiAnchored=${index.suiAnchoredRecords}`,
  );
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === entrypointPath) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
