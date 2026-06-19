import { describe, expect, it } from 'vitest';
import { buildAgentMemoryRecord } from '../src/live/agentMemory.js';
import { assessStakeChallenge } from '../src/live/challengeOracle.js';
import type { LiveRunReceipt } from '../src/live/types.js';

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
      claimResults: [],
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
    events: [],
    error: undefined,
  };
}
