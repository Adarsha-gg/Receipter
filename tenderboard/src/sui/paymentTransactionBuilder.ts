import type { LiveRunReceipt, PaymentIntentPlan, SuiWalletTransactionRequest, TenderBoardConfig } from '../live/types.js';
import { assertConfigured, buildSuiWalletTransactionBase, pureUtf8Vector } from './walletTransactionBuilder.js';

export interface BuildSuiX402PaymentTransactionRequestInput {
  runId: string;
  workerAgentId: string;
  paymentIntent: PaymentIntentPlan;
  config: Pick<TenderBoardConfig, 'suiNetwork' | 'suiPackageId' | 'suiReceiptRegistryId'>;
}

export function buildSuiX402PaymentTransactionRequest(
  receipt: LiveRunReceipt,
  config: TenderBoardConfig,
): SuiWalletTransactionRequest {
  const paymentIntent = receipt.paymentIntentPlan;
  if (!paymentIntent) {
    throw new Error(`Run ${receipt.runId} is missing payment intent metadata.`);
  }

  return buildSuiX402PaymentTransactionRequestFromIntent({
    runId: receipt.runId,
    workerAgentId: receipt.workerAgentId,
    paymentIntent,
    config,
  });
}

export function buildSuiX402PaymentTransactionRequestFromIntent(
  input: BuildSuiX402PaymentTransactionRequestInput,
): SuiWalletTransactionRequest {
  const packageId = input.config.suiPackageId;
  assertConfigured('SUI_PACKAGE_ID', packageId);
  assertConfigured('SUI_OPERATOR_ADDRESS', input.paymentIntent.receiverAddress);

  const resource = workerTaskResource(input.runId);
  const target = `${packageId}::receipts::record_payment_intent`;

  return buildSuiWalletTransactionBase({
    kind: 'x402_payment',
    network: input.paymentIntent.expectedNetwork || input.config.suiNetwork,
    signerRole: 'hirer',
    description: `Pay ${input.paymentIntent.amountSui} SUI for WalrusProof worker access.`,
    required: {
      packageId,
      receiptRegistryId: input.config.suiReceiptRegistryId,
      receiverAddress: input.paymentIntent.receiverAddress,
    },
    metadata: {
      runId: input.runId,
      resource,
      paymentIntentId: input.paymentIntent.intentId,
      paymentNonce: input.paymentIntent.paymentNonce,
      settlementNonce: input.paymentIntent.settlementNonce,
      amountMist: input.paymentIntent.amountMist,
      amountSui: input.paymentIntent.amountSui,
      receiverAddress: input.paymentIntent.receiverAddress,
      coinType: input.paymentIntent.coinType,
      workerAgentId: input.workerAgentId,
      selectedBidId: input.paymentIntent.selectedBid?.bidId,
    },
    commands: [
      {
        kind: 'splitCoins',
        source: 'gas',
        amountsMist: [input.paymentIntent.amountMist],
        assign: 'payment',
      },
      {
        kind: 'transferObjects',
        objects: ['payment.0'],
        recipient: input.paymentIntent.receiverAddress,
      },
      {
        kind: 'moveCall',
        target,
        arguments: [
          pureUtf8Vector(input.runId),
          pureUtf8Vector(resource),
          pureUtf8Vector(input.paymentIntent.intentId),
          pureUtf8Vector(input.paymentIntent.paymentNonce),
          pureUtf8Vector(input.paymentIntent.settlementNonce),
          pureUtf8Vector(input.paymentIntent.amountMist),
          pureUtf8Vector(input.paymentIntent.receiverAddress),
          pureUtf8Vector(input.workerAgentId),
        ],
      },
    ],
  });
}

export function workerTaskResource(runId: string): string {
  return `/api/runs/${runId}/worker-task`;
}
