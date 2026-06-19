import { createHash } from 'node:crypto';
import type {
  ClearingDecision,
  EvidenceEnvelope,
  LiveRunReceipt,
  ObligationObject,
  SelectedBidReference,
  SettlementAction,
  SettlementInstruction,
  TaskDataLabel,
} from './types.js';

export interface ClearingObjects {
  obligationObject: ObligationObject;
  evidenceEnvelope: EvidenceEnvelope;
  clearingDecision: ClearingDecision;
  settlementInstruction: SettlementInstruction;
}

export function buildClearingObjects(receipt: LiveRunReceipt): ClearingObjects {
  const obligationId = `obligation_${receipt.runId}`;
  const selectedBid = selectedBidReference(receipt);
  const requestedDataLabel = receipt.privacy?.requestedDataLabel ?? receipt.workerBidBoard?.requestedDataLabel ?? 'public';
  const evidenceHash = receipt.verificationManifest.evidenceHash;
  const walrusReady = Boolean(receipt.walrusBlobId);
  const verdict = clearingVerdict(receipt, walrusReady);
  const reasons = clearingReasons(receipt, walrusReady);
  const action = settlementAction(verdict);

  const obligationObject: ObligationObject = {
    objectType: 'tenderboard.obligation.v1',
    obligationId,
    taskTitle: receipt.taskTitle,
    sanitizedTaskHash: stableHash(receipt.sanitizedTask),
    specHash: receipt.verificationManifest.specHash,
    selectedBid,
    acceptanceCriteria: receipt.verificationManifest.acceptanceCriteria,
    requestedDataLabel,
    maxPayment: receipt.maxPayment,
    workerDataBoundary: receipt.privacy?.workerDataBoundary,
    workOrderId: receipt.workOrderId,
    suiWorkOrderObjectId: receipt.suiWorkOrderObjectId,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };

  const evidenceEnvelope: EvidenceEnvelope = {
    objectType: 'tenderboard.evidence_envelope.v1',
    envelopeId: `evidence_${receipt.runId}`,
    obligationId,
    evidenceHash,
    deliveryPresent: Boolean(receipt.deliveryText),
    requestedDataLabel,
    walrusReady,
    walrusBlobId: receipt.walrusBlobId,
    walrusBlobObjectId: receipt.walrusBlobObjectId,
    walrusCertifiedEpoch: receipt.walrusCertifiedEpoch,
    walrusEndEpoch: receipt.walrusEndEpoch,
    walrusReadUrl: receipt.walrusReadUrl,
    updatedAt: receipt.updatedAt,
  };

  const verificationStatus = receipt.verificationManifest.requiredChecks.reduce(
    (counts, check) => {
      if (check.status === 'passed') counts.passed += 1;
      if (check.status === 'pending') counts.pending += 1;
      if (check.status === 'requires_review') counts.requiresReview += 1;
      return counts;
    },
    { passed: 0, pending: 0, requiresReview: 0 },
  );

  const clearingDecision: ClearingDecision = {
    objectType: 'tenderboard.clearing_decision.v1',
    decisionId: `clearing_${receipt.runId}`,
    obligationId,
    verdict,
    reasons,
    trustVerdict: receipt.trustDecision.verdict,
    evidenceHash,
    walrusReady,
    verificationStatus,
    decidedAt: receipt.updatedAt,
  };

  const settlementInstruction: SettlementInstruction = {
    objectType: 'tenderboard.settlement_instruction.v1',
    instructionId: `settlement_${receipt.runId}`,
    obligationId,
    action,
    workerAgentId: receipt.workerAgentId,
    selectedBidId: selectedBid?.bidId ?? receipt.workerBidBoard?.selectedBidId,
    amount: selectedBid ? { amount: selectedBid.priceSui, currency: 'SUI' } : receipt.maxPayment,
    preconditions: settlementPreconditions(action),
    suiEscrowObjectId: receipt.suiEscrowObjectId,
    suiPaymentDigest: receipt.suiPaymentDigest,
    suiAnchorDigest: receipt.suiAnchorDigest,
    walrusBlobId: receipt.walrusBlobId,
    updatedAt: receipt.updatedAt,
  };

  return {
    obligationObject,
    evidenceEnvelope,
    clearingDecision,
    settlementInstruction,
  };
}

