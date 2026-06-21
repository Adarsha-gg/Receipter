import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ReceipterConfig } from '../live/types.js';
import { textToHexBytes } from './anchorExecutor.js';
import type { AgentPassportUpdateTransactionData } from './agentPassportPlan.js';

const VECTOR_ARGUMENT_INDEXES = new Set([1, 2, 3, 4]);
const execFileAsync = promisify(execFile);

export interface AgentPassportUpdateExecutionResult {
  digest: string;
  stdout: string;
  stderr: string;
  args: string[];
}

export async function executeAgentPassportUpdate(
  plan: AgentPassportUpdateTransactionData,
  config: ReceipterConfig,
): Promise<AgentPassportUpdateExecutionResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic AgentPassport updates.');
  }

  const args = buildAgentPassportUpdateCliArgs(plan, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout);
  return { digest: parsed.digest, stdout, stderr, args };
}

export function buildAgentPassportUpdateCliArgs(plan: AgentPassportUpdateTransactionData, config: ReceipterConfig): string[] {
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

function parseSuiTransactionOutput(stdout: string): { digest: string } {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Sui AgentPassport update command did not return JSON output.');
  }
  const raw = JSON.parse(stdout.slice(start, end + 1)) as {
    digest?: string;
    effects?: {
      transactionDigest?: string;
      status?: {
        status?: string;
        error?: string;
      };
    };
  };
  if (raw.effects?.status?.status && raw.effects.status.status !== 'success') {
    throw new Error(`Sui AgentPassport update transaction failed: ${raw.effects.status.error ?? raw.effects.status.status}`);
  }
  const digest = raw.digest ?? raw.effects?.transactionDigest;
  if (!digest) {
    throw new Error('Sui AgentPassport update command did not return a transaction digest.');
  }
  return { digest };
}
