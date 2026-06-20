import { describe, expect, it } from 'vitest';
import { buildAgentMemoryRecord } from '../src/live/agentMemory.js';
import { assessStakeChallenge } from '../src/live/challengeOracle.js';
import { stableHash } from '../src/live/hash.js';
import type { LiveRunReceipt, ScoutEvidence } from '../src/live/types.js';

describe('stake challenge oracle', () => {
  it('does not admit a clean anchored record for slashing', async () => {
    const receipt = cleanAnchoredReceipt();
    receipt.memoryRecord = buildAgentMemoryRecord(receipt);

    const assessment = await assessStakeChallenge(receipt, {
      stakePositionId: '0xstake',
      reason: 'clean record should not slash',
      slashAmountMist: '100000',
    });

    expect(assessment.admissible).toBe(false);
    expect(assessment.slashableCheckIds).toEqual([]);
    expect(assessment.checks.find((check) => check.id === 'anchored_record')).toMatchObject({ status: 'passed' });
  });

  it('admits an anchored record with verifier failures and weak claims', async () => {
    const receipt = cleanAnchoredReceipt();
    receipt.verificationManifest.claimResults = [
      {
        objectType: 'suiproof.claim_verification.v1',
        claimId: 'claim_bad',
        sourceObservationId: 'source_1',
        verdict: 'contradicted',
        supportScore: 0,
        reasons: ['Source contradicts the claim.'],
        sourceUrl: 'https://example.test/source',
        sourceTitle: 'Source',
        observedAt: '2026-06-19T00:00:00.000Z',
        publishedAt: undefined,
      },
    ];
    receipt.memoryRecord = {
      ...buildAgentMemoryRecord(receipt),
      memoryHash: 'sha256:tampered',
    };

    const assessment = await assessStakeChallenge(receipt, {
      stakePositionId: '0xstake',
      reason: 'record hash and claim quality failed',
      slashAmountMist: '100000',
    });

    expect(assessment.admissible).toBe(true);
    expect(assessment.slashableCheckIds).toEqual(expect.arrayContaining(['memory_hash', 'claim:claim_bad:contradicted']));
    expect(assessment.evidenceHash).toBe('sha256:evidence');
  });
});

function cleanAnchoredReceipt(): LiveRunReceipt {
  const now = '2026-06-19T00:00:00.000Z';
  const workerEvidence = cleanWorkerEvidence(now);
  return {
    runId: 'run_challenge',
    mode: 'sui',
    status: 'anchored',
    createdAt: now,
    updatedAt: now,
    taskTitle: 'Challenge oracle task',
    sanitizedTask: 'Task: verify challenge oracle.',
    maxPayment: { amount: '0.001', currency: 'SUI' },
    trustDecision: {
      workerAgentId: 'sui_worker',
      score: 90,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['Safe task.'],
      controls: ['Verify before reputation writeback.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Return sourced claims.'],
      requiredChecks: [],
      claimResults: [
        {
          objectType: 'suiproof.claim_verification.v1',
          claimId: 'claim_1',
          sourceObservationId: 'source_1',
          verdict: 'supported',
          supportScore: 100,
          reasons: ['Claim is supported by the source record.'],
          sourceUrl: 'https://example.test/source',
          sourceTitle: 'Source',
          observedAt: now,
          publishedAt: now,
        },
      ],
      settlementRule: 'Anchor if verified.',
      reputationWriteback: 'Use anchored receipts as reputation.',
    },
    workerAgentId: 'sui_worker',
    workOrderId: undefined,
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiWorkOrderObjectId: undefined,
    suiEscrowObjectId: undefined,
    suiPaymentDigest: undefined,
    suiAnchorDigest: '0xanchor',
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: 'Delivery',
    workerEvidence,
    events: [],
    error: undefined,
  };
}

function cleanWorkerEvidence(now: string): ScoutEvidence {
  const record = { title: 'Source', url: 'https://example.test/source', detail: 'Challenge oracle task is supported.' };
  const sourceReceiptBody = {
    schema: 'tenderboard.source_receipt.v1' as const,
    generatedAt: now,
    query: 'Challenge oracle task',
    observations: [
      {
        observationId: 'source_1',
        source: 'github' as const,
        sourceLabel: 'Source',
        endpoint: 'https://example.test/source',
        query: 'Challenge oracle task',
        observedAt: now,
        title: 'Source',
        url: 'https://example.test/source',
        score: 100,
        publishedAt: now,
        recordHash: stableHash(record),
        record,
      },
    ],
    warnings: [],
  };
  const sourceReceipt = {
    ...sourceReceiptBody,
    receiptId: 'source_receipt_1',
    receiptHash: stableHash(sourceReceiptBody),
  };
  const body = {
    schema: 'tenderboard.scout_evidence.v1' as const,
    generatedAt: now,
    query: 'Challenge oracle task',
    sourceReceipt,
    claims: [
      {
        claimId: 'claim_1',
        resultIndex: 0,
        title: 'Source',
        url: 'https://example.test/source',
        sourceObservationId: 'source_1',
        statement: 'Challenge oracle task is supported by Source.',
      },
    ],
  };
  return {
    ...body,
    evidenceHash: stableHash(body),
  };
}
