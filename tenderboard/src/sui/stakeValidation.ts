import type { TenderBoardConfig } from '../live/types.js';

const MAX_U64 = (1n << 64n) - 1n;
const SUI_ID_PATTERN = /^0x[0-9a-fA-F]{1,64}$/;
const MAX_TEXT_BYTES = 4096;

export function configuredStakePackageId(config: TenderBoardConfig): string {
  if (!config.suiPackageId) {
    throw new Error('SUI_PACKAGE_ID is required for Sui stake transactions.');
  }
  if (!SUI_ID_PATTERN.test(config.suiPackageId)) {
    throw new Error('SUI_PACKAGE_ID must be a Sui object id.');
  }
  return config.suiPackageId;
}

export function assertSuiObjectId(value: string, label: string): void {
  if (!SUI_ID_PATTERN.test(value)) {
    throw new Error(`${label} must be a Sui object id.`);
  }
}

export function assertPositiveMist(value: string, label: string): void {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${label} must be a positive integer MIST amount.`);
  }
  const amount = BigInt(value);
  if (amount <= 0n || amount > MAX_U64) {
    throw new Error(`${label} must be a positive u64 MIST amount.`);
  }
}

export function assertUtf8MoveText(value: string, label: string): void {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_TEXT_BYTES) {
    throw new Error(`${label} must be ${MAX_TEXT_BYTES} UTF-8 bytes or fewer.`);
  }
}

export function assertWorkerAgentId(value: string): void {
  assertUtf8MoveText(value, 'workerAgentId');
}

