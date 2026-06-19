import { stableHash } from './hash.js';
import type { AgentMemoryPassport, AgentMemoryRecord, LiveRunReceipt, WalrusMemoryIndex } from './types.js';

export function buildAgentMemoryRecord(receipt: LiveRunReceipt): AgentMemoryRecord {
  const claimResults = receipt.verificationManifest.claimResults ?? [];
  const supportedClaimCount = claimResults.filter((result) => result.verdict === 'supported').length;
  const failedClaimCount = Math.max(0, claimResults.length - supportedClaimCount);
  const averageClaimSupport =
    claimResults.length > 0
      ? Math.round((claimResults.reduce((total, result) => total + result.supportScore, 0) / claimResults.length) * 10) / 10
      : undefined;
  const sourceObservationCount = receipt.workerEvidence?.sourceReceipt.observations.length ?? 0;
  const body = {
    workerAgentId: receipt.workerAgentId,
    runId: receipt.runId,
    taskTitle: receipt.taskTitle,
    evidenceHash: receipt.verificationManifest.evidenceHash,
    walrusBlobId: receipt.walrusBlobId,
    suiAnchorDigest: receipt.suiAnchorDigest,
    claimResults,
  };
  const memoryHash = stableHash(body);

  return {
    objectType: 'suiproof.agent_memory_record.v1',
    memoryId: `memory_${memoryHash.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    workerAgentId: receipt.workerAgentId,
    runId: receipt.runId,
    taskTitle: receipt.taskTitle,
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
    walrusBlobId: receipt.walrusBlobId,
    walrusReadUrl: receipt.walrusReadUrl,
    suiAnchorDigest: receipt.suiAnchorDigest,
    evidenceHash: receipt.verificationManifest.evidenceHash,
    memoryHash,
  };
}

export function buildAgentMemoryPassport(
  workerAgentId: string,
  receipts: LiveRunReceipt[],
  generatedAt = new Date().toISOString(),
): AgentMemoryPassport {
  const records = receipts
    .filter((receipt) => receipt.workerAgentId === workerAgentId)
    .filter((receipt) => Boolean(receipt.memoryRecord ?? receipt.walrusBlobId ?? receipt.verificationManifest.evidenceHash))
    .map((receipt) => buildAgentMemoryRecord(receipt))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const supportScores = records.flatMap((record) => (record.averageClaimSupport === undefined ? [] : [record.averageClaimSupport]));
  const averageClaimSupport =
    supportScores.length > 0 ? Math.round((supportScores.reduce((total, score) => total + score, 0) / supportScores.length) * 10) / 10 : undefined;

  return {
    objectType: 'suiproof.agent_memory_passport.v1',
    workerAgentId,
    generatedAt,
    memoryCount: records.length,
    walrusMemoryCount: records.filter((record) => Boolean(record.walrusBlobId)).length,
    anchoredMemoryCount: records.filter((record) => Boolean(record.suiAnchorDigest)).length,
    averageClaimSupport,
    latestMemoryId: records[0]?.memoryId,
    latestWalrusBlobId: records.find((record) => Boolean(record.walrusBlobId))?.walrusBlobId,
    records,
  };
}

export function buildWalrusMemoryIndex(
  receipts: LiveRunReceipt[],
  generatedAt = new Date().toISOString(),
): WalrusMemoryIndex {
  const workerAgentIds = [...new Set(receipts.map((receipt) => receipt.workerAgentId).filter(Boolean))].sort();
  const passports = workerAgentIds
    .map((workerAgentId) => buildAgentMemoryPassport(workerAgentId, receipts, generatedAt))
    .filter((passport) => passport.memoryCount > 0);
  const records = passports.flatMap((passport) => passport.records).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const supportScores = records.flatMap((record) => (record.averageClaimSupport === undefined ? [] : [record.averageClaimSupport]));
  const averageClaimSupport =
    supportScores.length > 0 ? Math.round((supportScores.reduce((total, score) => total + score, 0) / supportScores.length) * 10) / 10 : undefined;

  return {
    objectType: 'walrusproof.memory_index.v1',
    generatedAt,
    workerCount: passports.length,
    totalMemoryRecords: records.length,
    walrusBackedRecords: records.filter((record) => Boolean(record.walrusBlobId)).length,
    suiAnchoredRecords: records.filter((record) => Boolean(record.suiAnchorDigest)).length,
    averageClaimSupport,
    latestMemoryId: records[0]?.memoryId,
    latestWalrusBlobId: records.find((record) => Boolean(record.walrusBlobId))?.walrusBlobId,
    passports,
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
