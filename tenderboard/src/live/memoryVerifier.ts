import { buildAgentMemoryPassport, buildAgentMemoryRecord } from './agentMemory.js';
import { buildEvidenceBundle } from './walrusRuntime.js';
import { stableHash } from './hash.js';
import type { LiveRunReceipt } from './types.js';

export interface VerificationCheck {
  id: string;
  status: 'passed' | 'failed' | 'skipped';
  detail: string;
}

export interface VerifiedMemoryRecord {
  objectType: 'walrusproof.verified_memory_record.v1';
  runId: string;
  workerAgentId: string;
  memoryId: string;
  memoryHash: string;
  checks: VerificationCheck[];
  verified: boolean;
}

export interface VerifiedPassport {
  objectType: 'walrusproof.verified_passport.v1';
  workerAgentId: string;
  generatedAt: string;
  passport: ReturnType<typeof buildAgentMemoryPassport>;
  recordVerifications: VerifiedMemoryRecord[];
  verifiedRecordCount: number;
  failedRecordCount: number;
  verified: boolean;
}

export async function verifyMemoryRecord(
  receipt: LiveRunReceipt,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedMemoryRecord> {
  const recomputed = buildAgentMemoryRecord(receipt);
  const checks: VerificationCheck[] = [
    verifyMemoryHash(receipt, recomputed.memoryHash),
    verifySourceReceiptHash(receipt),
    verifyWorkerEvidenceHash(receipt),
    verifyWalrusBinding(receipt),
    verifySuiAnchorBinding(receipt),
    verifyEvidenceBundleHash(receipt),
    await verifyWalrusReadback(receipt, fetchImpl),
  ];
  const verified = checks.every((check) => check.status !== 'failed');

  return {
    objectType: 'walrusproof.verified_memory_record.v1',
    runId: receipt.runId,
    workerAgentId: receipt.workerAgentId,
    memoryId: recomputed.memoryId,
    memoryHash: recomputed.memoryHash,
    checks,
    verified,
  };
}

export async function verifyPassport(
  workerAgentId: string,
  receipts: LiveRunReceipt[],
  fetchImpl: typeof fetch = fetch,
  generatedAt = new Date().toISOString(),
): Promise<VerifiedPassport> {
  const workerReceipts = receipts
    .filter((receipt) => receipt.workerAgentId === workerAgentId)
    .filter((receipt) => Boolean(receipt.memoryRecord ?? receipt.walrusBlobId ?? receipt.verificationManifest.evidenceHash));
  const recordVerifications = await Promise.all(workerReceipts.map((receipt) => verifyMemoryRecord(receipt, fetchImpl)));
  const verifiedRecordCount = recordVerifications.filter((record) => record.verified).length;
  const failedRecordCount = recordVerifications.length - verifiedRecordCount;

  return {
    objectType: 'walrusproof.verified_passport.v1',
    workerAgentId,
    generatedAt,
    passport: buildAgentMemoryPassport(workerAgentId, receipts, generatedAt),
    recordVerifications,
    verifiedRecordCount,
    failedRecordCount,
    verified: failedRecordCount === 0,
  };
}

function verifyMemoryHash(receipt: LiveRunReceipt, recomputedMemoryHash: string): VerificationCheck {
  const stored = receipt.memoryRecord?.memoryHash;
  if (!stored) {
    return { id: 'memory_hash', status: 'skipped', detail: 'Receipt has no stored memory record yet.' };
  }
  if (stored !== recomputedMemoryHash) {
    return {
      id: 'memory_hash',
      status: 'failed',
      detail: `Stored memory hash ${stored} does not match recomputed ${recomputedMemoryHash}.`,
    };
  }
  return { id: 'memory_hash', status: 'passed', detail: `Memory hash ${stored} recomputed successfully.` };
}

function verifySourceReceiptHash(receipt: LiveRunReceipt): VerificationCheck {
  const sourceReceipt = receipt.workerEvidence?.sourceReceipt;
  if (!sourceReceipt) {
    return { id: 'source_receipt_hash', status: 'skipped', detail: 'No structured source receipt is attached.' };
  }
  const body = {
    schema: sourceReceipt.schema,
    generatedAt: sourceReceipt.generatedAt,
    query: sourceReceipt.query,
    observations: sourceReceipt.observations,
    warnings: sourceReceipt.warnings,
  };
  const recomputed = stableHash(body);
  if (sourceReceipt.receiptHash !== recomputed) {
    return {
      id: 'source_receipt_hash',
      status: 'failed',
      detail: `Source receipt hash ${sourceReceipt.receiptHash} does not match recomputed ${recomputed}.`,
    };
  }
  return { id: 'source_receipt_hash', status: 'passed', detail: `Source receipt hash ${recomputed} matches.` };
}

function verifyWorkerEvidenceHash(receipt: LiveRunReceipt): VerificationCheck {
  const evidence = receipt.workerEvidence;
  if (!evidence) {
    return { id: 'worker_evidence_hash', status: 'skipped', detail: 'No worker evidence is attached.' };
  }
  const body = {
    schema: evidence.schema,
    generatedAt: evidence.generatedAt,
    query: evidence.query,
    sourceReceipt: evidence.sourceReceipt,
    claims: evidence.claims,
  };
  const recomputed = stableHash(body);
  if (evidence.evidenceHash !== recomputed) {
    return {
      id: 'worker_evidence_hash',
      status: 'failed',
      detail: `Worker evidence hash ${evidence.evidenceHash} does not match recomputed ${recomputed}.`,
    };
  }
  return { id: 'worker_evidence_hash', status: 'passed', detail: `Worker evidence hash ${recomputed} matches.` };
}

function verifyWalrusBinding(receipt: LiveRunReceipt): VerificationCheck {
  if (!receipt.walrusBlobId) {
    return { id: 'walrus_binding', status: 'skipped', detail: 'No Walrus blob is bound to this record yet.' };
  }
  if (!receipt.memoryRecord?.marketplaceProof.walrusStored) {
    return { id: 'walrus_binding', status: 'failed', detail: 'Walrus blob exists, but marketplace proof does not mark it stored.' };
  }
  return { id: 'walrus_binding', status: 'passed', detail: `Record is bound to Walrus blob ${receipt.walrusBlobId}.` };
}

function verifySuiAnchorBinding(receipt: LiveRunReceipt): VerificationCheck {
  if (!receipt.suiAnchorDigest) {
    return { id: 'sui_anchor_binding', status: 'skipped', detail: 'No Sui anchor digest is bound to this record yet.' };
  }
  if (!receipt.memoryRecord?.marketplaceProof.suiAnchored) {
    return { id: 'sui_anchor_binding', status: 'failed', detail: 'Sui anchor exists, but marketplace proof does not mark it anchored.' };
  }
  return { id: 'sui_anchor_binding', status: 'passed', detail: `Record is bound to Sui anchor ${receipt.suiAnchorDigest}.` };
}

function verifyEvidenceBundleHash(receipt: LiveRunReceipt): VerificationCheck {
  const hash = stableHash(buildEvidenceBundle(receipt));
  return { id: 'evidence_bundle_hash', status: 'passed', detail: `Current evidence bundle hash is ${hash}.` };
}

async function verifyWalrusReadback(receipt: LiveRunReceipt, fetchImpl: typeof fetch): Promise<VerificationCheck> {
  if (!receipt.walrusReadUrl) {
    return { id: 'walrus_readback', status: 'skipped', detail: 'No Walrus read URL is available.' };
  }
  if (!/^https?:\/\//.test(receipt.walrusReadUrl)) {
    return { id: 'walrus_readback', status: 'skipped', detail: `Readback skipped for non-HTTP URL ${receipt.walrusReadUrl}.` };
  }

  try {
    const response = await fetchImpl(receipt.walrusReadUrl);
    if (!response.ok) {
      return { id: 'walrus_readback', status: 'failed', detail: `Walrus readback returned HTTP ${response.status}.` };
    }
    const body = (await response.json()) as Partial<ReturnType<typeof buildEvidenceBundle>>;
    if (body.run?.runId !== receipt.runId) {
      return { id: 'walrus_readback', status: 'failed', detail: 'Walrus bundle run id does not match the receipt.' };
    }
    if (receipt.suiPaymentDigest && body.sui?.paymentDigest !== receipt.suiPaymentDigest) {
      return { id: 'walrus_readback', status: 'failed', detail: 'Walrus bundle payment digest does not match the receipt.' };
    }
    if (receipt.workerEvidence?.evidenceHash && body.workerEvidence?.evidenceHash !== receipt.workerEvidence.evidenceHash) {
      return { id: 'walrus_readback', status: 'failed', detail: 'Walrus bundle worker evidence hash does not match the receipt.' };
    }
    if (body.verification?.specHash !== receipt.verificationManifest.specHash) {
      return { id: 'walrus_readback', status: 'failed', detail: 'Walrus bundle spec hash does not match the receipt.' };
    }
    const acceptedEvidenceHashes = new Set([
      receipt.verificationManifest.evidenceHash,
      receipt.evidenceEnvelope?.evidenceHash,
      receipt.memoryRecord?.evidenceHash,
      ...receipt.events
        .map((event) => (isRecord(event.data) && typeof event.data.evidenceHash === 'string' ? event.data.evidenceHash : undefined))
        .filter((hash): hash is string => Boolean(hash)),
    ]);
    if (!body.verification?.evidenceHash || !acceptedEvidenceHashes.has(body.verification.evidenceHash)) {
      return { id: 'walrus_readback', status: 'failed', detail: 'Walrus bundle evidence hash is not part of this receipt history.' };
    }
    return { id: 'walrus_readback', status: 'passed', detail: `Walrus blob ${receipt.walrusBlobId} read back and matched.` };
  } catch (error) {
    return {
      id: 'walrus_readback',
      status: 'failed',
      detail: `Walrus readback failed: ${(error as Error).message}`,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
