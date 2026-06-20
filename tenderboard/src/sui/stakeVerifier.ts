import type { TenderBoardConfig } from '../live/types.js';
import type { SuiStakeWalletTransactionRequest } from './stakePlan.js';

export class SuiStakeVerificationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SuiStakeVerificationError';
  }
}

export interface SuiStakeExecutionPayload {
  objectType: 'walrusproof.sui_stake_execution_payload.v1';
  version: 1;
  transaction: string;
  walletTransactionRequest: SuiStakeWalletTransactionRequest;
}

export interface SuiStakeExecutionVerification {
  objectType: 'walrusproof.sui_stake_execution_verification.v1';
  ok: true;
  kind: SuiStakeWalletTransactionRequest['kind'];
  transaction: string;
  network: string;
  verifiedAt: string;
  checks: {
    requestBound: true;
    transactionSuccessful: true;
    expectedEventsObserved: true;
  };
}

export function parseSuiStakeExecutionPayload(value: unknown): SuiStakeExecutionPayload {
  if (!isRecord(value)) {
    throw new SuiStakeVerificationError(400, 'Sui stake execution payload must be a JSON object.');
  }
  const payload = {
    objectType: stringField(value, 'objectType'),
    version: numberField(value, 'version'),
    transaction: stringField(value, 'transaction'),
    walletTransactionRequest: value.walletTransactionRequest,
  };
  if (payload.objectType !== 'walrusproof.sui_stake_execution_payload.v1') {
    throw new SuiStakeVerificationError(400, 'Sui stake execution payload objectType is not supported.');
  }
  if (payload.version !== 1) {
    throw new SuiStakeVerificationError(400, 'Sui stake execution payload version is not supported.');
  }
  if (!isStakeWalletTransactionRequest(payload.walletTransactionRequest)) {
    throw new SuiStakeVerificationError(400, 'Sui stake execution payload is missing walletTransactionRequest.');
  }
  return payload as SuiStakeExecutionPayload;
}

export async function verifySuiStakeExecution(input: {
  payload: SuiStakeExecutionPayload;
  config: TenderBoardConfig;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<SuiStakeExecutionVerification> {
  const request = input.payload.walletTransactionRequest;
  if (request.network !== input.config.suiNetwork) {
    throw new SuiStakeVerificationError(402, 'Sui stake transaction network mismatch.');
  }
  if (request.packageId.toLowerCase() !== (input.config.suiPackageId ?? '').toLowerCase()) {
    throw new SuiStakeVerificationError(402, 'Sui stake transaction package mismatch.');
  }

  if (input.config.mode === 'sui') {
    await verifySuiRpcStakeExecution(input.payload, input.config, input.fetchImpl ?? fetch);
  }

  return {
    objectType: 'walrusproof.sui_stake_execution_verification.v1',
    ok: true,
    kind: request.kind,
    transaction: input.payload.transaction,
    network: `sui:${request.network}`,
    verifiedAt: (input.now ?? new Date()).toISOString(),
    checks: {
      requestBound: true,
      transactionSuccessful: true,
      expectedEventsObserved: true,
    },
  };
}

async function verifySuiRpcStakeExecution(
  payload: SuiStakeExecutionPayload,
  config: TenderBoardConfig,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (!config.suiRpcUrl) {
    throw new SuiStakeVerificationError(500, 'SUI_RPC_URL is required for Sui stake execution verification.');
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
    throw new SuiStakeVerificationError(502, `Sui RPC returned HTTP ${response.status}.`);
  }
  const rpc = (await response.json()) as unknown;
  if (!isRecord(rpc)) {
    throw new SuiStakeVerificationError(502, 'Sui RPC returned an invalid response.');
  }
  if (rpc.error !== undefined) {
    throw new SuiStakeVerificationError(402, `Sui stake transaction could not be verified: ${JSON.stringify(rpc.error)}`);
  }
  const result = recordField(rpc, 'result');
  if (stringOptional(result.digest) && result.digest !== payload.transaction) {
    throw new SuiStakeVerificationError(402, 'Sui stake transaction digest mismatch.');
  }
  if (!hasSuccessfulEffects(result)) {
    throw new SuiStakeVerificationError(402, 'Sui stake transaction did not finish successfully.');
  }
  const missingEvents = payload.walletTransactionRequest.expected.events.filter((eventName) =>
    !hasExpectedEvent(result, payload.walletTransactionRequest.packageId, eventName),
  );
  if (missingEvents.length > 0) {
    throw new SuiStakeVerificationError(402, `Sui stake transaction is missing expected event(s): ${missingEvents.join(', ')}.`);
  }
}

function hasSuccessfulEffects(result: Record<string, unknown>): boolean {
  const effects = recordOptional(result.effects);
  const status = recordOptional(effects?.status);
  return status?.status === 'success';
}

function hasExpectedEvent(result: Record<string, unknown>, packageId: string, eventName: string): boolean {
  const events = Array.isArray(result.events) ? result.events : [];
  return events.some((event) => {
    if (!isRecord(event)) return false;
    const type = stringOptional(event.type);
    return Boolean(type?.endsWith(`::reputation_stake::${eventName}`) && type.toLowerCase().startsWith(`${packageId.toLowerCase()}::`));
  });
}

function isStakeWalletTransactionRequest(value: unknown): value is SuiStakeWalletTransactionRequest {
  if (!isRecord(value)) return false;
  return (
    value.objectType === 'walrusproof.sui_stake_wallet_transaction_request.v1' &&
    value.version === 1 &&
    typeof value.kind === 'string' &&
    typeof value.network === 'string' &&
    typeof value.packageId === 'string' &&
    isRecord(value.expected) &&
    Array.isArray(value.expected.events)
  );
}

function stringField(value: Record<string, unknown>, field: string): string {
  const next = value[field];
  if (typeof next !== 'string' || next.trim() === '') {
    throw new SuiStakeVerificationError(400, `Sui stake execution payload is missing ${field}.`);
  }
  return next;
}

function numberField(value: Record<string, unknown>, field: string): number {
  const next = value[field];
  if (typeof next !== 'number') {
    throw new SuiStakeVerificationError(400, `Sui stake execution payload is missing ${field}.`);
  }
  return next;
}

function recordField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  const next = value[field];
  if (!isRecord(next)) {
    throw new SuiStakeVerificationError(502, `Sui RPC response is missing ${field}.`);
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
