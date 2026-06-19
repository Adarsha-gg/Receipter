import { renderScoutReport, scoutOpportunities } from '../agents/opportunityScout.js';
import type { LiveRunReceipt, ScoutEvidence } from './types.js';

export function makeSuiDevDigest(prefix: string, runId: string): string {
  return `sui_dev_${prefix}_${runId}`;
}

export function makeSuiDevObjectId(prefix: string, runId: string): string {
  const hex = Buffer.from(`${prefix}:${runId}`).toString('hex').padEnd(64, '0').slice(0, 64);
  return `0x${hex}`;
}

export async function buildWorkerDelivery(
  receipt: LiveRunReceipt,
  options: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<{ deliveryText: string; workerEvidence: ScoutEvidence }> {
  const report = await scoutOpportunities(`${receipt.taskTitle}\n${receipt.sanitizedTask}`, options);
  const deliveryText = [
    `WalrusProof Market worker completed: ${receipt.taskTitle}`,
    '',
    'What I did:',
    '- Received only the Sui-bound safe task text.',
    '- Did not receive private notes or secrets.',
    '- Produced evidence for a Walrus memory blob and Sui receipt anchor.',
    '- Searched public sources for real links related to the task.',
    '',
    renderScoutReport(report),
  ].join('\n');
  return {
    deliveryText,
    workerEvidence: report.evidence,
  };
}
