import type { LiveRunReceipt } from './types.js';

export function renderReceiptProof(receipt: LiveRunReceipt): string {
  const lines = [
    `# TenderBoard Run Proof: ${receipt.runId}`,
    '',
    `- Mode: ${receipt.mode}`,
    `- Status: ${receipt.status}`,
    `- Created: ${receipt.createdAt}`,
    `- Updated: ${receipt.updatedAt}`,
    `- Task: ${receipt.taskTitle}`,
    `- Max payment: ${receipt.maxPayment.amount} ${receipt.maxPayment.currency}`,
    `- CROO service id: ${receipt.crooServiceId ?? 'not set'}`,
    `- Negotiation id: ${receipt.negotiationId ?? 'not created'}`,
    `- Order id: ${receipt.orderId ?? 'not created'}`,
    `- Payment tx hash: ${receipt.paymentTxHash ?? 'not paid / no tx hash'}`,
    '',
    '## Safe task sent to worker',
    '',
    '```text',
    receipt.sanitizedTask,
    '```',
    '',
    '## Delivery',
    '',
    receipt.deliveryText ? ['```text', receipt.deliveryText, '```'].join('\n') : 'No delivery yet.',
    '',
    '## Timeline',
    '',
  ];

  for (const event of receipt.events) {
    lines.push(`- ${event.at} — ${event.source}/${event.type}: ${event.message}`);
  }

  if (receipt.error) {
    lines.push('', '## Error', '', receipt.error);
  }

  return `${lines.join('\n')}\n`;
}
