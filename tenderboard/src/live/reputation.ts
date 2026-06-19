import { MIST_PER_SUI } from '../sui/paymentPlan.js';
import type { LiveRunReceipt, TrustTier, WorkerReputationCard } from './types.js';

const TRUST_TIERS: TrustTier[] = ['AAA', 'AA', 'A', 'B', 'C'];

export function buildWorkerReputationCard(
  workerAgentId: string,
  receipts: LiveRunReceipt[],
  generatedAt = new Date().toISOString(),
): WorkerReputationCard {
  const anchoredReceipts = receipts
    .filter((receipt) => isAnchoredWorkerReceipt(receipt, workerAgentId))
    .sort((a, b) => anchorTime(a).localeCompare(anchorTime(b)));
  const tierCounts = TRUST_TIERS.reduce(
    (counts, tier) => ({
      ...counts,
      [tier]: anchoredReceipts.filter((receipt) => receipt.trustDecision.tier === tier).length,
    }),
    {} as Record<TrustTier, number>,
  );
  const totalTrustScore = anchoredReceipts.reduce((total, receipt) => total + receipt.trustDecision.score, 0);
  const totalMistEarned = anchoredReceipts.reduce((total, receipt) => total + receiptMist(receipt), 0n);
  const lastAnchored = anchoredReceipts.at(-1);

  return {
    objectType: 'tenderboard.worker_reputation_passport.v1',
    workerAgentId,
    generatedAt,
    anchoredRunCount: anchoredReceipts.length,
    walrusEvidenceCount: anchoredReceipts.filter((receipt) => Boolean(receipt.walrusBlobId ?? receipt.receiptPlan?.walrusBlobId)).length,
    sourceEvidenceCount: anchoredReceipts.reduce(
      (total, receipt) => total + (receipt.workerEvidence?.sourceReceipt.observations.length ?? 0),
      0,
    ),
    averageTrustScore:
      anchoredReceipts.length > 0 ? Math.round((totalTrustScore / anchoredReceipts.length) * 10) / 10 : undefined,
    tierCounts,
    totalMistEarned: totalMistEarned.toString(),
    totalSuiEarned: mistToSui(totalMistEarned),
    lastAnchoredRunId: lastAnchored?.runId,
    lastAnchoredAt: lastAnchored ? anchorTime(lastAnchored) : undefined,
    lastWalrusBlobId: lastAnchored?.walrusBlobId ?? lastAnchored?.receiptPlan?.walrusBlobId,
    lastEvidenceHash: lastAnchored?.verificationManifest.evidenceHash,
    lastAnchorDigest: lastAnchored?.suiAnchorDigest ?? lastAnchored?.receiptPlan?.anchorDigest,
  };
}

export function isAnchoredWorkerReceipt(receipt: LiveRunReceipt, workerAgentId: string): boolean {
  return (
    receipt.workerAgentId === workerAgentId &&
    receipt.status === 'anchored' &&
    Boolean(receipt.suiAnchorDigest ?? receipt.receiptPlan?.anchorDigest) &&
    Boolean(receipt.verificationManifest.evidenceHash)
  );
}

export function markReputationSignalAnchored(
  receipt: LiveRunReceipt,
  snapshot: WorkerReputationCard,
): LiveRunReceipt['verificationManifest'] {
  return {
    ...receipt.verificationManifest,
    reputationWriteback:
      'Emit WorkerReputationUpdated only after the Sui receipt anchor records the Walrus evidence and payment-bound receipt.',
    requiredChecks: receipt.verificationManifest.requiredChecks.map((check) => {
      if (check.id !== 'reputation_signal') return check;
      return {
        ...check,
        status: 'passed',
        detail: `WorkerReputationUpdated ready for ${snapshot.workerAgentId}: ${snapshot.anchoredRunCount} anchored run(s), ${snapshot.walrusEvidenceCount} Walrus proof(s), ${snapshot.sourceEvidenceCount} source observation(s).`,
      };
    }),
  };
}

function anchorTime(receipt: LiveRunReceipt): string {
  return receipt.receiptPlan?.updatedAt ?? receipt.updatedAt;
}

function receiptMist(receipt: LiveRunReceipt): bigint {
  return BigInt(receipt.receiptPlan?.amountMist ?? receipt.paymentIntentPlan?.amountMist ?? '0');
}

function mistToSui(mist: bigint): string {
  const whole = mist / MIST_PER_SUI;
  const fraction = (mist % MIST_PER_SUI).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
