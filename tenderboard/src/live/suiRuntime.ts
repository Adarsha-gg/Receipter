import { renderScoutReport, scoutOpportunities } from '../agents/opportunityScout.js';
import { findSecretPatternMatches } from '../policy/secretPatterns.js';
import { stableHash } from './hash.js';
import { validateScoutEvidenceIntegrity } from './trustProof.js';
import type { ExternalWorkerDeliveryPayload, LiveRunReceipt, ScoutEvidence, WorkerDeliveryIdentityProof } from './types.js';

export function makeSuiDevDigest(prefix: string, runId: string): string {
  return `sui_dev_${prefix}_${runId}`;
}

export function makeSuiDevObjectId(prefix: string, runId: string): string {
  const hex = Buffer.from(`${prefix}:${runId}`).toString('hex').padEnd(64, '0').slice(0, 64);
  return `0x${hex}`;
}

export interface AcceptedWorkerDelivery {
  deliveryText: string;
  workerEvidence: ScoutEvidence;
  payloadHash: string;
  identityProof: WorkerDeliveryIdentityProof | undefined;
}

export interface WorkerDeliveryValidationResult {
  ok: boolean;
  errors: string[];
  delivery?: AcceptedWorkerDelivery;
}

export async function buildDemoWorkerDelivery(
  receipt: LiveRunReceipt,
  options: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<{ deliveryText: string; workerEvidence: ScoutEvidence }> {
  const report = await scoutOpportunities(`${receipt.taskTitle}\n${receipt.sanitizedTask}`, options);
  const deliveryText = [
    `WalrusProof worker completed: ${receipt.taskTitle}`,
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

export function validateExternalWorkerDelivery(
  receipt: LiveRunReceipt,
  payload: ExternalWorkerDeliveryPayload,
): WorkerDeliveryValidationResult {
  const errors: string[] = [];
  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['Worker delivery payload must be an object.'] };
  }

  if (payload.objectType !== 'walrusproof.external_worker_delivery.v1') {
    errors.push('Worker delivery payload objectType must be walrusproof.external_worker_delivery.v1.');
  }
  if (payload.runId !== receipt.runId) {
    errors.push(`Worker delivery run id ${payload.runId || '<missing>'} does not match receipt run ${receipt.runId}.`);
  }

  const selectedWorkerAgentId = selectedWorkerForReceipt(receipt);
  if (payload.workerAgentId !== selectedWorkerAgentId) {
    errors.push(`Worker delivery worker id ${payload.workerAgentId || '<missing>'} does not match selected worker ${selectedWorkerAgentId}.`);
  }
  if (payload.workerAgentId !== receipt.workerAgentId) {
    errors.push(`Worker delivery worker id ${payload.workerAgentId || '<missing>'} does not match receipt worker ${receipt.workerAgentId}.`);
  }

  const deliveryText = typeof payload.deliveryText === 'string' ? payload.deliveryText.trim() : '';
  if (!deliveryText) {
    errors.push('Worker delivery must include non-empty delivery text.');
  }

  const sourceEvidence = payload.sourceEvidence;
  errors.push(...validateScoutEvidenceIntegrity(sourceEvidence));
  errors.push(...privateDataFindings(payload));

  const payloadHash = workerDeliveryPayloadHash({
    runId: payload.runId,
    workerAgentId: payload.workerAgentId,
    deliveryText,
    sourceEvidence,
  });
  if (payload.identityProof) {
    if (!payload.identityProof.proofType || !payload.identityProof.subject?.trim()) {
      errors.push('Worker identity proof must include proofType and subject when provided.');
    }
    if (payload.identityProof.signedPayloadHash && payload.identityProof.signedPayloadHash !== payloadHash) {
      errors.push('Worker identity proof signedPayloadHash does not match the delivery payload hash.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: [],
    delivery: {
      deliveryText,
      workerEvidence: sourceEvidence,
      payloadHash,
      identityProof: payload.identityProof,
    },
  };
}

export function workerDeliveryPayloadHash(input: {
  runId: string;
  workerAgentId: string;
  deliveryText: string;
  sourceEvidence: ScoutEvidence | undefined;
}): string {
  return stableHash({
    objectType: 'walrusproof.external_worker_delivery.v1',
    runId: input.runId,
    workerAgentId: input.workerAgentId,
    deliveryText: input.deliveryText,
    sourceEvidenceHash: input.sourceEvidence?.evidenceHash,
  });
}

function selectedWorkerForReceipt(receipt: LiveRunReceipt): string {
  const selectedBid = receipt.workerBidBoard?.bids.find((bid) => bid.bidId === receipt.workerBidBoard?.selectedBidId);
  return selectedBid?.workerAgentId ?? receipt.workerAgentId;
}

function privateDataFindings(payload: ExternalWorkerDeliveryPayload): string[] {
  const findings: string[] = [];
  const searchable = [payload.deliveryText, JSON.stringify(payload.sourceEvidence), JSON.stringify(payload.identityProof ?? {})];
  if (findSecretPatternMatches(searchable).length > 0) {
    findings.push('Worker delivery contains secret-looking text and cannot be accepted.');
  }
  if (/\bprivate\s+notes?\b/i.test(searchable.join('\n'))) {
    findings.push('Worker delivery appears to include private notes and cannot be accepted.');
  }

  const forbiddenKeyPaths = findForbiddenPrivateKeys(payload);
  if (forbiddenKeyPaths.length > 0) {
    findings.push(`Worker delivery contains forbidden private field(s): ${forbiddenKeyPaths.join(', ')}.`);
  }
  return findings;
}

function findForbiddenPrivateKeys(value: unknown, path = '$'): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findForbiddenPrivateKeys(item, `${path}[${index}]`));
  }

  const findings: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    const keyPath = `${path}.${key}`;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (FORBIDDEN_PRIVATE_FIELD_NAMES.has(normalized)) {
      findings.push(keyPath);
      continue;
    }
    findings.push(...findForbiddenPrivateKeys(child, keyPath));
  }
  return findings;
}

const FORBIDDEN_PRIVATE_FIELD_NAMES = new Set([
  'privatenote',
  'privatenotes',
  'secret',
  'secrets',
  'env',
  'dotenv',
  'privatekey',
  'walletkey',
  'seedphrase',
  'mnemonic',
  'apikey',
  'accesstoken',
  'authtoken',
  'password',
  'credential',
  'credentials',
]);
