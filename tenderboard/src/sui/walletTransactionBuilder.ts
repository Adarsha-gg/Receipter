import type { SuiMoveArgument, SuiWalletTransactionRequest } from '../live/types.js';

export const DEFAULT_SUI_GAS_BUDGET_MIST = '100000000';

export function buildSuiWalletTransactionBase(input: {
  kind: SuiWalletTransactionRequest['kind'];
  network: string;
  signerRole: SuiWalletTransactionRequest['signerRole'];
  description: string;
  gasBudgetMist?: string;
  required: SuiWalletTransactionRequest['required'];
  metadata: SuiWalletTransactionRequest['metadata'];
  commands: SuiWalletTransactionRequest['commands'];
}): SuiWalletTransactionRequest {
  return {
    objectType: 'walrusproof.sui_wallet_transaction_request.v1',
    version: 1,
    kind: input.kind,
    chain: `sui:${input.network}`,
    network: input.network,
    signerRole: input.signerRole,
    walletStandard: 'sui:signAndExecuteTransaction',
    builder: 'sui-typescript-sdk-transaction',
    description: input.description,
    gasBudgetMist: input.gasBudgetMist ?? DEFAULT_SUI_GAS_BUDGET_MIST,
    required: input.required,
    commands: input.commands,
    metadata: input.metadata,
  };
}

export function pureUtf8Vector(value: string): SuiMoveArgument {
  const bytes = Array.from(Buffer.from(value, 'utf8'));
  return {
    kind: 'pure',
    type: 'vector<u8>',
    value,
    encoding: 'utf8',
    bytes,
    hex: bytesToHex(bytes),
  };
}

export function pureU16(value: string): SuiMoveArgument {
  assertIntegerString(value, 'u16');
  const numeric = Number(value);
  if (numeric < 0 || numeric > 65535) {
    throw new Error(`Sui u16 argument is out of range: ${value}.`);
  }
  return { kind: 'pure', type: 'u16', value };
}

export function pureU64(value: string): SuiMoveArgument {
  assertIntegerString(value, 'u64');
  if (BigInt(value) < 0n) {
    throw new Error(`Sui u64 argument is out of range: ${value}.`);
  }
  return { kind: 'pure', type: 'u64', value };
}

export function objectArgument(objectId: string, mutable: boolean): SuiMoveArgument {
  assertConfigured('Sui object id', objectId);
  return {
    kind: 'object',
    type: 'object',
    objectId,
    mutable,
  };
}

export function assertConfigured(label: string, value: string | undefined): asserts value is string {
  if (!value || value.startsWith('<')) {
    throw new Error(`${label} must be configured before building a production Sui wallet transaction.`);
  }
}

function assertIntegerString(value: string, type: string): void {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Sui ${type} argument must be an integer string: ${value}.`);
  }
}

function bytesToHex(bytes: number[]): string {
  return `0x${Buffer.from(bytes).toString('hex')}`;
}
