import { findSecretPatternMatches } from '../policy/secretPatterns.js';
import { stableHash } from './hash.js';
import type {
  AgentMemoryPassport,
  CreateRunRequest,
  CheckerPackId,
  ClaimVerificationResult,
  LiveRunReceipt,
  ScoutClaim,
  ScoutEvidence,
  SourceObservation,
  TenderBoardConfig,
  TrustDecision,
  TrustTier,
  VerificationCheck,
  VerificationEvidenceStrength,
  VerificationManifest,
  VerificationSummary,
  WorkerBidBoard,
} from './types.js';

export interface BuildTrustProofInput {
  request: CreateRunRequest;
  sanitizedTask: string;
  removedLines: string[];
  privateNotesProvided: boolean;
  config: TenderBoardConfig;
  workerBidBoard?: WorkerBidBoard;
  workerMemoryPassport?: AgentMemoryPassport;
}

export function buildTrustDecision(input: BuildTrustProofInput): TrustDecision {
  const amount = Number(input.request.maxPayment.amount);
  const cap = Number(input.config.maxPaymentSui);
  const amountRatio = Number.isFinite(amount) && Number.isFinite(cap) && cap > 0 ? amount / cap : 1;
  const unsafeInPacket = findSecretPatternMatches([input.sanitizedTask]);
  const reasons: string[] = [];
  const controls = [
    'Private notes are never included in the worker packet.',
    'Secret-looking task lines are removed before worker dispatch.',
    'Sui payment approval is bound to the exact work order before delivery.',
    `Payment is capped at ${input.config.maxPaymentSui} SUI by config.`,
    'Final evidence must produce a Walrus blob id before Sui anchoring.',
    'Receipts exclude SDK keys, private notes, wallet secrets, and .env values.',
    'Worker execution can only proceed with an available bid that stays inside the buyer SUI cap and public data boundary.',
  ];
  const selectedBid = input.workerBidBoard?.bids.find((bid) => bid.bidId === input.workerBidBoard?.selectedBidId);
  const memoryPassport = input.workerMemoryPassport;

  let score = 92;
  if (input.removedLines.length > 0) {
    score -= Math.min(30, input.removedLines.length * 12);
    reasons.push(`${input.removedLines.length} secret-looking line(s) were removed before dispatch.`);
  } else {
    reasons.push('No secret-looking lines were found in the public worker packet.');
  }

  if (unsafeInPacket.length > 0) {
    score -= 45;
    reasons.push('The sanitized worker packet still matches a forbidden secret pattern.');
  }

  if (amountRatio > 0.8) {
    score -= 10;
    reasons.push('Requested payment is close to the configured cap.');
  } else {
    reasons.push('Requested payment is comfortably inside the configured cap.');
  }

  if (input.privateNotesProvided) {
    reasons.push('Private notes were provided and kept inside the buyer boundary.');
  }
  if (normalizedAcceptanceCriteria(input.request.acceptanceCriteria).length > 0) {
    reasons.push('Buyer-defined acceptance criteria were anchored before dispatch.');
  }
  if (input.workerBidBoard) {
    const availableBids = input.workerBidBoard.bids.filter((bid) => bid.verdict === 'available').length;
    const blockedBids = input.workerBidBoard.bids.length - availableBids;
    reasons.push(`${availableBids} worker bid(s) are available and ${blockedBids} risky bid(s) were blocked.`);
    if (!selectedBid) {
      score -= 50;
      reasons.push('No worker bid is available for Sui payment approval.');
    }
  }

  if (memoryPassport) {
    controls.push('Worker routing uses the worker Walrus memory passport before dispatch.');
    if (memoryPassport.memoryCount === 0) {
      reasons.push('Worker has no prior Walrus memory records; treating this route as a cold start.');
    } else {
      reasons.push(
        `Worker Walrus memory passport has ${memoryPassport.memoryCount} prior record(s), ${memoryPassport.walrusMemoryCount} Walrus-backed, and ${memoryPassport.anchoredMemoryCount} Sui-anchored.`,
      );
      if (memoryPassport.averageClaimSupport !== undefined) {
        reasons.push(`Prior memory average claim support is ${memoryPassport.averageClaimSupport}/100.`);
        if (memoryPassport.averageClaimSupport >= 90) {
          score += 3;
        } else if (memoryPassport.averageClaimSupport < 70) {
          score -= 15;
          reasons.push('Prior memory claim support is below the automatic-clearing threshold.');
        }
      }
    }
  }

  const workerAgentId = selectedBid?.workerAgentId ?? input.config.workerAgentId;
  reasons.push(`Worker route is pinned to ${workerAgentId}.`);

  const boundedScore = clamp(Math.round(score), 0, 100);
  const tier = tierForScore(boundedScore);
  const verdict =
    !selectedBid && input.workerBidBoard ? 'block' : unsafeInPacket.length > 0 || boundedScore < 55 ? 'block' : boundedScore < 78 ? 'review' : 'allow';

  return {
    workerAgentId,
    score: boundedScore,
    tier,
    verdict,
    pricedMultiplier: pricedMultiplierForScore(boundedScore),
    reasons,
    controls,
  };
}

