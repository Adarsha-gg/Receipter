import { buildClearingObjects } from './clearingObjects.js';
import { stableHash } from './hash.js';
import type { LiveRunReceipt, ScoutClaim, ScoutEvidence, SourceObservation, SourceReceipt, TenderBoardConfig } from './types.js';
import type { WalrusStoreResult } from './walrusRuntime.js';

export interface MemorySmokeReadback {
  ok: boolean;
  httpStatus: number | undefined;
  byteLength: number;
  containsRunId: boolean;
  containsEvidenceSchema: boolean;
}

export function buildLiveMemorySmokeReceipt(config: TenderBoardConfig, now = new Date()): LiveRunReceipt {
  const createdAt = now.toISOString();
  const runId = `memwal_smoke_${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`;
  const workerAgentId = config.workerAgentId;
  const evidence = buildSmokeEvidence(runId, createdAt);
  const specHash = stableHash({
    runId,
    task: 'MemWal live adapter smoke',
    checkerPack: 'research',
    acceptanceCriteria: ['Store the proof bundle on Walrus.', 'Write a searchable reputation fact through MemWal.'],
  });

  const receipt: LiveRunReceipt = {
    runId,
    mode: 'sui',
    status: 'delivered',
    createdAt,
    updatedAt: createdAt,
    taskTitle: 'MemWal live adapter smoke',
    sanitizedTask: 'Store one WalrusProof work-memory bundle and write the distilled reputation fact to MemWal.',
    privacy: {
      requestedDataLabel: 'public',
      privateNotesProvided: false,
      workerDataBoundary: 'Only public smoke-test metadata is included.',
    },
    maxPayment: { amount: config.maxPaymentSui, currency: 'SUI' },
    workerBidBoard: {
      buyerMaxPayment: { amount: config.maxPaymentSui, currency: 'SUI' },
      requestedDataLabel: 'public',
      selectedBidId: 'memwal_smoke_bid',
      bids: [
        {
          bidId: 'memwal_smoke_bid',
          workerAgentId,
          priceSui: '0.000',
          sla: 'smoke',
          requestedDataLabel: 'public',
          riskFlags: [],
          verdict: 'available',
          reason: 'Backend smoke writes only public verification metadata.',
        },
      ],
    },
    hirerAgent: {
      objectType: 'suiproof.market_agent.v1',
      agentId: 'walrusproof.smoke.hirer',
      role: 'hirer',
      ownerAddress: config.suiOperatorAddress,
      displayName: 'WalrusProof Smoke Hirer',
      responsibilities: ['Exercise the memory backend.', 'Verify Walrus readback.'],
      controls: ['No private notes.', 'No payment settlement.'],
      budgetSui: config.maxPaymentSui,
      priceSui: undefined,
      requestedDataLabel: 'public',
    },
    workerAgent: {
      objectType: 'suiproof.market_agent.v1',
      agentId: workerAgentId,
      role: 'worker',
      ownerAddress: config.workerAgentAddress,
      displayName: 'WalrusProof Smoke Worker',
      responsibilities: ['Produce source-backed smoke evidence.', 'Write memory through the configured backend.'],
      controls: ['Public evidence only.', 'Receipt-bound memory write.'],
      budgetSui: undefined,
      priceSui: '0.000',
      requestedDataLabel: 'public',
    },
    agentHandoff: {
      objectType: 'suiproof.agent_handoff.v1',
      handoffId: `handoff_${runId}`,
      hirerAgentId: 'walrusproof.smoke.hirer',
      workerAgentId,
      selectedBidId: 'memwal_smoke_bid',
      safePacketHash: stableHash({ runId, safePacket: 'memwal smoke' }),
      specHash,
      paymentIntentId: undefined,
      status: 'ready_to_anchor',
    },
    trustDecision: {
      workerAgentId,
      score: 100,
      tier: 'AAA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['Backend smoke contains only public metadata.'],
      controls: ['Memory backend must produce a Walrus blob and readable aggregator URL.'],
    },
    verificationManifest: {
      specHash,
      evidenceHash: evidence.evidenceHash,
      checkerPack: 'research',
      acceptanceCriteria: ['Store the proof bundle on Walrus.', 'Write a searchable reputation fact through MemWal.'],
      requiredChecks: [
        { id: 'public_metadata', label: 'Public metadata only', status: 'passed', detail: 'No private note fields are present.' },
        { id: 'source_claims', label: 'Source-backed claims', status: 'passed', detail: 'Smoke evidence includes supported source claims.' },
      ],
      summary: {
        objectType: 'suiproof.verification_summary.v1',
        admissibility: 'admissible',
        evidenceStrength: 'source_receipt',
        passed: 2,
        pending: 0,
        requiresReview: 0,
        blockerIds: [],
        settlementEligible: true,
        reputationEligible: true,
      },
      claimResults: evidence.claims.map((claim) => ({
        objectType: 'suiproof.claim_verification.v1',
        claimId: claim.claimId,
        sourceObservationId: claim.sourceObservationId,
        verdict: 'supported',
        supportScore: 1,
        reasons: ['Claim is bound to the smoke source observation.'],
        sourceUrl: claim.url,
        sourceTitle: claim.title,
        observedAt: createdAt,
        publishedAt: createdAt,
      })),
      settlementRule: 'Smoke records are memory-backend tests and do not release payment.',
      reputationWriteback: 'Write as a backend smoke fact, not as paid production reputation.',
    },
    workerAgentId,
    workOrderId: `memory_smoke_${runId}`,
    suiNetwork: config.suiNetwork,
    suiPackageId: config.suiPackageId,
    suiReceiptRegistryId: config.suiReceiptRegistryId,
    suiWorkOrderObjectId: undefined,
    suiEscrowObjectId: undefined,
    suiPaymentDigest: undefined,
    suiAnchorDigest: undefined,
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: 'WalrusProof MemWal live smoke produced public source-backed evidence for a backend memory write.',
    workerEvidence: evidence,
    events: [
      {
        at: createdAt,
        source: 'app',
        type: 'memory_backend_smoke',
        message: 'Prepared one public WalrusProof memory bundle for live backend smoke.',
      },
    ],
    error: undefined,
  };

  return {
    ...receipt,
    ...buildClearingObjects(receipt),
  };
}

