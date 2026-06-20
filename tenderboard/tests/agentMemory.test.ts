import { describe, expect, it } from 'vitest';
import { buildAgentMemoryPassport, buildWalrusMemoryIndex } from '../src/live/agentMemory.js';
import type { LiveRunReceipt, MarketAgentProfile } from '../src/live/types.js';

describe('agent memory passport bindings', () => {
  it('carries Sui AgentPassport ownership and latest proof pointers', () => {
    const receipt = sampleReceipt({
      workerAgent: sampleWorkerAgent({ ownerAddress: '0xowner' }),
      walrusBlobId: 'walrus_latest',
      suiAnchorDigest: '0xanchor_latest',
    });

    const passport = buildAgentMemoryPassport('worker_1', [receipt], '2026-06-20T00:00:00.000Z', {
      passportBindings: [{ workerAgentId: 'worker_1', ownerAddress: '0xowner', passportObjectId: '0xpassport' }],
    });

    expect(passport.ownerAddress).toBe('0xowner');
    expect(passport.passportObjectId).toBe('0xpassport');
    expect(passport.ownership).toEqual({
      chain: 'sui',
      address: '0xowner',
      passportObjectId: '0xpassport',
      proof: 'agent_passport_object',
    });
    expect(passport.chainOwnershipProof).toMatchObject({
      status: 'chain_bound',
      proof: 'agent_passport_object',
      ownerAddress: '0xowner',
      passportObjectId: '0xpassport',
    });
    expect(passport.latestMemoryPointer).toMatchObject({
      runId: 'run_1',
      memoryHash: expect.stringMatching(/^sha256:/),
    });
    expect(passport.latestWalrusBlobId).toBe('walrus_latest');
    expect(passport.latestSuiAnchorDigest).toBe('0xanchor_latest');
  });

  it('marks owner-only and fully unbound passports explicitly', () => {
    const ownerOnly = buildAgentMemoryPassport(
      'worker_1',
      [sampleReceipt({ workerAgent: sampleWorkerAgent({ ownerAddress: '0xowner' }) })],
      '2026-06-20T00:00:00.000Z',
    );
    const unbound = buildAgentMemoryPassport('worker_2', [sampleReceipt({ workerAgentId: 'worker_2' })], '2026-06-20T00:00:00.000Z');

    expect(ownerOnly.chainOwnershipProof.status).toBe('owner_address_only');
    expect(ownerOnly.ownership.proof).toBe('owner_address_only');
    expect(ownerOnly.passportObjectId).toBeUndefined();
    expect(unbound.chainOwnershipProof.status).toBe('unbound');
    expect(unbound.ownership).toEqual({
      chain: 'sui',
      address: undefined,
      passportObjectId: undefined,
      proof: 'unbound',
    });
  });

  it('includes latest memory, Walrus, Sui, and passport binding data in the memory index entries', () => {
    const older = sampleReceipt({
      runId: 'run_old',
      updatedAt: '2026-06-19T00:00:00.000Z',
      walrusBlobId: 'walrus_old',
      suiAnchorDigest: '0xanchor_old',
    });
    const newer = sampleReceipt({
      runId: 'run_new',
      updatedAt: '2026-06-20T00:00:00.000Z',
      walrusBlobId: 'walrus_new',
      suiAnchorDigest: '0xanchor_new',
    });

    const index = buildWalrusMemoryIndex([older, newer], '2026-06-20T01:00:00.000Z', {
      passportBindings: { worker_1: { workerAgentId: 'worker_1', ownerAddress: '0xowner', passportObjectId: '0xpassport' } },
    });

    expect(index.latestMemoryPointer).toMatchObject({ workerAgentId: 'worker_1', runId: 'run_new' });
    expect(index.latestWalrusBlobId).toBe('walrus_new');
    expect(index.latestSuiAnchorDigest).toBe('0xanchor_new');
    expect(index.passports[0]).toMatchObject({
      workerAgentId: 'worker_1',
      ownerAddress: '0xowner',
      passportObjectId: '0xpassport',
      latestWalrusBlobId: 'walrus_new',
      latestSuiAnchorDigest: '0xanchor_new',
    });
  });
});

function sampleReceipt(overrides: Partial<LiveRunReceipt> = {}): LiveRunReceipt {
  const runId = overrides.runId ?? 'run_1';
  const updatedAt = overrides.updatedAt ?? '2026-06-20T00:00:00.000Z';
  const workerAgentId = overrides.workerAgentId ?? 'worker_1';
  const receipt: LiveRunReceipt = {
    runId,
    mode: 'sui',
    status: 'anchored',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt,
    taskTitle: 'Verify public opportunity',
    sanitizedTask: 'Verify public opportunity',
    maxPayment: { amount: '0.035', currency: 'SUI' },
    trustDecision: {
      workerAgentId,
      score: 92,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: [],
      controls: [],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Use public sources.'],
      requiredChecks: [],
      settlementRule: 'anchor when admissible',
      reputationWriteback: 'append to passport',
      claimResults: [{ objectType: 'suiproof.claim_verification.v1', claimId: 'claim_1', sourceObservationId: 'obs_1', verdict: 'supported', supportScore: 96, reasons: [], sourceUrl: undefined, sourceTitle: undefined, observedAt: undefined, publishedAt: undefined }],
    },
    workerAgentId,
    workOrderId: undefined,
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiWorkOrderObjectId: undefined,
    suiEscrowObjectId: undefined,
    suiPaymentDigest: '0xpayment',
    suiAnchorDigest: overrides.suiAnchorDigest ?? '0xanchor',
    walrusBlobId: overrides.walrusBlobId ?? 'walrus_blob',
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: 'Delivered.',
    events: [],
    error: undefined,
  };
  return {
    ...receipt,
    ...(overrides.workerAgent ? { workerAgent: overrides.workerAgent } : {}),
    ...overrides,
  };
}

function sampleWorkerAgent(overrides: Partial<MarketAgentProfile> = {}): MarketAgentProfile {
  return {
    objectType: 'suiproof.market_agent.v1',
    agentId: 'worker_1',
    role: 'worker',
    displayName: 'Worker',
    responsibilities: [],
    controls: [],
    budgetSui: undefined,
    priceSui: '0.035',
    requestedDataLabel: 'public',
    ...overrides,
  };
}
