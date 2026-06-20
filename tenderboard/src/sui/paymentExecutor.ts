import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LiveRunReceipt, SuiWalletTransactionRequest, TenderBoardConfig, X402SuiPaymentPayload } from '../live/types.js';
import { buildSuiX402PaymentTransactionRequest, workerTaskResource } from './paymentTransactionBuilder.js';

const execFileAsync = promisify(execFile);

export interface SuiX402PaymentExecutionResult {
  executionMode: 'cli_fallback_test_only';
  digest: string;
  payload: X402SuiPaymentPayload;
  transactionRequest: SuiWalletTransactionRequest;
  stdout: string;
  stderr: string;
  args: string[];
}

/**
 * Fallback/test-only smoke path. Production callers should build a wallet
 * transaction request and verify the signed digest through the x402 facilitator.
 */
export async function executeSuiX402Payment(
  receipt: LiveRunReceipt,
  config: TenderBoardConfig,
): Promise<SuiX402PaymentExecutionResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui x402 payment execution.');
  }

  const args = buildSuiX402PaymentCliArgs(receipt, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const digest = parseSuiTransactionDigest(stdout);
  return {
    executionMode: 'cli_fallback_test_only',
    digest,
    payload: buildX402PaymentPayload(receipt, digest),
    transactionRequest: buildSuiX402PaymentTransactionRequest(receipt, config),
    stdout,
    stderr,
    args,
  };
}

export function buildSuiX402PaymentCliArgs(receipt: LiveRunReceipt, config: TenderBoardConfig): string[] {
  if (!config.suiPackageId) {
    throw new Error('SUI_PACKAGE_ID is required for automatic Sui x402 payment execution.');
  }
  const paymentIntent = receipt.paymentIntentPlan;
  if (!paymentIntent) {
    throw new Error(`Run ${receipt.runId} is missing payment intent metadata.`);
  }
  if (!paymentIntent.receiverAddress || paymentIntent.receiverAddress.startsWith('<')) {
    throw new Error('SUI_OPERATOR_ADDRESS must be configured before executing a live Sui x402 payment.');
  }

  const args = ['client'];
  if (config.suiClientConfig) {
    args.push('--client.config', config.suiClientConfig);
  }
  args.push(
    'ptb',
    ...makeByteVectorArgs('runId', receipt.runId),
    ...makeByteVectorArgs('resource', workerTaskResource(receipt.runId)),
    ...makeByteVectorArgs('paymentIntentId', paymentIntent.intentId),
    ...makeByteVectorArgs('paymentNonce', paymentIntent.paymentNonce),
    ...makeByteVectorArgs('settlementNonce', paymentIntent.settlementNonce),
    ...makeByteVectorArgs('amountMist', paymentIntent.amountMist),
    ...makeByteVectorArgs('receiver', paymentIntent.receiverAddress),
    ...makeByteVectorArgs('workerAgentId', receipt.workerAgentId),
    '--split-coins',
    'gas',
    `[${paymentIntent.amountMist}]`,
    '--assign',
    'payment',
    '--transfer-objects',
    '[payment.0]',
    `@${paymentIntent.receiverAddress}`,
    '--move-call',
    `${config.suiPackageId}::receipts::record_payment_intent`,
    'runId',
    'resource',
    'paymentIntentId',
    'paymentNonce',
    'settlementNonce',
    'amountMist',
    'receiver',
    'workerAgentId',
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

function makeByteVectorArgs(name: string, value: string): string[] {
  const bytes = Buffer.from(value, 'utf8');
  return ['--make-move-vec', '<u8>', `[${Array.from(bytes).join(',')}]`, '--assign', name];
}

export function buildX402PaymentPayload(receipt: LiveRunReceipt, transaction: string): X402SuiPaymentPayload {
  const paymentIntent = receipt.paymentIntentPlan;
  if (!paymentIntent) {
    throw new Error(`Run ${receipt.runId} is missing payment intent metadata.`);
  }
  return {
    objectType: 'suiproof.x402_sui_payment_payload.v1',
    x402Version: 1,
    scheme: 'sui-payment-kit',
    network: `sui:${paymentIntent.expectedNetwork}`,
    transaction,
    runId: receipt.runId,
    resource: workerTaskResource(receipt.runId),
    paymentIntentId: paymentIntent.intentId,
    paymentNonce: paymentIntent.paymentNonce,
    settlementNonce: paymentIntent.settlementNonce,
    amountMist: paymentIntent.amountMist,
    receiverAddress: paymentIntent.receiverAddress,
    coinType: paymentIntent.coinType,
    workerAgentId: receipt.workerAgentId,
  };
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
    throw new Error(`Sui x402 payment transaction failed: ${parsed.effects.status.error ?? parsed.effects.status.status}`);
  }
  const digest = parsed.digest ?? parsed.effects?.transactionDigest;
  if (!digest) {
    throw new Error('Sui x402 payment command did not return a transaction digest.');
  }
  return digest;
}

function parseJsonFromOutput(stdout: string): unknown {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Sui x402 payment command did not return JSON output.');
  }
  return JSON.parse(stdout.slice(start, end + 1));
}
