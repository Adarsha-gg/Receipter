import type { TenderBoardConfig } from '../live/types.js';
import type { SuiAgentPassportUpdatePayload, SuiAgentPassportUpdateWalletRequest } from './agentPassportTransaction.js';

export class SuiAgentPassportVerificationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SuiAgentPassportVerificationError';
  }
}

export interface SuiAgentPassportUpdateVerification {
  objectType: 'walrusproof.sui_agent_passport_update_verification.v1';
  ok: true;
  transaction: string;
  network: string;
  verifiedAt: string;
  checks: {
    requestBound: true;
    transactionSuccessful: true;
    updateEventObserved: true;
  };
}

export function parseSuiAgentPassportUpdatePayload(value: unknown): SuiAgentPassportUpdatePayload {
  if (!isRecord(value)) {
    throw new SuiAgentPassportVerificationError(400, 'AgentPassport update payload must be a JSON object.');
  }
  if (value.objectType !== 'walrusproof.sui_agent_passport_update_payload.v1') {
    throw new SuiAgentPassportVerificationError(400, 'AgentPassport update payload objectType is not supported.');
  }
  if (value.version !== 1) {
    throw new SuiAgentPassportVerificationError(400, 'AgentPassport update payload version is not supported.');
  }
  if (typeof value.transaction !== 'string' || !value.transaction.trim()) {
    throw new SuiAgentPassportVerificationError(400, 'AgentPassport update payload is missing transaction.');
  }
  if (!isAgentPassportUpdateWalletRequest(value.walletTransactionRequest)) {
    throw new SuiAgentPassportVerificationError(400, 'AgentPassport update payload is missing walletTransactionRequest.');
  }
  return value as unknown as SuiAgentPassportUpdatePayload;
}

export async function verifySuiAgentPassportUpdate(input: {
  payload: SuiAgentPassportUpdatePayload;
  config: TenderBoardConfig;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<SuiAgentPassportUpdateVerification> {
  const request = input.payload.walletTransactionRequest;
  if (request.network !== input.config.suiNetwork) {
    throw new SuiAgentPassportVerificationError(402, 'AgentPassport update network mismatch.');
  }
  if (request.packageId.toLowerCase() !== (input.config.suiPackageId ?? '').toLowerCase()) {
    throw new SuiAgentPassportVerificationError(402, 'AgentPassport update package mismatch.');
  }

  if (input.config.mode === 'sui') {
    await verifySuiRpcAgentPassportUpdate(input.payload, input.config, input.fetchImpl ?? fetch);
  }

  return {
    objectType: 'walrusproof.sui_agent_passport_update_verification.v1',
    ok: true,
    transaction: input.payload.transaction,
    network: `sui:${request.network}`,
    verifiedAt: (input.now ?? new Date()).toISOString(),
    checks: {
      requestBound: true,
      transactionSuccessful: true,
      updateEventObserved: true,
    },
  };
}

async function verifySuiRpcAgentPassportUpdate(
  payload: SuiAgentPassportUpdatePayload,
  config: TenderBoardConfig,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (!config.suiRpcUrl) {
    throw new SuiAgentPassportVerificationError(500, 'SUI_RPC_URL is required for AgentPassport update verification.');
  }
  const response = await fetchImpl(config.suiRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getTransactionBlock',
      params: [
        payload.transaction,
        {
          showEffects: true,
          showEvents: true,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new SuiAgentPassportVerificationError(502, `Sui RPC returned HTTP ${response.status}.`);
  }
  const rpc = (await response.json()) as unknown;
  if (!isRecord(rpc)) {
    throw new SuiAgentPassportVerificationError(502, 'Sui RPC returned an invalid response.');
  }
  if (rpc.error !== undefined) {
    throw new SuiAgentPassportVerificationError(402, `AgentPassport update could not be verified: ${JSON.stringify(rpc.error)}`);
  }
  const result = recordField(rpc, 'result');
  if (stringOptional(result.digest) && result.digest !== payload.transaction) {
    throw new SuiAgentPassportVerificationError(402, 'AgentPassport update transaction digest mismatch.');
  }
  if (!hasSuccessfulEffects(result)) {
    throw new SuiAgentPassportVerificationError(402, 'AgentPassport update transaction did not finish successfully.');
  }
  if (!hasExpectedUpdateEvent(result, payload.walletTransactionRequest)) {
    throw new SuiAgentPassportVerificationError(402, 'AgentPassport update transaction is missing the expected AgentPassportMemoryUpdated event.');
  }
}

function hasSuccessfulEffects(result: Record<string, unknown>): boolean {
  const effects = recordOptional(result.effects);
  const status = recordOptional(effects?.status);
  return status?.status === 'success';
}

function hasExpectedUpdateEvent(result: Record<string, unknown>, request: SuiAgentPassportUpdateWalletRequest): boolean {
  const events = Array.isArray(result.events) ? result.events : [];
  return events.some((event) => {
    if (!isRecord(event)) return false;
    const type = stringOptional(event.type);
    if (!type?.endsWith('::agent_passport::AgentPassportMemoryUpdated') || !type.toLowerCase().startsWith(`${request.packageId.toLowerCase()}::`)) {
      return false;
    }
    const parsed = recordOptional(event.parsedJson);
    return (
      stringOptional(parsed?.latest_walrus_blob_id) === request.expected.latestWalrusBlobId &&
      stringOptional(parsed?.latest_sui_anchor_digest) === request.expected.latestSuiAnchorDigest &&
      stringOptional(parsed?.latest_record_hash) === request.expected.latestRecordHash &&
      stringOptional(parsed?.memory_index_blob_id) === request.expected.memoryIndexBlobId
    );
  });
}

function isAgentPassportUpdateWalletRequest(value: unknown): value is SuiAgentPassportUpdateWalletRequest {
  if (!isRecord(value)) return false;
  return (
    value.objectType === 'walrusproof.sui_agent_passport_update_wallet_request.v1' &&
    value.version === 1 &&
    value.kind === 'update_memory_pointer' &&
    typeof value.network === 'string' &&
    typeof value.packageId === 'string' &&
    isRecord(value.expected)
  );
}

function recordField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  const next = value[field];
  if (!isRecord(next)) {
    throw new SuiAgentPassportVerificationError(502, `Sui RPC response is missing ${field}.`);
  }
  return next;
}

function recordOptional(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringOptional(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
