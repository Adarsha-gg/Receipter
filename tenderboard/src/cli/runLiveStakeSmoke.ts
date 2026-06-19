import { loadTenderBoardConfig } from '../live/config.js';
import { assessStakeChallenge } from '../live/challengeOracle.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import type { LiveRunReceipt } from '../live/types.js';
import {
  buildSlashStakeInputFromAssessment,
  executeCreateOracleRegistry,
  executeIssueChallengeDecision,
  executeOpenStakePosition,
  executeSlashStakeWithDecision,
} from '../sui/stakeExecutor.js';

const DEFAULT_STAKE_MIST = '1000000';
const DEFAULT_SLASH_MIST = '100000';

async function main(): Promise<void> {
  loadDotEnvFile();
  const config = loadTenderBoardConfig();
  if (config.mode !== 'sui') {
    throw new Error('Live stake smoke requires TENDERBOARD_MODE=sui.');
  }

  const workerAgentId = config.workerAgentId;
  const opened = await executeOpenStakePosition(
    {
      workerAgentId,
      amountMist: process.env.TENDERBOARD_STAKE_SMOKE_MIST ?? DEFAULT_STAKE_MIST,
    },
    config,
  );
  const assessment = await assessStakeChallenge(
    buildForgedAnchoredReceipt(workerAgentId, config.suiPackageId),
    {
      stakePositionId: opened.stakePositionId,
      reason: 'demo challenge: forged record did not match Walrus readback',
      slashAmountMist: process.env.TENDERBOARD_SLASH_SMOKE_MIST ?? DEFAULT_SLASH_MIST,
    },
    async () => new Response(JSON.stringify({ error: 'forged blob missing' }), { status: 404 }),
  );
  const slashInput = buildSlashStakeInputFromAssessment(assessment);
  const registry = config.suiStakeOracleRegistryId
    ? {
        digest: 'configured',
        oracleRegistryId: config.suiStakeOracleRegistryId,
      }
    : await executeCreateOracleRegistry(config);
  const decision = await executeIssueChallengeDecision(
    {
      ...slashInput,
      oracleRegistryId: registry.oracleRegistryId,
    },
    config,
  );
  const slashed = await executeSlashStakeWithDecision(
    {
      positionId: opened.stakePositionId,
      challengeDecisionId: decision.challengeDecisionId,
    },
    config,
  );

  console.log(
    JSON.stringify(
      {
        objectType: 'walrusproof.live_stake_slash_smoke.v1',
        ok: true,
        workerAgentId,
        packageId: config.suiPackageId,
        stakePositionId: opened.stakePositionId,
        oracleRegistryId: registry.oracleRegistryId,
        challengeDecisionId: decision.challengeDecisionId,
        challengeAdmissible: assessment.admissible,
        slashableCheckIds: assessment.slashableCheckIds,
        openedStakeMist: process.env.TENDERBOARD_STAKE_SMOKE_MIST ?? DEFAULT_STAKE_MIST,
        slashedMist: process.env.TENDERBOARD_SLASH_SMOKE_MIST ?? DEFAULT_SLASH_MIST,
        openDigest: opened.digest,
        registryDigest: registry.digest,
        decisionDigest: decision.digest,
        slashDigest: slashed.digest,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function buildForgedAnchoredReceipt(workerAgentId: string, packageId: string | undefined): LiveRunReceipt {
  const now = new Date().toISOString();
  return {
    runId: `stake_smoke_${Date.now()}`,
    mode: 'sui',
    status: 'anchored',
    createdAt: now,
    updatedAt: now,
    taskTitle: 'Forged stake slash smoke record',
    sanitizedTask: 'Task: prove challenge admissibility gates slashing.',
    maxPayment: { amount: '0.001', currency: 'SUI' },
    trustDecision: {
      workerAgentId,
      score: 90,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['Synthetic smoke record for verifier-gated slashing.'],
      controls: ['Slash only after oracle challenge assessment.'],
    },
    verificationManifest: {
      specHash: 'sha256:stake-smoke-spec',
      evidenceHash: 'sha256:forged-record-smoke',
      checkerPack: 'research',
      acceptanceCriteria: ['Walrus readback must match the anchored record.'],
      requiredChecks: [],
      summary: {
        objectType: 'suiproof.verification_summary.v1',
        admissibility: 'insufficient',
        evidenceStrength: 'sui_anchored',
        passed: 0,
        pending: 0,
        requiresReview: 1,
        blockerIds: ['walrus_readback'],
        settlementEligible: false,
        reputationEligible: false,
      },
      claimResults: [
        {
          objectType: 'suiproof.claim_verification.v1',
          claimId: 'claim_forged_smoke',
          sourceObservationId: 'source_missing',
          verdict: 'contradicted',
          supportScore: 0,
          reasons: ['Synthetic forged record for the stake/slash smoke.'],
          sourceUrl: undefined,
          sourceTitle: undefined,
          observedAt: undefined,
          publishedAt: undefined,
        },
      ],
      settlementRule: 'Slash only if the verifier marks the challenge admissible.',
      reputationWriteback: 'Do not write forged records into reputation.',
    },
    memoryRecord: {
      objectType: 'suiproof.agent_memory_record.v1',
      memoryId: 'memory_forged_stake_smoke',
      workerAgentId,
      ownerAddress: undefined,
      runId: 'stake_smoke_forged',
      taskTitle: 'Forged stake slash smoke record',
      workOrderId: undefined,
      paymentIntentId: undefined,
      selectedBidId: undefined,
      amountMist: undefined,
      amountSui: undefined,
      createdAt: now,
      updatedAt: now,
      status: 'anchored',
      summary: 'Synthetic forged record for the verifier-gated slash smoke.',
      tags: ['research', 'insufficient', 'sui_anchored', 'manual_review'],
      sourceObservationCount: 0,
      claimCount: 1,
      supportedClaimCount: 0,
      failedClaimCount: 1,
      averageClaimSupport: 0,
      verificationAdmissibility: 'insufficient',
      evidenceStrength: 'sui_anchored',
      settlementAction: 'manual_review',
      paymentDigest: undefined,
      walrusBlobId: 'forged-walrus-blob',
      walrusReadUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/forged-walrus-blob',
      suiAnchorDigest: 'stake-smoke-anchor',
      evidenceHash: 'sha256:forged-record-smoke',
      marketplaceProof: {
        paymentBound: false,
        workerSelected: true,
        sourceVerified: false,
        walrusStored: true,
        suiAnchored: true,
      },
      memoryHash: 'sha256:forged-memory-hash',
    },
    workerAgentId,
    workOrderId: undefined,
    suiNetwork: 'testnet',
    suiPackageId: packageId,
    suiReceiptRegistryId: undefined,
    suiWorkOrderObjectId: undefined,
    suiEscrowObjectId: undefined,
    suiPaymentDigest: undefined,
    suiAnchorDigest: 'stake-smoke-anchor',
    walrusBlobId: 'forged-walrus-blob',
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/forged-walrus-blob',
    deliveryText: 'Synthetic forged delivery.',
    events: [],
    error: undefined,
  };
}