export function buildVerificationManifest(input: BuildTrustProofInput): VerificationManifest {
  const buyerCriteria = normalizedAcceptanceCriteria(input.request.acceptanceCriteria);
  const acceptanceCriteria = [
    ...buyerCriteria,
    'Worker must only receive the sanitized task packet.',
    'Worker output must answer the task using public-source evidence where possible.',
    'Payment requires a Sui work order id and explicit operator approval.',
    'Final receipt must include status, Sui work order id, Sui payment digest when available, delivery, Walrus blob id when uploaded, and event timeline.',
    'Receipt must not contain private notes, SDK keys, wallet secrets, or .env values.',
  ];
  const checkerPack = input.request.checkerPack ?? 'research';
  const safePacketMatches = findSecretPatternMatches([input.sanitizedTask]);
  const checks: VerificationCheck[] = [
    {
      id: 'safe_packet',
      label: 'Safe worker packet',
      status: safePacketMatches.length === 0 ? 'passed' : 'requires_review',
      detail: safePacketMatches.length === 0 ? 'No forbidden secret pattern remains in the worker packet.' : 'Sanitized packet still needs review.',
    },
    {
      id: 'payment_cap',
      label: 'Payment cap',
      status: 'passed',
      detail: `${input.request.maxPayment.amount} ${input.request.maxPayment.currency} is within the ${input.config.maxPaymentSui} SUI configured cap.`,
    },
    {
      id: 'order_bound_approval',
      label: 'Sui work-order approval',
      status: 'pending',
      detail: 'Waiting for Sui work order id and operator approval.',
    },
    {
      id: 'delivery_evidence',
      label: 'Delivery evidence',
      status: 'pending',
      detail: 'Waiting for worker delivery.',
    },
    {
      id: 'walrus_evidence',
      label: 'Walrus evidence storage',
      status: 'pending',
      detail: 'Waiting for the full receipt and source evidence bundle to be stored on Walrus.',
    },
    {
      id: 'criteria_coverage',
      label: 'Acceptance criteria coverage',
      status: 'pending',
      detail: buyerCriteria.length > 0 ? `${buyerCriteria.length} buyer-defined criterion/criteria must be covered by the delivery.` : 'Default task-satisfaction criterion must be covered by the delivery.',
    },
    ...checksForPack(checkerPack),
    {
      id: 'reputation_signal',
      label: 'Reputation signal',
      status: 'pending',
      detail: 'Waiting for the Sui receipt anchor before reputation can be updated.',
    },
  ];

  return {
    specHash: stableHash({
      title: input.request.title,
      sanitizedTask: input.sanitizedTask,
      maxPayment: input.request.maxPayment,
      checkerPack,
      acceptanceCriteria,
      requestedDataLabel: input.request.requestedDataLabel ?? 'public',
      workerBidBoard: input.workerBidBoard,
    }),
    evidenceHash: undefined,
    checkerPack,
    acceptanceCriteria,
    requiredChecks: checks,
    summary: summarizeVerification(checks, 'none', false),
    settlementRule: 'Release payment only after safe packet creation, Sui work order creation, explicit operator approval, delivery receipt, Walrus evidence upload, and Sui anchor readiness.',
    reputationWriteback: 'Use only Sui-anchored receipts as worker reputation signals.',
    workerMemory: input.workerMemoryPassport
      ? {
          workerAgentId: input.workerMemoryPassport.workerAgentId,
          memoryCount: input.workerMemoryPassport.memoryCount,
          walrusMemoryCount: input.workerMemoryPassport.walrusMemoryCount,
          anchoredMemoryCount: input.workerMemoryPassport.anchoredMemoryCount,
          averageClaimSupport: input.workerMemoryPassport.averageClaimSupport,
          latestMemoryId: input.workerMemoryPassport.latestMemoryId,
        }
      : undefined,
  };
}

