import { buildAgentMemoryRecord } from '../live/agentMemory.js';
import type { AgentMemoryPassport, AgentMemoryRecord, LiveRunReceipt } from '../live/types.js';

export interface BuildAgentPassportUpdateInput {
  network: string;
  packageId: string | undefined;
  passport: AgentMemoryPassport;
  passportObjectId?: string | undefined;
  memoryIndexBlobId: string | undefined;
  anchoredReceipt?: LiveRunReceipt | undefined;
}

export interface AgentPassportUpdateTransactionData {
  ready: boolean;
  network: string;
  missing: string[];
  packageId: string | undefined;
  passportObjectId: string | undefined;
  ownerAddress: string | undefined;
  memoryIndexBlobId: string | undefined;
  latestMemoryPointer: AgentMemoryPassport['latestMemoryPointer'];
  latestWalrusBlobId: string | undefined;
  latestSuiAnchorDigest: string | undefined;
  recordCounts: {
    total: number;
    walrusBacked: number;
    suiAnchored: number;
  };
  moveCall: {
    packageId: string | undefined;
    module: 'agent_passport';
    function: 'update_memory_pointer';
    arguments: string[];
  };
}

export function buildAgentPassportUpdateTransactionData(
  input: BuildAgentPassportUpdateInput,
): AgentPassportUpdateTransactionData {
  assertReceiptBelongsToPassport(input.passport, input.anchoredReceipt);

  const passportObjectId = input.passportObjectId ?? input.passport.passportObjectId;
  const ownerAddress = input.passport.ownerAddress;
  const receiptRecord = input.anchoredReceipt ? memoryRecordForReceipt(input.anchoredReceipt) : undefined;
  const resolvedLatestMemoryPointer = resolveLatestMemoryPointer(input.passport, receiptRecord);
  const latestWalrusBlobId =
    input.anchoredReceipt?.walrusBlobId ?? input.anchoredReceipt?.memoryRecord?.walrusBlobId ?? input.passport.latestWalrusBlobId;
  const latestSuiAnchorDigest =
    input.anchoredReceipt?.suiAnchorDigest ??
    input.anchoredReceipt?.receiptPlan?.anchorDigest ??
    input.anchoredReceipt?.memoryRecord?.suiAnchorDigest ??
    input.passport.latestSuiAnchorDigest;
  const missing = missingUpdateFields({
    packageId: input.packageId,
    passportObjectId,
    memoryIndexBlobId: input.memoryIndexBlobId,
    latestMemoryHash: resolvedLatestMemoryPointer?.memoryHash,
    latestWalrusBlobId,
    latestSuiAnchorDigest,
  });

  return {
    ready: missing.length === 0,
    network: input.network,
    missing,
    packageId: input.packageId,
    passportObjectId,
    ownerAddress,
    memoryIndexBlobId: input.memoryIndexBlobId,
    latestMemoryPointer: resolvedLatestMemoryPointer,
    latestWalrusBlobId,
    latestSuiAnchorDigest,
    recordCounts: {
      total: input.passport.memoryCount,
      walrusBacked: input.passport.walrusMemoryCount,
      suiAnchored: input.passport.anchoredMemoryCount,
    },
    moveCall: {
      packageId: input.packageId,
      module: 'agent_passport',
      function: 'update_memory_pointer',
      arguments: [
        passportObjectId ?? '<AGENT_PASSPORT_OBJECT_ID>',
        input.memoryIndexBlobId ?? '<WALRUS_MEMORY_INDEX_BLOB_ID>',
        resolvedLatestMemoryPointer?.memoryHash ?? '<LATEST_MEMORY_HASH>',
        latestWalrusBlobId ?? '<LATEST_WALRUS_BLOB_ID>',
        latestSuiAnchorDigest ?? '<LATEST_SUI_ANCHOR_DIGEST>',
        String(input.passport.memoryCount),
        String(input.passport.walrusMemoryCount),
        String(input.passport.anchoredMemoryCount),
      ],
    },
  };
}

function assertReceiptBelongsToPassport(passport: AgentMemoryPassport, receipt: LiveRunReceipt | undefined): void {
  if (receipt && receipt.workerAgentId !== passport.workerAgentId) {
    throw new Error(`Anchored receipt ${receipt.runId} belongs to ${receipt.workerAgentId}, not ${passport.workerAgentId}.`);
  }
}

function memoryRecordForReceipt(receipt: LiveRunReceipt): AgentMemoryRecord {
  return receipt.memoryRecord ?? buildAgentMemoryRecord(receipt);
}

function resolveLatestMemoryPointer(
  passport: AgentMemoryPassport,
  receiptRecord: AgentMemoryRecord | undefined,
): AgentMemoryPassport['latestMemoryPointer'] {
  if (!receiptRecord) return passport.latestMemoryPointer;
  if (passport.latestMemoryPointer && passport.latestMemoryPointer.updatedAt.localeCompare(receiptRecord.updatedAt) > 0) {
    return passport.latestMemoryPointer;
  }
  return {
    memoryId: receiptRecord.memoryId,
    memoryHash: receiptRecord.memoryHash,
    runId: receiptRecord.runId,
    updatedAt: receiptRecord.updatedAt,
  };
}

function missingUpdateFields(values: {
  packageId: string | undefined;
  passportObjectId: string | undefined;
  memoryIndexBlobId: string | undefined;
  latestMemoryHash: string | undefined;
  latestWalrusBlobId: string | undefined;
  latestSuiAnchorDigest: string | undefined;
}): string[] {
  const missing: string[] = [];
  if (!values.packageId) missing.push('SUI_PACKAGE_ID');
  if (!values.passportObjectId) missing.push('AGENT_PASSPORT_OBJECT_ID');
  if (!values.memoryIndexBlobId) missing.push('WALRUS_MEMORY_INDEX_BLOB_ID');
  if (!values.latestMemoryHash) missing.push('LATEST_MEMORY_HASH');
  if (!values.latestWalrusBlobId) missing.push('LATEST_WALRUS_BLOB_ID');
  if (!values.latestSuiAnchorDigest) missing.push('LATEST_SUI_ANCHOR_DIGEST');
  return missing;
}
