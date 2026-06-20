import { randomBytes } from 'node:crypto';
import type { MoneyInput, PaymentIntentPlan, ReceiptPlan, SelectedBidReference, TenderBoardConfig } from '../live/types.js';
import { buildSuiX402PaymentTransactionRequestFromIntent } from './paymentTransactionBuilder.js';

export const SUI_COIN_TYPE = '0x2::sui::SUI' as const;
export const MIST_PER_SUI = 1_000_000_000n;
const PLACEHOLDER_OPERATOR_ADDRESS = '<SUI_OPERATOR_ADDRESS>';

export interface BuildPaymentPlansInput {
  runId: string;
  createdAt: string;
  maxPayment: MoneyInput;
  selectedBid: SelectedBidReference | undefined;
  specHash: string;
  config: TenderBoardConfig;
}

export function suiAmountToMist(amount: string): string {
  const normalized = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid SUI amount: ${amount}.`);
  }

  const [wholePart, fraction = ''] = normalized.split('.');
  const whole = wholePart ?? '0';
  const excessFraction = fraction.slice(9);
  if (excessFraction.replace(/0/g, '').length > 0) {
    throw new Error(`SUI amount has more than 9 decimal places: ${amount}.`);
  }

  const wholeMist = BigInt(whole) * MIST_PER_SUI;
  const fractionalMist = BigInt(fraction.slice(0, 9).padEnd(9, '0') || '0');
  return (wholeMist + fractionalMist).toString();
}

export function buildPaymentIntentPlan(input: BuildPaymentPlansInput): PaymentIntentPlan {
  const amountSui = input.selectedBid?.priceSui ?? input.maxPayment.amount;
  const operatorAddress = input.config.suiOperatorAddress ?? PLACEHOLDER_OPERATOR_ADDRESS;
  const amountMist = suiAmountToMist(amountSui);
  const paymentNonce = makeNonce('payment');
  const settlementNonce = makeNonce('settlement');
  const paymentUri = buildPaymentUri({
    receiverAddress: operatorAddress,
    operatorAddress,
    amountMist,
    paymentNonce,
    settlementNonce,
    network: input.config.suiNetwork,
    runId: input.runId,
    intentId: `payment_intent_${input.runId}`,
    selectedBid: input.selectedBid,
    packageId: input.config.suiPackageId,
    receiptRegistryId: input.config.suiReceiptRegistryId,
  });

  const plan: PaymentIntentPlan = {
    objectType: 'tenderboard.payment_intent_plan.v1',
    intentId: `payment_intent_${input.runId}`,
    paymentNonce,
    settlementNonce,
    amountMist,
    amountSui,
    coinType: SUI_COIN_TYPE,
    receiverAddress: operatorAddress,
    operatorAddress,
    selectedBid: input.selectedBid,
    specHash: input.specHash,
    expectedNetwork: input.config.suiNetwork,
    paymentUri,
    paymentKitMode: 'sui_pay_uri_metadata_only',
    paymentKitCompatibility: 'sui:pay-uri-v1',
    expiresAt: new Date(new Date(input.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: input.createdAt,
  };

  if (input.config.suiPackageId && !operatorAddress.startsWith('<')) {
    plan.walletTransactionRequest = buildSuiX402PaymentTransactionRequestFromIntent({
      runId: input.runId,
      workerAgentId: input.selectedBid?.workerAgentId ?? input.config.workerAgentId,
      paymentIntent: plan,
      config: input.config,
    });
  }

  return plan;
}

export function buildInitialReceiptPlan(intent: PaymentIntentPlan, workerAgentId: string, updatedAt: string): ReceiptPlan {
  return {
    objectType: 'tenderboard.receipt_plan.v1',
    intentId: intent.intentId,
    paymentNonce: intent.paymentNonce,
    settlementNonce: intent.settlementNonce,
    duplicatePreventionKey: `${intent.expectedNetwork}:${intent.intentId}:${intent.paymentNonce}:${intent.settlementNonce}`,
    amountMist: intent.amountMist,
    amountSui: intent.amountSui,
    coinType: intent.coinType,
    receiverAddress: intent.receiverAddress,
    operatorAddress: intent.operatorAddress,
    selectedBidId: intent.selectedBid?.bidId,
    workerAgentId,
    specHash: intent.specHash,
    expectedNetwork: intent.expectedNetwork,
    paymentUri: intent.paymentUri,
    paymentKitMode: intent.paymentKitMode,
    paymentKitCompatibility: intent.paymentKitCompatibility,
    paymentDigest: undefined,
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    anchorDigest: undefined,
    updatedAt,
  };
}

export function bindPaymentDigest(plan: ReceiptPlan, paymentDigest: string, updatedAt: string): ReceiptPlan {
  return {
    ...plan,
    paymentDigest,
    updatedAt,
  };
}

export function bindWalrusEvidence(
  plan: ReceiptPlan,
  walrus: Pick<ReceiptPlan, 'walrusBlobId' | 'walrusBlobObjectId' | 'walrusCertifiedEpoch' | 'walrusEndEpoch' | 'walrusReadUrl'>,
  updatedAt: string,
): ReceiptPlan {
  return {
    ...plan,
    ...walrus,
    updatedAt,
  };
}

export function bindAnchorDigest(plan: ReceiptPlan, anchorDigest: string, updatedAt: string): ReceiptPlan {
  return {
    ...plan,
    anchorDigest,
    updatedAt,
  };
}

function makeNonce(prefix: string): string {
  const marker = prefix === 'payment' ? 'pay' : 'set';
  return `${marker}_${randomBytes(16).toString('hex')}`;
}

function buildPaymentUri(input: {
  receiverAddress: string;
  operatorAddress: string;
  amountMist: string;
  paymentNonce: string;
  settlementNonce: string;
  network: string;
  runId: string;
  intentId: string;
  selectedBid: SelectedBidReference | undefined;
  packageId: string | undefined;
  receiptRegistryId: string | undefined;
}): string {
  const params = new URLSearchParams({
    recipient: input.receiverAddress,
    receiver: input.receiverAddress,
    operator: input.operatorAddress,
    amount: input.amountMist,
    amountMist: input.amountMist,
    coinType: SUI_COIN_TYPE,
    nonce: input.paymentNonce,
    label: 'WalrusProof',
    message: 'WalrusProof agent memory payment',
    paymentNonce: input.paymentNonce,
    settlementNonce: input.settlementNonce,
    network: input.network,
    runId: input.runId,
    intentId: input.intentId,
  });

  if (input.selectedBid) {
    params.set('selectedBidId', input.selectedBid.bidId);
    params.set('workerAgentId', input.selectedBid.workerAgentId);
    params.set('bidPriceSui', input.selectedBid.priceSui);
    params.set('sla', input.selectedBid.sla);
  }
  if (input.packageId) params.set('packageId', input.packageId);
  if (input.receiptRegistryId) {
    params.set('registry', input.receiptRegistryId);
    params.set('receiptRegistryId', input.receiptRegistryId);
  }

  return `sui:pay?${params.toString()}`;
}