function selectedBidReference(receipt: LiveRunReceipt): SelectedBidReference | undefined {
  const selectedBid = receipt.workerBidBoard?.bids.find((bid) => bid.bidId === receipt.workerBidBoard?.selectedBidId);
  if (!selectedBid) return undefined;
  return {
    bidId: selectedBid.bidId,
    workerAgentId: selectedBid.workerAgentId,
    priceSui: selectedBid.priceSui,
    sla: selectedBid.sla,
    requestedDataLabel: selectedBid.requestedDataLabel as TaskDataLabel,
  };
}

function clearingVerdict(receipt: LiveRunReceipt, walrusReady: boolean): ClearingDecision['verdict'] {
  if (receipt.trustDecision.verdict === 'block' || !receipt.workOrderId) return 'requires_review';
  if (receipt.suiAnchorDigest) return 'anchored';
  if (!receipt.deliveryText || !receipt.verificationManifest.evidenceHash) return 'pending_delivery';
  if (!walrusReady) return 'pending_walrus';
  return 'ready_to_anchor';
}

function clearingReasons(receipt: LiveRunReceipt, walrusReady: boolean): string[] {
  const reasons: string[] = [];
  const selectedBidId = receipt.workerBidBoard?.selectedBidId;
  reasons.push(selectedBidId ? `Selected bid ${selectedBidId} is bound to the obligation.` : 'No selected worker bid is bound.');
  reasons.push(`Acceptance criteria count: ${receipt.verificationManifest.acceptanceCriteria.length}.`);
  reasons.push(`Task data label: ${receipt.privacy?.requestedDataLabel ?? receipt.workerBidBoard?.requestedDataLabel ?? 'public'}.`);

  if (receipt.trustDecision.verdict === 'block') {
    reasons.push('Trust gate blocked this receipt from clearing.');
  }
  if (!receipt.deliveryText) {
    reasons.push('Worker delivery is still required before evidence clearing.');
  } else {
    reasons.push(`Delivery is present with evidence hash ${receipt.verificationManifest.evidenceHash ?? 'pending'}.`);
  }
  if (!walrusReady) {
    reasons.push('Walrus evidence is not ready for Sui anchoring yet.');
  } else {
    reasons.push(`Walrus evidence ${receipt.walrusBlobId} is ready for Sui anchoring.`);
  }
  if (receipt.suiAnchorDigest) {
    reasons.push(`Sui anchor digest ${receipt.suiAnchorDigest} records final settlement proof.`);
  }

  return reasons;
}

function settlementAction(verdict: ClearingDecision['verdict']): SettlementAction {
  if (verdict === 'requires_review') return 'manual_review';
  if (verdict === 'pending_delivery') return 'hold_payment';
  if (verdict === 'pending_walrus') return 'store_walrus_evidence';
  if (verdict === 'ready_to_anchor') return 'anchor_sui_receipt';
  return 'record_settlement';
}

function settlementPreconditions(action: SettlementAction): string[] {
  if (action === 'manual_review') return ['Resolve trust, bid, or work-order blocking issue before settlement.'];
  if (action === 'hold_payment') return ['Wait for worker delivery and finalized evidence hash.'];
  if (action === 'store_walrus_evidence') return ['Upload the receipt evidence bundle to Walrus.'];
  if (action === 'anchor_sui_receipt') return ['Commit the Walrus blob id and evidence hash to the Sui receipt registry.'];
  return ['Settlement proof has been recorded on Sui.'];
}

function stableHash(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
