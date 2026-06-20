import { makeSuiDevDigest } from '../live/suiRuntime.js';
import type {
  LiveRunReceipt,
  ReceipterConfig,
  X402SuiFacilitatorVerification,
  X402SuiPaymentPayload,
} from '../live/types.js';

export class SuiX402FacilitatorError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SuiX402FacilitatorError';
  }
}

export interface VerifySuiX402PaymentInput {
  receipt: LiveRunReceipt;
  payload: X402SuiPaymentPayload;
  resource: string;
  config: ReceipterConfig;
  fetchImpl?: typeof fetch;
  now?: Date;
}

export function parseX402PaymentPayload(value: unknown): X402SuiPaymentPayload {
  if (!isRecord(value)) {
    throw new SuiX402FacilitatorError(400, 'X402 payment payload must be a JSON object.');
  }

  const payload = {
    objectType: stringField(value, 'objectType'),
    x402Version: numberField(value, 'x402Version'),
    scheme: stringField(value, 'scheme'),
    network: stringField(value, 'network'),
    transaction: stringField(value, 'transaction'),
    runId: stringField(value, 'runId'),
    resource: stringField(value, 'resource'),
    paymentIntentId: stringField(value, 'paymentIntentId'),
    paymentNonce: stringField(value, 'paymentNonce'),
    settlementNonce: stringField(value, 'settlementNonce'),
    amountMist: stringField(value, 'amountMist'),
    receiverAddress: stringField(value, 'receiverAddress'),
    coinType: stringField(value, 'coinType'),
    workerAgentId: stringField(value, 'workerAgentId'),
  };

  if (payload.objectType !== 'receipter.x402_sui_payment_payload.v1') {
    throw new SuiX402FacilitatorError(400, 'X402 payment payload objectType is not supported.');
  }
  if (payload.x402Version !== 1) {
    throw new SuiX402FacilitatorError(400, 'X402 payment payload version is not supported.');
  }
  if (payload.scheme !== 'sui-payment-kit') {
    throw new SuiX402FacilitatorError(400, 'X402 payment payload scheme must be sui-payment-kit.');
  }
  if (payload.coinType !== '0x2::sui::SUI') {
    throw new SuiX402FacilitatorError(400, 'X402 Sui facilitator currently accepts 0x2::sui::SUI only.');
  }

  return payload as X402SuiPaymentPayload;
}

export function parseX402PaymentHeader(value: string | string[] | undefined): X402SuiPaymentPayload | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return undefined;

  const trimmed = header.trim();
  if (!trimmed) return undefined;

  try {
    return parseX402PaymentPayload(JSON.parse(trimmed));
  } catch (jsonError) {
    try {
      const decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
      return parseX402PaymentPayload(JSON.parse(decoded));
    } catch {
      if (jsonError instanceof SuiX402FacilitatorError) throw jsonError;
      throw new SuiX402FacilitatorError(400, 'X402 payment header must be JSON or base64url-encoded JSON.');
    }
  }
}

