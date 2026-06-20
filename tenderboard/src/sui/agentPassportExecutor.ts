import type { TenderBoardConfig } from '../live/types.js';
import { textToHexBytes } from './anchorExecutor.js';
import type { AgentPassportUpdateTransactionData } from './agentPassportPlan.js';

const VECTOR_ARGUMENT_INDEXES = new Set([1, 2, 3, 4]);

export function buildAgentPassportUpdateCliArgs(plan: AgentPassportUpdateTransactionData, config: TenderBoardConfig): string[] {
  if (!plan.ready) {
    throw new Error(`AgentPassport update transaction is not ready. Missing: ${plan.missing.join(', ')}`);
  }
  if (!plan.moveCall.packageId) {
    throw new Error('SUI_PACKAGE_ID is required for automatic AgentPassport updates.');
  }

  const args = ['client'];
  if (config.suiClientConfig) {
    args.push('--client.config', config.suiClientConfig);
  }
  args.push(
    'call',
    '--package',
    plan.moveCall.packageId,
    '--module',
    plan.moveCall.module,
    '--function',
    plan.moveCall.function,
    '--args',
    ...plan.moveCall.arguments.map((value, index) => encodeAgentPassportMoveArgument(value, index)),
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function encodeAgentPassportMoveArgument(value: string, index: number): string {
  if (!VECTOR_ARGUMENT_INDEXES.has(index)) return value;
  return textToHexBytes(value);
}
