import { findSecretPatternMatches } from '../policy/secretPatterns.js';
import { stableHash } from './hash.js';
import type {
  CreateRunRequest,
  CheckerPackId,
  LiveRunReceipt,
  TenderBoardConfig,
  TrustDecision,
  TrustTier,
  VerificationCheck,
  VerificationManifest,
  WorkerBidBoard,
} from './types.js';

export interface BuildTrustProofInput {
  request: CreateRunRequest;
  sanitizedTask: string;
  removedLines: string[];
  privateNotesProvided: boolean;
  config: TenderBoardConfig;
  workerBidBoard?: WorkerBidBoard;
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
      detail: 'Waiting for final receipt to become a write-back candidate.',
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
    settlementRule: 'Release payment only after safe packet creation, Sui work order creation, explicit operator approval, delivery receipt, Walrus evidence upload, and Sui anchor readiness.',
    reputationWriteback: 'Use the final Sui-anchored receipt as the worker and checker reputation signal.',
  };
}

export function finalizeVerificationManifest(receipt: LiveRunReceipt, deliveryText: string | undefined): VerificationManifest {
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
      return {
        ...check,
        status: deliveryText ? 'passed' : 'requires_review',
        detail: deliveryText ? `Delivery evidence hash ${evidenceHash}.` : 'No delivery text was recorded.',
      } satisfies VerificationCheck;
    }
    if (check.id === 'reputation_signal') {
      return {
        ...check,
        status: deliveryText ? 'passed' : 'pending',
        detail: deliveryText ? 'Receipt is complete enough to become reputation feedback.' : 'Waiting for delivery before reputation write-back.',
      } satisfies VerificationCheck;
    }
    if (check.id === 'criteria_coverage') {
      return {
        ...check,
        status: deliveryText ? 'requires_review' : 'pending',
        detail: deliveryText ? 'Delivery is present; buyer or checker should confirm each acceptance criterion before reputation write-back.' : check.detail,
      } satisfies VerificationCheck;
    }
    if (['public_sources', 'test_result', 'schema_match', 'price_bound', 'merchant_source'].includes(check.id)) {
      return {
        ...check,
        status: deliveryText ? 'requires_review' : 'pending',
        detail: deliveryText ? `${check.label} is ready for checker review against the delivery.` : check.detail,
      } satisfies VerificationCheck;
    }
    return check;
  });

  return {
    ...receipt.verificationManifest,
    evidenceHash,
    requiredChecks,
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