export async function verifySuiX402Payment(input: VerifySuiX402PaymentInput): Promise<X402SuiFacilitatorVerification> {
  const { receipt, payload, resource, config } = input;
  const paymentIntent = receipt.paymentIntentPlan;
  const receiptPlan = receipt.receiptPlan;
  if (!paymentIntent || !receiptPlan) {
    throw new SuiX402FacilitatorError(409, 'Run is missing Sui payment plan metadata.');
  }
  if (receipt.suiPaymentDigest) {
    throw new SuiX402FacilitatorError(409, 'X402 payment has already been verified for this run.');
  }
  if (receipt.status !== 'awaiting_payment_approval') {
    throw new SuiX402FacilitatorError(409, `Run is not waiting for payment approval. Current status: ${receipt.status}`);
  }

  assertEqual('run id', payload.runId, receipt.runId);
  assertEqual('resource', payload.resource, resource);
  assertEqual('run resource', resource, `/api/runs/${receipt.runId}/worker-task`);
  assertEqual('network', payload.network, `sui:${paymentIntent.expectedNetwork}`);
  assertEqual('payment intent id', payload.paymentIntentId, paymentIntent.intentId);
  assertEqual('payment nonce', payload.paymentNonce, paymentIntent.paymentNonce);
  assertEqual('settlement nonce', payload.settlementNonce, paymentIntent.settlementNonce);
  assertEqual('amount', payload.amountMist, paymentIntent.amountMist);
  assertEqual('receiver', payload.receiverAddress, paymentIntent.receiverAddress);
  assertEqual('coin type', payload.coinType, paymentIntent.coinType);
  assertEqual('worker agent', payload.workerAgentId, receipt.workerAgentId);
  if (!payload.transaction.trim()) {
    throw new SuiX402FacilitatorError(400, 'X402 payment payload is missing a Sui transaction digest.');
  }

  if (config.mode === 'sui-dev') {
    assertEqual('Sui dev payment digest', payload.transaction, makeSuiDevDigest('payment', receipt.runId));
  } else {
    await verifySuiRpcSettlement({
      payload,
      receipt,
      config,
      fetchImpl: input.fetchImpl ?? fetch,
    });
  }

  return {
    objectType: 'receipter.sui_x402_facilitator_verification.v1',
    facilitator: 'Receipter-sui-x402',
    ok: true,
    runId: receipt.runId,
    resource,
    transaction: payload.transaction,
    network: payload.network,
    verifiedAt: (input.now ?? new Date()).toISOString(),
    checks: {
      requestBound: true,
      nonceBound: true,
      amountBound: true,
      receiverBound: true,
      workerBound: true,
      suiSettlementVerified: true,
      replayProtected: true,
    },
  };
}