export function finalizeVerificationManifest(receipt: LiveRunReceipt, deliveryText: string | undefined): VerificationManifest {
  const claimResults = verifySourceClaims(receipt);
  const sourceEvidence = sourceEvidenceStatus(receipt, claimResults);
  const evidenceStrength = evidenceStrengthForReceipt(receipt, deliveryText, sourceEvidence.valid);
  const evidenceHash = stableHash({
    runId: receipt.runId,
    workOrderId: receipt.workOrderId,
    suiWorkOrderObjectId: receipt.suiWorkOrderObjectId,
    suiEscrowObjectId: receipt.suiEscrowObjectId,
    suiPaymentDigest: receipt.suiPaymentDigest,
    deliveryText,
    workerEvidence: receipt.workerEvidence,
    eventCount: receipt.events.length,
  });

  const requiredChecks = receipt.verificationManifest.requiredChecks.map((check) => {
    if (check.id === 'order_bound_approval') {
      return {
        ...check,
        status: receipt.workOrderId ? 'passed' : 'requires_review',
        detail: receipt.workOrderId ? `Sui work order ${receipt.workOrderId} was bound before payment approval.` : 'No Sui work order id was recorded.',
      } satisfies VerificationCheck;
    }
    if (check.id === 'delivery_evidence') {
      const deliveryPresent = Boolean(deliveryText?.trim());
      return {
        ...check,
        status: deliveryPresent ? 'passed' : 'requires_review',
        detail: deliveryPresent ? `Delivery evidence hash ${evidenceHash}.` : 'No delivery text was recorded.',
      } satisfies VerificationCheck;
    }
    if (check.id === 'walrus_evidence') {
      return {
        ...check,
        status: receipt.walrusBlobId ? 'passed' : deliveryText ? 'pending' : 'pending',
        detail: receipt.walrusBlobId
          ? `Walrus evidence bundle ${receipt.walrusBlobId} is bound to the receipt.`
          : 'Waiting for Walrus storage before Sui anchoring.',
      } satisfies VerificationCheck;
    }
    if (check.id === 'reputation_signal') {
      return {
        ...check,
        status: receipt.suiAnchorDigest ? 'passed' : 'pending',
        detail: receipt.suiAnchorDigest
          ? `Sui anchor ${receipt.suiAnchorDigest} makes this receipt eligible for reputation write-back.`
          : deliveryText
            ? 'Receipt is a reputation candidate; waiting for Sui anchor before WorkerReputationUpdated.'
            : 'Waiting for delivery and Sui anchor before reputation write-back.',
      } satisfies VerificationCheck;
    }
    if (check.id === 'criteria_coverage') {
      const criteriaCovered = Boolean(deliveryText?.trim()) && sourceEvidence.valid;
      return {
        ...check,
        status: criteriaCovered ? 'passed' : deliveryText ? 'requires_review' : 'pending',
        detail: criteriaCovered
          ? 'Built-in checker accepted the delivery because source-backed claims are present and bound to observations.'
          : deliveryText
            ? 'Delivery is present but lacks enough source-backed evidence to cover acceptance criteria automatically.'
            : check.detail,
      } satisfies VerificationCheck;
    }
    if (check.id === 'public_sources') {
      return {
        ...check,
        status: sourceEvidence.valid ? 'passed' : deliveryText ? 'requires_review' : 'pending',
        detail: sourceEvidence.valid
          ? `Source receipt contains ${sourceEvidence.observationCount} observation(s) and ${sourceEvidence.claimCount} supported claim(s).`
          : deliveryText
            ? sourceEvidence.detail
            : check.detail,
      } satisfies VerificationCheck;
    }
    if (['test_result', 'schema_match', 'price_bound', 'merchant_source'].includes(check.id)) {
      return {
        ...check,
        status: deliveryText ? 'requires_review' : 'pending',
        detail: deliveryText ? `${check.label} needs a specialized checker before settlement can proceed.` : check.detail,
      } satisfies VerificationCheck;
    }
    return check;
  });

  return {
    ...receipt.verificationManifest,
    evidenceHash,
    requiredChecks,
    summary: summarizeVerification(requiredChecks, evidenceStrength, Boolean(receipt.suiAnchorDigest)),
    claimResults,
  };
}

