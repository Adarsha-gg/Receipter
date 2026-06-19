import { renderScoutReport, scoutOpportunities } from '../agents/opportunityScout.js';
import type { LiveRunReceipt } from './types.js';

export function makeSuiDevDigest(prefix: string, runId: string): string {
  return `sui_dev_${prefix}_${runId}`;
}

export async function buildWorkerDelivery(
  receipt: LiveRunReceipt,
  options: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<string> {
  const report = await scoutOpportunities(`${receipt.taskTitle}\n${receipt.sanitizedTask}`, options);
  return [
    `TenderBoard worker completed: ${receipt.taskTitle}`,
    '',
    'What I did:',
    '- Received only the Sui-bound safe task text.',
    '- Did not receive private notes or secrets.',
    '- Produced evidence for a Walrus blob and Sui receipt anchor.',
    '- Searched public sources for real links related to the task.',
    '',
    renderScoutReport(report),
  ].join('\n');
}