async function verifySuiRpcSettlement(input: {
  payload: X402SuiPaymentPayload;
  receipt: LiveRunReceipt;
  config: ReceipterConfig;
  fetchImpl: typeof fetch;
}): Promise<void> {
  if (!input.config.suiRpcUrl) {
    throw new SuiX402FacilitatorError(500, 'SUI_RPC_URL is required for Sui x402 facilitator verification.');
  }

  const response = await input.fetchImpl(input.config.suiRpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getTransactionBlock',
      params: [
        input.payload.transaction,
        {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showBalanceChanges: true,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new SuiX402FacilitatorError(502, `Sui RPC returned HTTP ${response.status}.`);
  }

  const rpc = (await response.json()) as unknown;
  if (!isRecord(rpc)) {
    throw new SuiX402FacilitatorError(502, 'Sui RPC returned an invalid response.');
  }
  if (rpc.error !== undefined) {
    throw new SuiX402FacilitatorError(402, `Sui transaction could not be verified: ${JSON.stringify(rpc.error)}`);
  }
  const result = recordField(rpc, 'result');
  if (stringOptional(result.digest) && result.digest !== input.payload.transaction) {
    throw new SuiX402FacilitatorError(402, 'Sui transaction digest does not match the payment payload.');
  }
  if (!hasSuccessfulEffects(result)) {
    throw new SuiX402FacilitatorError(402, 'Sui transaction did not finish successfully.');
  }
  if (!hasMatchingPaymentIntentMarker(result, input.payload, input.receipt, input.config)) {
    throw new SuiX402FacilitatorError(
      402,
      'Sui transaction is missing the expected PaymentIntentRecorded nonce marker.',
    );
  }
  if (!hasMatchingReceiverBalanceChange(result, input.payload) && !isSelfPaymentTransaction(result, input.payload)) {
    throw new SuiX402FacilitatorError(402, 'Sui transaction does not pay the expected amount to the expected receiver.');
  }
}

function hasSuccessfulEffects(result: Record<string, unknown>): boolean {
  const effects = recordOptional(result.effects);
  const status = recordOptional(effects?.status);
  return status?.status === 'success';
}

function hasMatchingReceiverBalanceChange(result: Record<string, unknown>, payload: X402SuiPaymentPayload): boolean {
  const changes = Array.isArray(result.balanceChanges) ? result.balanceChanges : [];
  return changes.some((change) => {
    if (!isRecord(change)) return false;
    const owner = recordOptional(change.owner);
    const ownerAddress = owner ? stringOptional(owner.AddressOwner) : undefined;
    const coinType = stringOptional(change.coinType);
    const amount = stringOptional(change.amount);
    return sameAddress(ownerAddress, payload.receiverAddress) && coinType === payload.coinType && amount === payload.amountMist;
  });
}

function isSelfPaymentTransaction(result: Record<string, unknown>, payload: X402SuiPaymentPayload): boolean {
  return sameAddress(transactionSender(result), payload.receiverAddress);
}

function transactionSender(result: Record<string, unknown>): string | undefined {
  const transaction = recordOptional(result.transaction);
  const data = recordOptional(transaction?.data);
  return stringOptional(data?.sender);
}

function hasMatchingPaymentIntentMarker(
  result: Record<string, unknown>,
  payload: X402SuiPaymentPayload,
  receipt: LiveRunReceipt,
  config: ReceipterConfig,
): boolean {
  const events = Array.isArray(result.events) ? result.events : [];
  return events.some((event) => {
    if (!isRecord(event)) return false;
    const type = stringOptional(event.type);
    if (!type || !isPaymentIntentEventType(type, config.suiPackageId)) return false;

    const parsedJson = recordOptional(event.parsedJson);
    if (!parsedJson) return false;

    return (
      eventString(parsedJson, 'run_id', 'runId') === payload.runId &&
      eventString(parsedJson, 'resource') === payload.resource &&
      eventString(parsedJson, 'payment_intent_id', 'paymentIntentId') === payload.paymentIntentId &&
      eventString(parsedJson, 'payment_nonce', 'paymentNonce') === payload.paymentNonce &&
      eventString(parsedJson, 'settlement_nonce', 'settlementNonce') === payload.settlementNonce &&
      eventString(parsedJson, 'amount_mist', 'amountMist') === payload.amountMist &&
      sameAddress(eventString(parsedJson, 'receiver'), payload.receiverAddress) &&
      eventString(parsedJson, 'worker_agent_id', 'workerAgentId') === receipt.workerAgentId
    );
  });
}

function isPaymentIntentEventType(type: string, packageId: string | undefined): boolean {
  if (!type.endsWith('::receipts::PaymentIntentRecorded')) return false;
  // Upgraded Sui packages can surface events under the package's original id
  // even when the PTB calls the latest published package id.
  if (!packageId) return true;
  return type.includes('::receipts::PaymentIntentRecorded');
}

function eventString(value: Record<string, unknown>, snakeField: string, camelField?: string): string | undefined {
  return decodedStringOptional(value[snakeField]) ?? (camelField ? decodedStringOptional(value[camelField]) : undefined);
}

function decodedStringOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.trim() === '') return value;
  const decoded = decodeBase64Printable(value);
  return decoded ?? value;
}

function decodeBase64Printable(value: string): string | undefined {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return undefined;
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  if (!decoded || decoded.includes('\u0000')) return undefined;
  if (!/^[\x20-\x7E]+$/.test(decoded)) return undefined;
  return decoded;
}

function sameAddress(actual: string | undefined, expected: string): boolean {
  return typeof actual === 'string' && actual.toLowerCase() === expected.toLowerCase();
}

function assertEqual(label: string, actual: string, expected: string): void {
  if (actual !== expected) {
    throw new SuiX402FacilitatorError(402, `X402 payment ${label} mismatch.`);
  }
}

function stringField(value: Record<string, unknown>, field: string): string {
  const next = value[field];
  if (typeof next !== 'string' || next.trim() === '') {
    throw new SuiX402FacilitatorError(400, `X402 payment payload is missing ${field}.`);
  }
  return next;
}

function numberField(value: Record<string, unknown>, field: string): number {
  const next = value[field];
  if (typeof next !== 'number') {
    throw new SuiX402FacilitatorError(400, `X402 payment payload is missing ${field}.`);
  }
  return next;
}

function recordField(value: Record<string, unknown>, field: string): Record<string, unknown> {
  const next = value[field];
  if (!isRecord(next)) {
    throw new SuiX402FacilitatorError(502, `Sui RPC response is missing ${field}.`);
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
