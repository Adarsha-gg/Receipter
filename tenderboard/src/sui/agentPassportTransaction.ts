import { textToHexBytes } from './anchorExecutor.js';
import type { AgentPassportUpdateTransactionData } from './agentPassportPlan.js';

const GAS_BUDGET_MIST = '100000000';

export interface SuiAgentPassportUpdateWalletRequest {
  objectType: 'walrusproof.sui_agent_passport_update_wallet_request.v1';
  version: 1;
  kind: 'update_memory_pointer';
  network: string;
  senderAddress: string | undefined;
  packageId: string;
  module: 'agent_passport';
  function: 'update_memory_pointer';
  gasBudgetMist: string;
  summary: string;
  moveCall: {
    target: `${string}::agent_passport::update_memory_pointer`;
    arguments: Array<
      | { kind: 'object'; objectId: string; usage: 'mutable' }
      | { kind: 'pure'; valueType: 'vector<u8>'; value: string; hex: string }
      | { kind: 'pure'; valueType: 'u64'; value: string }
    >;
  };
  expected: {
    event: 'AgentPassportMemoryUpdated';
    digestRequired: true;
    passportObjectId: string;
    ownerAddress: string | undefined;
    latestWalrusBlobId: string;
    latestSuiAnchorDigest: string;
    latestRecordHash: string;
    memoryIndexBlobId: string;
  };
}

export interface SuiAgentPassportUpdatePayload {
  objectType: 'walrusproof.sui_agent_passport_update_payload.v1';
  version: 1;
  transaction: string;
  walletTransactionRequest: SuiAgentPassportUpdateWalletRequest;
}

export function buildAgentPassportUpdateWalletRequest(
  plan: AgentPassportUpdateTransactionData,
): SuiAgentPassportUpdateWalletRequest {
  if (!plan.ready || !plan.packageId || !plan.passportObjectId || !plan.memoryIndexBlobId || !plan.latestMemoryPointer?.memoryHash || !plan.latestWalrusBlobId || !plan.latestSuiAnchorDigest) {
    throw new Error(`AgentPassport update transaction is not ready. Missing: ${plan.missing.join(', ')}`);
  }

  const target = `${plan.packageId}::agent_passport::update_memory_pointer` as const;
  return {
    objectType: 'walrusproof.sui_agent_passport_update_wallet_request.v1',
    version: 1,
    kind: 'update_memory_pointer',
    network: plan.network,
    senderAddress: plan.ownerAddress,
    packageId: plan.packageId,
    module: 'agent_passport',
    function: 'update_memory_pointer',
    gasBudgetMist: GAS_BUDGET_MIST,
    summary: `Update Sui AgentPassport ${plan.passportObjectId} to latest Walrus memory ${plan.latestMemoryPointer.memoryId}.`,
    moveCall: {
      target,
      arguments: [
        { kind: 'object', objectId: plan.passportObjectId, usage: 'mutable' },
        vectorArgument(plan.memoryIndexBlobId),
        vectorArgument(plan.latestMemoryPointer.memoryHash),
        vectorArgument(plan.latestWalrusBlobId),
        vectorArgument(plan.latestSuiAnchorDigest),
        { kind: 'pure', valueType: 'u64', value: String(plan.recordCounts.total) },
        { kind: 'pure', valueType: 'u64', value: String(plan.recordCounts.walrusBacked) },
        { kind: 'pure', valueType: 'u64', value: String(plan.recordCounts.suiAnchored) },
      ],
    },
    expected: {
      event: 'AgentPassportMemoryUpdated',
      digestRequired: true,
      passportObjectId: plan.passportObjectId,
      ownerAddress: plan.ownerAddress,
      latestWalrusBlobId: plan.latestWalrusBlobId,
      latestSuiAnchorDigest: plan.latestSuiAnchorDigest,
      latestRecordHash: plan.latestMemoryPointer.memoryHash,
      memoryIndexBlobId: plan.memoryIndexBlobId,
    },
  };
}

export function buildAgentPassportUpdatePayload(
  walletTransactionRequest: SuiAgentPassportUpdateWalletRequest,
  transaction: string,
): SuiAgentPassportUpdatePayload {
  return {
    objectType: 'walrusproof.sui_agent_passport_update_payload.v1',
    version: 1,
    transaction,
    walletTransactionRequest,
  };
}

function vectorArgument(value: string): { kind: 'pure'; valueType: 'vector<u8>'; value: string; hex: string } {
  return {
    kind: 'pure',
    valueType: 'vector<u8>',
    value,
    hex: textToHexBytes(value),
  };
}
