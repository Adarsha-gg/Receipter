import type { LiveRunReceipt, X402PaymentChallenge, X402PaymentResponse } from './types.js';

export function buildX402SuiPaymentChallenge(receipt: LiveRunReceipt, resource: string): X402PaymentChallenge {
  const paymentIntentPlan = requirePaymentIntentPlan(receipt);

  return {
    objectType: 'suiproof.x402_sui_payment_challenge.v1',
    x402Version: 1,
    error: 'X402_PAYMENT_REQUIRED',
    payerHint: 'hirer-agent',
    settlement: 'sui-payment-kit',
    intentModel: 'sui-payment-intent',
    caveat:
      'This is an x402-style payment challenge carrying Sui Payment Kit and Payment Intent metadata. It does not claim Coinbase facilitator settlement.',
    accepts: [
      {
        scheme: 'sui-payment-kit',
        network: `sui:${paymentIntentPlan.expectedNetwork}`,
        maxAmountRequired: paymentIntentPlan.amountMist,
        resource,
        description: `Pay ${paymentIntentPlan.amountSui} SUI to unlock worker task ${receipt.runId}.`,
        mimeType: 'application/json',
        payTo: paymentIntentPlan.receiverAddress,
        asset: paymentIntentPlan.coinType,
        outputSchema: {
          type: 'object',
          required: ['transaction', 'network', 'paymentIntentId', 'paymentNonce'],
          properties: {
            transaction: { type: 'string', description: 'Sui payment transaction digest.' },
            network: { type: 'string', const: `sui:${paymentIntentPlan.expectedNetwork}` },
            paymentIntentId: { type: 'string', const: paymentIntentPlan.intentId },
            paymentNonce: { type: 'string', const: paymentIntentPlan.paymentNonce },
          },
        },
        extra: {
          settlement: 'sui_payment_kit_metadata_only',
          paymentUri: paymentIntentPlan.paymentUri,
          paymentIntentId: paymentIntentPlan.intentId,
          paymentNonce: paymentIntentPlan.paymentNonce,
          settlementNonce: paymentIntentPlan.settlementNonce,
          selectedBidId: paymentIntentPlan.selectedBid?.bidId,
          workerAgentId: receipt.workerAgentId,
          runId: receipt.runId,
          registry: receipt.suiReceiptRegistryId,
          packageId: receipt.suiPackageId,
        },
      },
    ],
  };
}

export function buildX402SuiPaymentResponse(receipt: LiveRunReceipt): X402PaymentResponse | undefined {
  const paymentIntentPlan = receipt.paymentIntentPlan;
  if (!paymentIntentPlan || !receipt.suiPaymentDigest) return undefined;

  return {
    objectType: 'suiproof.x402_sui_payment_response.v1',
    x402Version: 1,
    settlement: 'sui-payment-kit',
    network: `sui:${paymentIntentPlan.expectedNetwork}`,
    transaction: receipt.suiPaymentDigest,
    paymentIntentId: paymentIntentPlan.intentId,
    paymentNonce: paymentIntentPlan.paymentNonce,
    settlementNonce: paymentIntentPlan.settlementNonce,
  };
}

function requirePaymentIntentPlan(receipt: LiveRunReceipt) {
  if (!receipt.paymentIntentPlan) {
    throw new Error('Run is missing a Sui payment intent plan.');
  }
  return receipt.paymentIntentPlan;
}