export function validateScoutEvidenceIntegrity(workerEvidence: ScoutEvidence | undefined): string[] {
  const failures: string[] = [];
  const sourceReceipt = workerEvidence?.sourceReceipt;
  const observations = sourceReceipt?.observations ?? [];

  if (!workerEvidence) {
    return ['Worker delivery must include structured source evidence.'];
  }
  if (workerEvidence.schema !== 'tenderboard.scout_evidence.v1') {
    failures.push('Worker evidence schema is not tenderboard.scout_evidence.v1.');
  }
  if (!workerEvidence.evidenceHash?.startsWith('sha256:')) {
    failures.push('Worker evidence hash is missing or malformed.');
  }
  if (!sourceReceipt) {
    failures.push('Worker evidence must include a source receipt.');
  } else {
    if (sourceReceipt.schema !== 'tenderboard.source_receipt.v1') {
      failures.push('Source receipt schema is not tenderboard.source_receipt.v1.');
    }
    if (!sourceReceipt.receiptHash?.startsWith('sha256:')) {
      failures.push('Source receipt hash is missing or malformed.');
    }

    const sourceReceiptHash = stableHash({
      schema: sourceReceipt.schema,
      generatedAt: sourceReceipt.generatedAt,
      query: sourceReceipt.query,
      observations: sourceReceipt.observations,
      warnings: sourceReceipt.warnings,
    });
    if (sourceReceipt.receiptHash !== sourceReceiptHash) {
      failures.push('Source receipt hash does not match its contents.');
    }
  }

  const evidenceHash = stableHash({
    schema: workerEvidence.schema,
    generatedAt: workerEvidence.generatedAt,
    query: workerEvidence.query,
    sourceReceipt: workerEvidence.sourceReceipt,
    claims: workerEvidence.claims,
  });
  if (workerEvidence.evidenceHash !== evidenceHash) {
    failures.push('Worker evidence hash does not match its contents.');
  }

  for (const observation of observations) {
    const recomputedRecordHash = stableHash(observation.record);
    if (!observation.recordHash?.startsWith('sha256:')) {
      failures.push(`Source observation ${observation.observationId} record hash is missing or malformed.`);
    } else if (observation.recordHash !== recomputedRecordHash) {
      failures.push(`Source observation ${observation.observationId} record hash does not match its record.`);
    }
  }

  const observationIds = new Set(observations.map((observation) => observation.observationId));
  for (const claim of workerEvidence.claims ?? []) {
    if (!observationIds.has(claim.sourceObservationId)) {
      failures.push(`Source claim ${claim.claimId} is not bound to an observation.`);
    }
  }

  return failures;
}

export function buildTrustProof(input: BuildTrustProofInput): {
  trustDecision: TrustDecision;
  verificationManifest: VerificationManifest;
} {
  return {
    trustDecision: buildTrustDecision(input),
    verificationManifest: buildVerificationManifest(input),
  };
}