export async function verifyWalrusSmokeReadback(
  walrus: WalrusStoreResult,
  expectedRunId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<MemorySmokeReadback> {
  if (!walrus.readUrl) {
    return {
      ok: false,
      httpStatus: undefined,
      byteLength: 0,
      containsRunId: false,
      containsEvidenceSchema: false,
    };
  }

  const response = await fetchImpl(walrus.readUrl);
  const text = await response.text();
  const containsRunId = text.includes(`"runId": "${expectedRunId}"`);
  const containsEvidenceSchema = text.includes('"schema": "tenderboard.sui.evidence.v1"');
  return {
    ok: response.ok && containsRunId && containsEvidenceSchema,
    httpStatus: response.status,
    byteLength: text.length,
    containsRunId,
    containsEvidenceSchema,
  };
}

function buildSmokeEvidence(runId: string, generatedAt: string): ScoutEvidence {
  const query = 'walrusproof memwal live smoke';
  const observations: SourceObservation[] = [
    {
      observationId: `source_memwal_${stableHash({ runId, source: 'memwal' }).slice('sha256:'.length, 'sha256:'.length + 12)}`,
      source: 'github',
      sourceLabel: 'GitHub',
      endpoint: 'https://github.com/MystenLabs/walrus',
      query,
      observedAt: generatedAt,
      title: 'Walrus verifiable storage',
      url: 'https://github.com/MystenLabs/walrus',
      score: undefined,
      publishedAt: generatedAt,
      recordHash: stableHash({ url: 'https://github.com/MystenLabs/walrus', runId }),
      record: {
        url: 'https://github.com/MystenLabs/walrus',
        note: 'Walrus backs the durable proof bundle for this memory smoke.',
      },
    },
  ];
  const sourceReceiptBody = {
    schema: 'tenderboard.source_receipt.v1' as const,
    generatedAt,
    query,
    observations,
    warnings: [] as string[],
  };
  const sourceReceipt: SourceReceipt = {
    ...sourceReceiptBody,
    receiptId: `source_receipt_${stableHash(sourceReceiptBody).slice('sha256:'.length, 'sha256:'.length + 16)}`,
    receiptHash: stableHash(sourceReceiptBody),
  };
  const claims: ScoutClaim[] = observations.map((observation, index) => ({
    claimId: `claim_${index + 1}_${observation.observationId}`,
    resultIndex: index + 1,
    title: observation.title,
    url: observation.url,
    sourceObservationId: observation.observationId,
    statement: `${observation.title} is the public source for the WalrusProof memory smoke.`,
  }));
  const evidenceBody = {
    schema: 'tenderboard.scout_evidence.v1' as const,
    generatedAt,
    query,
    sourceReceipt,
    claims,
  };
  return {
    ...evidenceBody,
    evidenceHash: stableHash(evidenceBody),
  };
}
