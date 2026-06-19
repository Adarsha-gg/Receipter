import type { LiveRunReceipt } from './types.js';

export function renderReceiptProof(receipt: LiveRunReceipt): string {
  const lines = [
    `# TenderBoard Sui Run Proof: ${receipt.runId}`,
    '',
    `- Mode: ${receipt.mode}`,
    `- Status: ${receipt.status}`,
    `- Created: ${receipt.createdAt}`,
    `- Updated: ${receipt.updatedAt}`,
    `- Task: ${receipt.taskTitle}`,
    `- Max payment: ${receipt.maxPayment.amount} ${receipt.maxPayment.currency}`,
    `- Requested data label: ${receipt.privacy?.requestedDataLabel ?? receipt.workerBidBoard?.requestedDataLabel ?? 'public'}`,
    `- Selected worker bid: ${receipt.workerBidBoard?.selectedBidId ?? 'not selected'}`,
    `- Trust verdict: ${receipt.trustDecision.verdict} (${receipt.trustDecision.tier}, ${receipt.trustDecision.score}/100)`,
    `- Checker pack: ${receipt.verificationManifest.checkerPack}`,
    `- Spec hash: ${receipt.verificationManifest.specHash}`,
    `- Evidence hash: ${receipt.verificationManifest.evidenceHash ?? 'not finalized'}`,
    `- Payment intent id: ${receipt.paymentIntentPlan?.intentId ?? 'not planned'}`,
    `- Payment nonce: ${receipt.paymentIntentPlan?.paymentNonce ?? receipt.receiptPlan?.paymentNonce ?? 'not planned'}`,
    `- Settlement nonce: ${receipt.paymentIntentPlan?.settlementNonce ?? receipt.receiptPlan?.settlementNonce ?? 'not planned'}`,
    `- Amount MIST: ${receipt.paymentIntentPlan?.amountMist ?? receipt.receiptPlan?.amountMist ?? 'not planned'}`,
    `- Coin type: ${receipt.paymentIntentPlan?.coinType ?? receipt.receiptPlan?.coinType ?? 'not planned'}`,
    `- Receiver: ${receipt.paymentIntentPlan?.receiverAddress ?? receipt.receiptPlan?.receiverAddress ?? 'not planned'}`,
    `- Expected payment network: ${receipt.paymentIntentPlan?.expectedNetwork ?? receipt.receiptPlan?.expectedNetwork ?? receipt.suiNetwork}`,
    `- Payment intent expiry: ${receipt.paymentIntentPlan?.expiresAt ?? 'not planned'}`,
    `- Receipt duplicate-prevention key: ${receipt.receiptPlan?.duplicatePreventionKey ?? 'not planned'}`,
    `- Clearing verdict: ${receipt.clearingDecision?.verdict ?? 'not recorded'}`,
    `- Settlement action: ${receipt.settlementInstruction?.action ?? 'not recorded'}`,
    `- Sui network: ${receipt.suiNetwork}`,
    `- Sui package id: ${receipt.suiPackageId ?? 'not configured'}`,
    `- Sui receipt registry id: ${receipt.suiReceiptRegistryId ?? 'not configured'}`,
    `- Sui work order id: ${receipt.workOrderId ?? 'not created'}`,
    `- Sui work order object id: ${receipt.suiWorkOrderObjectId ?? 'not created'}`,
    `- Sui escrow object id: ${receipt.suiEscrowObjectId ?? 'not created'}`,
    `- Sui payment digest: ${receipt.suiPaymentDigest ?? 'not paid / no digest'}`,
    `- Sui anchor digest: ${receipt.suiAnchorDigest ?? 'not anchored'}`,
    `- Walrus blob id: ${receipt.walrusBlobId ?? 'not uploaded'}`,
    `- Walrus blob object id: ${receipt.walrusBlobObjectId ?? 'not uploaded'}`,
    `- Walrus read URL: ${receipt.walrusReadUrl ?? 'not uploaded'}`,
    '',
    '## Safe task sent to worker',
    '',
    '```text',
    receipt.sanitizedTask,
    '```',
    '',
    '## Worker bid board',
    '',
    ...renderWorkerBidBoard(receipt),
    '',
    '## Clearing objects',
    '',
    ...renderClearingObjects(receipt),
    '',
    '## Trust gate',
    '',
    ...receipt.trustDecision.reasons.map((reason) => `- ${reason}`),
    '',
    '## Acceptance criteria',
    '',
    ...receipt.verificationManifest.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    '',
    '## Verification checks',
    '',
    ...receipt.verificationManifest.requiredChecks.map((check) => `- ${check.status}: ${check.label} - ${check.detail}`),
    '',
    '## Delivery',
    '',
    receipt.deliveryText ? ['```text', receipt.deliveryText, '```'].join('\n') : 'No delivery yet.',
    '',
    '## Worker source evidence',
    '',
    ...renderWorkerEvidence(receipt),
    '',
    '## Timeline',
    '',
  ];

  for (const event of receipt.events) {
    lines.push(`- ${event.at} - ${event.source}/${event.type}: ${event.message}`);
  }

  if (receipt.error) {
    lines.push('', '## Error', '', receipt.error);
  }

  return `${lines.join('\n')}\n`;
}