function tierForScore(score: number): TrustTier {
  if (score >= 95) return 'AAA';
  if (score >= 88) return 'AA';
  if (score >= 78) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

function pricedMultiplierForScore(score: number): number {
  if (score >= 88) return 1;
  if (score >= 78) return 1.5;
  if (score >= 60) return 2.5;
  return 4;
}

function normalizedAcceptanceCriteria(criteria: string[] | undefined): string[] {
  return (criteria ?? [])
    .map((criterion) => criterion.trim())
    .filter((criterion) => criterion.length > 0)
    .slice(0, 8);
}

function checksForPack(checkerPack: CheckerPackId): VerificationCheck[] {
  if (checkerPack === 'code') {
    return [
      {
        id: 'test_result',
        label: 'Test result evidence',
        status: 'pending',
        detail: 'Worker delivery should include the failing test, fix summary, and green test output.',
      },
      {
        id: 'schema_match',
        label: 'Patch schema',
        status: 'pending',
        detail: 'Worker delivery should separate changed files, verification commands, and residual risks.',
      },
    ];
  }

  if (checkerPack === 'commerce') {
    return [
      {
        id: 'price_bound',
        label: 'Price bound',
        status: 'pending',
        detail: 'Worker delivery should prove quoted prices stay within buyer budget and constraints.',
      },
      {
        id: 'merchant_source',
        label: 'Merchant/source evidence',
        status: 'pending',
        detail: 'Worker delivery should include public source links for listings, vendors, or providers.',
      },
    ];
  }

  return [
    {
      id: 'public_sources',
      label: 'Public source evidence',
      status: 'pending',
      detail: 'Worker delivery should include public links that support the recommendation.',
    },
  ];
}

function summarizeVerification(checks: VerificationCheck[], evidenceStrength: VerificationEvidenceStrength, anchored: boolean): VerificationSummary {
  const blockerIds = checks.filter((check) => check.status !== 'passed').map((check) => check.id);
  const passed = checks.filter((check) => check.status === 'passed').length;
  const pending = checks.filter((check) => check.status === 'pending').length;
  const requiresReview = checks.filter((check) => check.status === 'requires_review').length;
  const settlementBlockers = blockerIds.filter((id) => id !== 'reputation_signal');
  const settlementEligible = settlementBlockers.length === 0 && evidenceStrength !== 'none' && evidenceStrength !== 'delivery_only';
  const reputationEligible = anchored && blockerIds.length === 0 && evidenceStrength === 'sui_anchored';
  const admissibility =
    checks.some((check) => check.status === 'requires_review') || evidenceStrength === 'delivery_only'
      ? 'insufficient'
      : settlementEligible
        ? 'admissible'
        : 'pending';

  return {
    objectType: 'suiproof.verification_summary.v1',
    admissibility,
    evidenceStrength,
    passed,
    pending,
    requiresReview,
    blockerIds,
    settlementEligible,
    reputationEligible,
  };
}

function evidenceStrengthForReceipt(
  receipt: LiveRunReceipt,
  deliveryText: string | undefined,
  sourceEvidenceValid: boolean,
): VerificationEvidenceStrength {
  if (receipt.suiAnchorDigest) return 'sui_anchored';
  if (receipt.walrusBlobId) return 'walrus_backed';
  if (sourceEvidenceValid) return 'source_receipt';
  if (deliveryText?.trim()) return 'delivery_only';
  return 'none';
}

function sourceEvidenceStatus(receipt: LiveRunReceipt, claimResults: ClaimVerificationResult[]): {
  valid: boolean;
  observationCount: number;
  claimCount: number;
  detail: string;
} {
  const sourceReceipt = receipt.workerEvidence?.sourceReceipt;
  const claims = receipt.workerEvidence?.claims ?? [];
  const observations = sourceReceipt?.observations ?? [];
  const integrityFailures = validateScoutEvidenceIntegrity(receipt.workerEvidence);
  if (integrityFailures.length > 0) {
    return {
      valid: false,
      observationCount: observations.length,
      claimCount: claims.length,
      detail: integrityFailures[0] ?? 'Worker source evidence failed integrity validation.',
    };
  }
  if (observations.length === 0) {
    return { valid: false, observationCount: 0, claimCount: claims.length, detail: 'Source receipt contains no observations.' };
  }
  if (claims.length === 0) {
    return { valid: false, observationCount: observations.length, claimCount: 0, detail: 'Worker evidence contains no source-backed claims.' };
  }

  const failedClaims = claimResults.filter((result) => result.verdict !== 'supported');
  if (failedClaims.length > 0) {
    return {
      valid: false,
      observationCount: observations.length,
      claimCount: claims.length,
      detail: `${failedClaims.length} claim(s) failed claim support verification.`,
    };
  }

  return {
    valid: true,
    observationCount: observations.length,
    claimCount: claims.length,
    detail: 'Source receipt is valid.',
  };
}

function verifySourceClaims(receipt: LiveRunReceipt): ClaimVerificationResult[] {
  const sourceReceipt = receipt.workerEvidence?.sourceReceipt;
  const claims = receipt.workerEvidence?.claims ?? [];
  const observations = new Map((sourceReceipt?.observations ?? []).map((observation) => [observation.observationId, observation]));
  return claims.map((claim) => verifyClaimSupport(claim, observations.get(claim.sourceObservationId), sourceReceipt?.generatedAt));
}

function verifyClaimSupport(
  claim: ScoutClaim,
  observation: SourceObservation | undefined,
  receiptGeneratedAt: string | undefined,
): ClaimVerificationResult {
  if (!observation) {
    return claimResult(claim, undefined, 'unbound', 0, ['Claim is not bound to a source observation.']);
  }

  const reasons: string[] = [];
  let score = 100;

  if (claim.url !== observation.url) {
    score -= 35;
    reasons.push('Claim URL does not match source observation URL.');
  } else {
    reasons.push('Claim URL matches source observation URL.');
  }

  const titleOverlap = tokenOverlap(claim.title, observation.title);
  if (titleOverlap < 0.45) {
    score -= 30;
    reasons.push('Claim title is weakly supported by source observation title.');
  } else {
    reasons.push('Claim title is supported by source observation title.');
  }

  const statementOverlap = Math.max(
    tokenOverlap(claim.statement, observation.title),
    tokenOverlap(claim.statement, JSON.stringify(observation.record)),
  );
  if (statementOverlap < 0.2) {
    score -= 20;
    reasons.push('Claim statement has weak overlap with the source record.');
  } else {
    reasons.push('Claim statement is grounded in the source record.');
  }

  const recomputedRecordHash = stableHash(observation.record);
  if (!observation.recordHash?.startsWith('sha256:')) {
    score -= 20;
    reasons.push('Source observation record hash is missing or malformed.');
  } else if (observation.recordHash !== recomputedRecordHash) {
    score -= 35;
    reasons.push('Source observation record hash does not match the source record.');
  } else {
    reasons.push('Source observation record hash matches the source record.');
  }

  const stale = isStale(observation.publishedAt, receiptGeneratedAt ?? observation.observedAt);
  if (stale) {
    score -= 25;
    reasons.push('Source observation is stale for automatic clearing.');
  }

  const verdict = stale ? 'stale' : score >= 70 ? 'supported' : score >= 40 ? 'weak' : 'contradicted';
  return claimResult(claim, observation, verdict, Math.max(0, Math.min(100, Math.round(score))), reasons);
}

function claimResult(
  claim: ScoutClaim,
  observation: SourceObservation | undefined,
  verdict: ClaimVerificationResult['verdict'],
  supportScore: number,
  reasons: string[],
): ClaimVerificationResult {
  return {
    objectType: 'suiproof.claim_verification.v1',
    claimId: claim.claimId,
    sourceObservationId: claim.sourceObservationId,
    verdict,
    supportScore,
    reasons,
    sourceUrl: observation?.url,
    sourceTitle: observation?.title,
    observedAt: observation?.observedAt,
    publishedAt: observation?.publishedAt,
  };
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / leftTokens.size;
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2)
      .filter((token) => !CLAIM_STOP_WORDS.has(token)),
  );
}

function isStale(publishedAt: string | undefined, generatedAt: string | undefined): boolean {
  if (!publishedAt || !generatedAt) return false;
  const published = new Date(publishedAt).getTime();
  const generated = new Date(generatedAt).getTime();
  if (!Number.isFinite(published) || !Number.isFinite(generated)) return false;
  const days = Math.abs(generated - published) / (24 * 60 * 60 * 1000);
  return days > 365;
}

const CLAIM_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'source',
  'result',
  'used',
  'rendered',
  'opportunity',
  'scout',
  'report',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
