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
    `- Trust verdict: ${receipt.trustDecision.verdict} (${receipt.trustDecision.tier}, ${receipt.trustDecision.score}/100)`,
    `- Checker pack: ${receipt.verificationManifest.checkerPack}`,
    `- Spec hash: ${receipt.verificationManifest.specHash}`,
    `- Evidence hash: ${receipt.verificationManifest.evidenceHash ?? 'not finalized'}`,
    `- Sui network: ${receipt.suiNetwork}`,
    `- Sui package id: ${receipt.suiPackageId ?? 'not configured'}`,
    `- Sui receipt registry id: ${receipt.suiReceiptRegistryId ?? 'not configured'}`,
    `- Sui work order id: ${receipt.workOrderId ?? 'not created'}`,
    `- Sui payment digest: ${receipt.suiPaymentDigest ?? 'not paid / no digest'}`,
    `- Sui anchor digest: ${receipt.suiAnchorDigest ?? 'not anchored'}`,
    `- Walrus blob id: ${receipt.walrusBlobId ?? 'not uploaded'}`,
    '',
    '## Safe task sent to worker',
    '',
    '```text',
    receipt.sanitizedTask,
    '```',
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
