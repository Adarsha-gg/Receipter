import { stableHash } from './hash.js';
import { verifyMemoryRecord, type VerificationCheck as MemoryVerificationCheck } from './memoryVerifier.js';
import type { ClaimVerificationResult, LiveRunReceipt } from './types.js';

export interface StakeChallengeRequest {
  stakePositionId: string;
  reason: string;
  slashAmountMist?: string | undefined;
  challengerAddress?: string | undefined;
}

export interface StakeChallengeCheck {
  id: string;
  status: 'passed' | 'failed' | 'skipped';
  detail: string;
}

export interface StakeChallengeAssessment {
  objectType: 'walrusproof.stake_challenge_assessment.v1';
  runId: string;
  workerAgentId: string;
  stakePositionId: string;
  challengerAddress: string | undefined;
  evidenceHash: string;
  reason: string;
  requestedSlashAmountMist: string | undefined;
  admissible: boolean;
  checks: StakeChallengeCheck[];
  verifierFailures: MemoryVerificationCheck[];
  weakClaims: ClaimVerificationResult[];
  slashableCheckIds: string[];
}

export async function assessStakeChallenge(
  receipt: LiveRunReceipt,
  request: StakeChallengeRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<StakeChallengeAssessment> {
  validateChallengeRequest(request);

  const verification = await verifyMemoryRecord(receipt, fetchImpl);
  const verifierFailures = verification.checks.filter((check) => check.status === 'failed');
  const weakClaims = (receipt.verificationManifest.claimResults ?? []).filter((claim) => claim.verdict !== 'supported');
  const checks: StakeChallengeCheck[] = [
    anchoredRecordCheck(receipt),
    verifierFailureCheck(verifierFailures),
    weakClaimCheck(weakClaims),
  ];
  const admissible = checks.find((check) => check.id === 'anchored_record')?.status === 'passed'
    && (verifierFailures.length > 0 || weakClaims.length > 0);
  const evidenceHash = receipt.verificationManifest.evidenceHash
    ?? receipt.memoryRecord?.evidenceHash
    ?? stableHash({
      runId: receipt.runId,
      workerAgentId: receipt.workerAgentId,
      stakePositionId: request.stakePositionId,
      reason: request.reason,
    });

  return {
    objectType: 'walrusproof.stake_challenge_assessment.v1',
    runId: receipt.runId,
    workerAgentId: receipt.workerAgentId,
    stakePositionId: request.stakePositionId,
    challengerAddress: request.challengerAddress,
    evidenceHash,
    reason: request.reason,
    requestedSlashAmountMist: request.slashAmountMist,
    admissible,
    checks,
    verifierFailures,
    weakClaims,
    slashableCheckIds: [
      ...verifierFailures.map((check) => check.id),
      ...weakClaims.map((claim) => `claim:${claim.claimId}:${claim.verdict}`),
    ],
  };
}

export function assertStakeChallengeAdmissible(assessment: StakeChallengeAssessment): void {
  if (!assessment.admissible) {
    const failed = assessment.checks
      .filter((check) => check.status !== 'passed')
      .map((check) => `${check.id}: ${check.detail}`)
      .join('; ');
    throw new Error(`Stake challenge is not slash-admissible${failed ? ` (${failed})` : ''}.`);
  }
}

function anchoredRecordCheck(receipt: LiveRunReceipt): StakeChallengeCheck {
  if (!receipt.suiAnchorDigest) {
    return { id: 'anchored_record', status: 'failed', detail: 'Only Sui-anchored reputation records can be slashed.' };
  }
  if (!receipt.memoryRecord?.marketplaceProof.suiAnchored) {
    return { id: 'anchored_record', status: 'failed', detail: 'Record has a Sui digest but its memory proof is not marked anchored.' };
  }
  return { id: 'anchored_record', status: 'passed', detail: `Record is anchored by ${receipt.suiAnchorDigest}.` };
}

function verifierFailureCheck(failures: MemoryVerificationCheck[]): StakeChallengeCheck {
  if (failures.length === 0) {
    return { id: 'verifier_failures', status: 'skipped', detail: 'No cryptographic verifier failure was found.' };
  }
  return {
    id: 'verifier_failures',
    status: 'passed',
    detail: `${failures.length} verifier failure(s): ${failures.map((failure) => failure.id).join(', ')}.`,
  };
}

function weakClaimCheck(weakClaims: ClaimVerificationResult[]): StakeChallengeCheck {
  if (weakClaims.length === 0) {
    return { id: 'weak_or_contradicted_claims', status: 'skipped', detail: 'No weak, stale, unbound, or contradicted claim was found.' };
  }
  return {
    id: 'weak_or_contradicted_claims',
    status: 'passed',
    detail: `${weakClaims.length} claim issue(s): ${weakClaims.map((claim) => `${claim.claimId}:${claim.verdict}`).join(', ')}.`,
  };
}

function validateChallengeRequest(request: StakeChallengeRequest): void {
  if (!request || typeof request !== 'object') {
    throw new Error('Stake challenge request is required.');
  }
  if (!request.stakePositionId || typeof request.stakePositionId !== 'string') {
    throw new Error('stakePositionId is required.');
  }
  if (!request.reason || typeof request.reason !== 'string' || request.reason.trim().length < 8) {
    throw new Error('reason must explain the challenge.');
  }
  if (request.slashAmountMist !== undefined && !/^[0-9]+$/.test(request.slashAmountMist)) {
    throw new Error('slashAmountMist must be an integer MIST amount.');
  }
}