function renderWorkerEvidence(receipt: LiveRunReceipt): string[] {
  const evidence = receipt.workerEvidence;
  if (!evidence) return ['No worker source evidence recorded.'];

  return [
    `- Evidence hash: ${evidence.evidenceHash}`,
    `- Source receipt: ${evidence.sourceReceipt.receiptId}`,
    `- Source receipt hash: ${evidence.sourceReceipt.receiptHash}`,
    `- Query: ${evidence.query}`,
    '',
    '| Claim | Source observation | URL |',
    '| --- | --- | --- |',
    ...evidence.claims.map((claim) => `| ${escapeCell(claim.claimId)} | ${escapeCell(claim.sourceObservationId)} | ${escapeCell(claim.url)} |`),
  ];
}

function renderClearingObjects(receipt: LiveRunReceipt): string[] {
  if (!receipt.obligationObject || !receipt.evidenceEnvelope || !receipt.clearingDecision || !receipt.settlementInstruction) {
    return ['No formal clearing objects recorded.'];
  }

  return [
    `- Obligation: ${receipt.obligationObject.obligationId}`,
    `- Sanitized task hash: ${receipt.obligationObject.sanitizedTaskHash}`,
    `- Bound spec hash: ${receipt.obligationObject.specHash}`,
    `- Bound selected bid: ${receipt.obligationObject.selectedBid?.bidId ?? 'none'}`,
    `- Bound data label: ${receipt.obligationObject.requestedDataLabel}`,
    `- Bound acceptance criteria: ${receipt.obligationObject.acceptanceCriteria.length}`,
    `- Evidence envelope: ${receipt.evidenceEnvelope.envelopeId}`,
    `- Evidence hash: ${receipt.evidenceEnvelope.evidenceHash ?? 'not finalized'}`,
    `- Walrus ready: ${receipt.evidenceEnvelope.walrusReady ? 'yes' : 'no'}`,
    `- Clearing decision: ${receipt.clearingDecision.verdict}`,
    ...receipt.clearingDecision.reasons.map((reason) => `  - ${reason}`),
    `- Settlement instruction: ${receipt.settlementInstruction.action}`,
    `- Settlement amount: ${receipt.settlementInstruction.amount.amount} ${receipt.settlementInstruction.amount.currency}`,
  ];
}

function renderWorkerBidBoard(receipt: LiveRunReceipt): string[] {
  if (!receipt.workerBidBoard) return ['No worker bid board recorded.'];

  return [
    `- Buyer max: ${receipt.workerBidBoard.buyerMaxPayment.amount} ${receipt.workerBidBoard.buyerMaxPayment.currency}`,
    `- Task data label: ${receipt.workerBidBoard.requestedDataLabel}`,
    `- Selected bid: ${receipt.workerBidBoard.selectedBidId ?? 'none'}`,
    '',
    '| Bid | Worker | Price | SLA | Data | Verdict | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...receipt.workerBidBoard.bids.map(
      (bid) =>
        `| ${escapeCell(bid.bidId)} | ${escapeCell(bid.workerAgentId)} | ${escapeCell(bid.priceSui)} SUI | ${escapeCell(bid.sla)} | ${escapeCell(bid.requestedDataLabel)} | ${escapeCell(bid.verdict)} | ${escapeCell(bid.reason)} |`,
    ),
  ];
}

function escapeCell(value: unknown): string {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}
