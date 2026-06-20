import { stableHash } from './hash.js';
import type { AgentMemoryPassport, AgentMemoryRecord, LiveRunReceipt, WalrusMemoryIndex } from './types.js';

export interface AgentPassportBinding {
  workerAgentId: string;
  ownerAddress: string;
  passportObjectId: string;
  source?: string | undefined;
}

export interface BuildAgentMemoryOptions {
  passportBindings?: AgentPassportBinding[] | Record<string, AgentPassportBinding | undefined> | undefined;
}

export function buildAgentMemoryRecord(receipt: LiveRunReceipt): AgentMemoryRecord {
  const claimResults = receipt.verificationManifest.claimResults ?? [];
  const supportedClaimCount = claimResults.filter((result) => result.verdict === 'supported').length;
  const failedClaimCount = Math.max(0, claimResults.length - supportedClaimCount);
  const averageClaimSupport =
    claimResults.length > 0
      ? Math.round((claimResults.reduce((total, result) => total + result.supportScore, 0) / claimResults.length) * 10) / 10
      : undefined;
  const sourceObservationCount = receipt.workerEvidence?.sourceReceipt.observations.length ?? 0;
  const selectedBidId = receipt.agentHandoff?.selectedBidId ?? receipt.workerBidBoard?.selectedBidId;
  const ownerAddress = receipt.workerAgent?.ownerAddress;
  const marketplaceProof = {
    paymentBound: Boolean(receipt.suiPaymentDigest ?? receipt.receiptPlan?.paymentDigest),
    workerSelected: Boolean(selectedBidId && receipt.workerAgentId),
    sourceVerified: supportedClaimCount > 0 && failedClaimCount === 0,
    walrusStored: Boolean(receipt.walrusBlobId),
    suiAnchored: Boolean(receipt.suiAnchorDigest),
  };
  const body = {
    workerAgentId: receipt.workerAgentId,
    ownerAddress,
    runId: receipt.runId,
    taskTitle: receipt.taskTitle,
    workOrderId: receipt.workOrderId,
    paymentIntentId: receipt.paymentIntentPlan?.intentId ?? receipt.receiptPlan?.intentId,
    selectedBidId,
    amountMist: receipt.paymentIntentPlan?.amountMist ?? receipt.receiptPlan?.amountMist,
    evidenceHash: receipt.verificationManifest.evidenceHash,
    walrusBlobId: receipt.walrusBlobId,
    suiAnchorDigest: receipt.suiAnchorDigest,
    paymentDigest: receipt.suiPaymentDigest,
    marketplaceProof,
    claimResults,
  };
  const memoryHash = stableHash(body);

  return {
    objectType: 'suiproof.agent_memory_record.v1',
    memoryId: `memory_${memoryHash.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    workerAgentId: receipt.workerAgentId,
    ownerAddress,
    runId: receipt.runId,
    taskTitle: receipt.taskTitle,
    workOrderId: receipt.workOrderId,
    paymentIntentId: receipt.paymentIntentPlan?.intentId ?? receipt.receiptPlan?.intentId,
    selectedBidId,
    amountMist: receipt.paymentIntentPlan?.amountMist ?? receipt.receiptPlan?.amountMist,
    amountSui: receipt.paymentIntentPlan?.amountSui ?? receipt.receiptPlan?.amountSui,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
    status: receipt.status,
    summary: summarizeReceipt(receipt, supportedClaimCount, failedClaimCount),
    tags: memoryTags(receipt),
    sourceObservationCount,
    claimCount: claimResults.length,
    supportedClaimCount,
    failedClaimCount,
    averageClaimSupport,
    verificationAdmissibility: receipt.verificationManifest.summary?.admissibility ?? receipt.clearingDecision?.verificationAdmissibility ?? 'pending',
    evidenceStrength: receipt.verificationManifest.summary?.evidenceStrength ?? receipt.clearingDecision?.evidenceStrength ?? 'none',
    settlementAction: receipt.settlementInstruction?.action,
    paymentDigest: receipt.suiPaymentDigest,
    walrusBlobId: receipt.walrusBlobId,
    walrusReadUrl: receipt.walrusReadUrl,
    suiAnchorDigest: receipt.suiAnchorDigest,
    evidenceHash: receipt.verificationManifest.evidenceHash,
    marketplaceProof,
    memoryHash,
  };
}

export function buildAgentMemoryPassport(
  workerAgentId: string,
  receipts: LiveRunReceipt[],
  generatedAt = new Date().toISOString(),
  options: BuildAgentMemoryOptions = {},
): AgentMemoryPassport {
  const records = receipts
    .filter((receipt) => receipt.workerAgentId === workerAgentId)
    .filter((receipt) => Boolean(receipt.memoryRecord ?? receipt.walrusBlobId ?? receipt.verificationManifest.evidenceHash))
    .map((receipt) => buildAgentMemoryRecord(receipt))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const supportScores = records.flatMap((record) => (record.averageClaimSupport === undefined ? [] : [record.averageClaimSupport]));
  const averageClaimSupport =
    supportScores.length > 0 ? Math.round((supportScores.reduce((total, score) => total + score, 0) / supportScores.length) * 10) / 10 : undefined;
  const latestMemoryPointer = records[0]
    ? {
        memoryId: records[0].memoryId,
        memoryHash: records[0].memoryHash,
        runId: records[0].runId,
        updatedAt: records[0].updatedAt,
      }
    : undefined;
  const ownerAddress = records.find((record) => record.ownerAddress)?.ownerAddress;
  const passportBinding = resolvePassportBinding(workerAgentId, receipts, options);
  const ownership = buildChainOwnershipProof(ownerAddress, passportBinding);

  return {
    objectType: 'suiproof.agent_memory_passport.v1',
    workerAgentId,
    ownerAddress: ownership.ownerAddress,
    passportObjectId: ownership.passportObjectId,
    ownership: {
      chain: 'sui',
      address: ownership.ownerAddress,
      passportObjectId: ownership.passportObjectId,
      proof: ownership.proof,
    },
    chainOwnershipProof: ownership,
    generatedAt,
    memoryCount: records.length,
    walrusMemoryCount: records.filter((record) => Boolean(record.walrusBlobId)).length,
    anchoredMemoryCount: records.filter((record) => Boolean(record.suiAnchorDigest)).length,
    averageClaimSupport,
    latestMemoryId: records[0]?.memoryId,
    latestMemoryPointer,
    latestWalrusBlobId: records.find((record) => Boolean(record.walrusBlobId))?.walrusBlobId,
    latestSuiAnchorDigest: records.find((record) => Boolean(record.suiAnchorDigest))?.suiAnchorDigest,
    records,
  };
}

export function buildWalrusMemoryIndex(
  receipts: LiveRunReceipt[],
  generatedAt = new Date().toISOString(),
  options: BuildAgentMemoryOptions = {},
): WalrusMemoryIndex {
  const workerAgentIds = [...new Set(receipts.map((receipt) => receipt.workerAgentId).filter(Boolean))].sort();
  const passports = workerAgentIds
    .map((workerAgentId) => buildAgentMemoryPassport(workerAgentId, receipts, generatedAt, options))
    .filter((passport) => passport.memoryCount > 0);
  const records = passports.flatMap((passport) => passport.records).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const supportScores = records.flatMap((record) => (record.averageClaimSupport === undefined ? [] : [record.averageClaimSupport]));
  const averageClaimSupport =
    supportScores.length > 0 ? Math.round((supportScores.reduce((total, score) => total + score, 0) / supportScores.length) * 10) / 10 : undefined;
  const latestRecord = records[0];

  return {
    objectType: 'walrusproof.memory_index.v1',
    generatedAt,
    workerCount: passports.length,
    totalMemoryRecords: records.length,
    walrusBackedRecords: records.filter((record) => Boolean(record.walrusBlobId)).length,
    suiAnchoredRecords: records.filter((record) => Boolean(record.suiAnchorDigest)).length,
    averageClaimSupport,
    latestMemoryId: records[0]?.memoryId,
    latestMemoryPointer: latestRecord
      ? {
          workerAgentId: latestRecord.workerAgentId,
          memoryId: latestRecord.memoryId,
          memoryHash: latestRecord.memoryHash,
          runId: latestRecord.runId,
          updatedAt: latestRecord.updatedAt,
        }
      : undefined,
    latestWalrusBlobId: records.find((record) => Boolean(record.walrusBlobId))?.walrusBlobId,
    latestSuiAnchorDigest: records.find((record) => Boolean(record.suiAnchorDigest))?.suiAnchorDigest,
    passports,
  };
}

function resolvePassportBinding(
  workerAgentId: string,
  receipts: LiveRunReceipt[],
  options: BuildAgentMemoryOptions,
): AgentPassportBinding | undefined {
  const configured = findConfiguredPassportBinding(workerAgentId, options.passportBindings);
  if (configured) return configured;

  return receipts
    .filter((receipt) => receipt.workerAgentId === workerAgentId)
    .map((receipt) => {
      const profilePassportObjectId = receipt.workerAgent?.agentPassportObjectId;
      const profileOwnerAddress = receipt.workerAgent?.ownerAddress;
      if (profilePassportObjectId && profileOwnerAddress) {
        return {
          workerAgentId,
          ownerAddress: profileOwnerAddress,
          passportObjectId: profilePassportObjectId,
          source: 'worker_agent_profile',
        } satisfies AgentPassportBinding;
      }

      const eventBinding = receipt.events
        .map((event) => extractEventPassportBinding(workerAgentId, event.data))
        .find((binding) => binding !== undefined);
      return eventBinding;
    })
    .find((binding) => binding !== undefined);
}

function findConfiguredPassportBinding(
  workerAgentId: string,
  bindings: BuildAgentMemoryOptions['passportBindings'],
): AgentPassportBinding | undefined {
  if (!bindings) return undefined;
  if (Array.isArray(bindings)) {
    return bindings.find((binding) => binding.workerAgentId === workerAgentId);
  }
  return bindings[workerAgentId];
}

function extractEventPassportBinding(workerAgentId: string, data: Record<string, unknown> | undefined): AgentPassportBinding | undefined {
  if (!data) return undefined;
  const eventWorkerAgentId = typeof data.workerAgentId === 'string' ? data.workerAgentId : workerAgentId;
  const ownerAddress = typeof data.ownerAddress === 'string' ? data.ownerAddress : undefined;
  const passportObjectId =
    typeof data.passportObjectId === 'string'
      ? data.passportObjectId
      : typeof data.agentPassportObjectId === 'string'
        ? data.agentPassportObjectId
        : undefined;
  if (eventWorkerAgentId !== workerAgentId || !ownerAddress || !passportObjectId) return undefined;
  return {
    workerAgentId,
    ownerAddress,
    passportObjectId,
    source: 'receipt_event',
  };
}

function buildChainOwnershipProof(
  ownerAddress: string | undefined,
  binding: AgentPassportBinding | undefined,
): AgentMemoryPassport['chainOwnershipProof'] {
  if (binding) {
    return {
      chain: 'sui',
      status: 'chain_bound',
      ownerAddress: binding.ownerAddress,
      passportObjectId: binding.passportObjectId,
      proof: 'agent_passport_object',
      detail: `Sui AgentPassport object ${binding.passportObjectId} is bound to owner ${binding.ownerAddress}.`,
    };
  }
  if (ownerAddress) {
    return {
      chain: 'sui',
      status: 'owner_address_only',
      ownerAddress,
      passportObjectId: undefined,
      proof: 'owner_address_only',
      detail: `Owner address ${ownerAddress} is present, but no Sui AgentPassport object id is bound.`,
    };
  }
  return {
    chain: 'sui',
    status: 'unbound',
    ownerAddress: undefined,
    passportObjectId: undefined,
    proof: 'unbound',
    detail: 'No Sui owner address or AgentPassport object id is bound to this memory passport.',
  };
}

function summarizeReceipt(receipt: LiveRunReceipt, supportedClaimCount: number, failedClaimCount: number): string {
  const status = receipt.verificationManifest.summary?.admissibility ?? receipt.clearingDecision?.verificationAdmissibility ?? 'pending';
  return `${receipt.taskTitle}: ${status} verification, ${supportedClaimCount} supported claim(s), ${failedClaimCount} failed claim(s).`;
}

function memoryTags(receipt: LiveRunReceipt): string[] {
  return [
    receipt.verificationManifest.checkerPack,
    receipt.verificationManifest.summary?.admissibility ?? receipt.clearingDecision?.verificationAdmissibility ?? 'pending',
    receipt.verificationManifest.summary?.evidenceStrength ?? receipt.clearingDecision?.evidenceStrength ?? 'none',
    receipt.settlementInstruction?.action ?? 'no_settlement_action',
  ];
}
