import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LiveRunReceipt, SuiReceiptAnchorPayload, SuiWalletTransactionRequest, TenderBoardConfig } from '../live/types.js';
import { buildSuiAnchorPlan, type SuiAnchorPlan } from './anchorPlan.js';
import { buildSuiReceiptAnchorPayload, buildSuiReceiptAnchorTransactionRequest } from './anchorTransactionBuilder.js';

const execFileAsync = promisify(execFile);
const VECTOR_ARGUMENT_INDEXES = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 21]);

export interface SuiAnchorExecutionResult {
  executionMode: 'cli_fallback_test_only';
  digest: string;
  payload: SuiReceiptAnchorPayload;
  transactionRequest: SuiWalletTransactionRequest;
  stdout: string;
  stderr: string;
  args: string[];
}

/**
 * Fallback/test-only smoke path. Production callers should build a wallet
 * transaction request, have an operator sign it, then verify/store the digest.
 */
export async function executeSuiAnchorReceipt(receipt: LiveRunReceipt, config: TenderBoardConfig): Promise<SuiAnchorExecutionResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui receipt anchoring.');
  }

  const plan = buildSuiAnchorPlan(receipt, config, receipt.walrusBlobId);
  if (!plan.ready) {
    throw new Error(`Sui anchor plan is not ready. Missing: ${plan.missing.join(', ')}`);
  }

  const args = buildSuiAnchorCliArgs(plan, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const digest = parseSuiTransactionDigest(stdout);
  return {
    executionMode: 'cli_fallback_test_only',
    digest,
    payload: buildSuiReceiptAnchorPayload(plan, digest),
    transactionRequest: buildSuiReceiptAnchorTransactionRequest(plan),
    stdout,
    stderr,
    args,
  };
}

export function buildSuiAnchorCliArgs(plan: SuiAnchorPlan, config: TenderBoardConfig): string[] {
  if (!plan.moveCall.packageId) {
    throw new Error('SUI_PACKAGE_ID is required for automatic Sui receipt anchoring.');
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
    ...plan.moveCall.arguments.map((value, index) => encodeMoveArgument(value, index)),
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function encodeMoveArgument(value: string, index: number): string {
  if (!VECTOR_ARGUMENT_INDEXES.has(index)) return value;
  return textToHexBytes(value);
}

export function textToHexBytes(value: string): string {
  return `0x${Buffer.from(value, 'utf8').toString('hex')}`;
}

function parseSuiTransactionDigest(stdout: string): string {
  const parsed = parseJsonFromOutput(stdout) as {
    digest?: string;
    effects?: {
      transactionDigest?: string;
      status?: {
        status?: string;
        error?: string;
      };
    };
  };
  if (parsed.effects?.status?.status && parsed.effects.status.status !== 'success') {
    throw new Error(`Sui anchor transaction failed: ${parsed.effects.status.error ?? parsed.effects.status.status}`);
  }
  const digest = parsed.digest ?? parsed.effects?.transactionDigest;
  if (!digest) {
    throw new Error('Sui anchor command did not return a transaction digest.');
  }
  return digest;
}

function parseJsonFromOutput(stdout: string): unknown {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Sui anchor command did not return JSON output.');
  }
  return JSON.parse(stdout.slice(start, end + 1));
}
