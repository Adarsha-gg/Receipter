import type { LiveRunReceipt, TenderBoardConfig } from '../live/types.js';
import { SUI_COIN_TYPE, suiAmountToMist } from './paymentPlan.js';

export interface SuiAnchorPlan {
  ready: boolean;
  network: string;
  missing: string[];
  packageId: string | undefined;
  receiptRegistryId: string | undefined;
  walrus: {
    publisherUrl: string | undefined;
    aggregatorUrl: string | undefined;
    blobId: string | undefined;
  };
  payment: {
    intentId: string;
    paymentNonce: string;
    settlementNonce: string;
    duplicatePreventionKey: string;
    amountMist: string;
    coinType: string;
    receiverAddress: string;
    paymentDigest: string | undefined;
  };
  moveCall: {
    packageId: string | undefined;
    module: 'receipts';
    function: 'anchor_receipt';
    arguments: string[];
  };
}

export function buildSuiAnchorPlan(
  receipt: LiveRunReceipt,
  config: TenderBoardConfig,
  walrusBlobId?: string,
): SuiAnchorPlan {
  const payment = paymentPlanFields(receipt, config);
  const paymentReference = payment.paymentDigest ?? receipt.suiPaymentDigest ?? receipt.workOrderId ?? 'not-paid';
  const argumentsForMove = [
    config.suiReceiptRegistryId ?? '<SUI_RECEIPT_REGISTRY_ID>',
    receipt.runId,
    receipt.verificationManifest.specHash,
    receipt.verificationManifest.evidenceHash ?? 'pending',
    String(receipt.trustDecision.score),
    receipt.trustDecision.verdict,
    receipt.verificationManifest.checkerPack,
    paymentReference,
    walrusBlobId ?? receipt.walrusBlobId ?? '<WALRUS_BLOB_ID>',
    payment.paymentNonce,
    payment.amountMist,
    payment.coinType,
    payment.receiverAddress,
    payment.settlementNonce,
    payment.duplicatePreventionKey,
  ];

  return {
    ready: config.missingSuiSettings.length === 0 && Boolean(walrusBlobId ?? receipt.walrusBlobId),
    network: config.suiNetwork,
    missing: walrusBlobId ?? receipt.walrusBlobId ? config.missingSuiSettings : [...config.missingSuiSettings, 'WALRUS_BLOB_ID'],
    packageId: config.suiPackageId,
    receiptRegistryId: config.suiReceiptRegistryId,
    walrus: {
      publisherUrl: config.walrusPublisherUrl,
      aggregatorUrl: config.walrusAggregatorUrl,
      blobId: walrusBlobId ?? receipt.walrusBlobId,
    },
    payment,
    moveCall: {
      packageId: config.suiPackageId,
      module: 'receipts',
      function: 'anchor_receipt',
      arguments: argumentsForMove,
    },
  };
}

export function renderSuiAnchorPlan(plan: SuiAnchorPlan): string {
  const lines = [
    '# TenderBoard Sui Anchor Plan',
    '',
    `- Ready: ${plan.ready ? 'yes' : 'no'}`,
    `- Network: ${plan.network}`,
    `- Package id: ${plan.packageId ?? 'missing'}`,
    `- Receipt registry id: ${plan.receiptRegistryId ?? 'missing'}`,
    `- Walrus publisher: ${plan.walrus.publisherUrl ?? 'missing'}`,
    `- Walrus aggregator: ${plan.walrus.aggregatorUrl ?? 'missing'}`,
    `- Walrus blob id: ${plan.walrus.blobId ?? 'missing'}`,
    `- Payment intent id: ${plan.payment.intentId}`,
    `- Payment nonce: ${plan.payment.paymentNonce}`,
    `- Settlement nonce: ${plan.payment.settlementNonce}`,
    `- Duplicate-prevention key: ${plan.payment.duplicatePreventionKey}`,
    `- Amount MIST: ${plan.payment.amountMist}`,
    `- Coin type: ${plan.payment.coinType}`,
    `- Receiver: ${plan.payment.receiverAddress}`,
    `- Payment digest: ${plan.payment.paymentDigest ?? 'not paid / no digest'}`,
    '',
  ];

  if (plan.missing.length > 0) {
    lines.push('## Missing', '', ...plan.missing.map((item) => `- ${item}`), '');
  }

  lines.push(
    '## Move Call',
    '',
    '```bash',
    'sui client call \\',
    `  --package ${plan.moveCall.packageId ?? '<SUI_PACKAGE_ID>'} \\`,
    `  --module ${plan.moveCall.module} \\`,
    `  --function ${plan.moveCall.function} \\`,
    `  --args ${plan.moveCall.arguments.map(shellQuote).join(' ')}`,
    '```',
    '',
  );

  return `${lines.join('\n')}\n`;
}

function shellQuote(value: string): string {
  return value.includes(' ') ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function paymentPlanFields(
  receipt: LiveRunReceipt,
  config: TenderBoardConfig,
): SuiAnchorPlan['payment'] {
  const amountSui = receipt.receiptPlan?.amountSui ?? receipt.paymentIntentPlan?.amountSui ?? receipt.settlementInstruction?.amount.amount ?? receipt.maxPayment.amount;
  const intentId = receipt.paymentIntentPlan?.intentId ?? receipt.receiptPlan?.intentId ?? `payment_intent_${receipt.runId}`;
  const paymentNonce = receipt.receiptPlan?.paymentNonce ?? receipt.paymentIntentPlan?.paymentNonce ?? '<PAYMENT_NONCE>';
  const settlementNonce = receipt.receiptPlan?.settlementNonce ?? receipt.paymentIntentPlan?.settlementNonce ?? '<SETTLEMENT_NONCE>';

  return {
    intentId,
    paymentNonce,
    settlementNonce,
    duplicatePreventionKey:
      receipt.receiptPlan?.duplicatePreventionKey ?? `${config.suiNetwork}:${intentId}:${paymentNonce}:${settlementNonce}`,
    amountMist: receipt.receiptPlan?.amountMist ?? receipt.paymentIntentPlan?.amountMist ?? suiAmountToMist(amountSui),
    coinType: receipt.receiptPlan?.coinType ?? receipt.paymentIntentPlan?.coinType ?? SUI_COIN_TYPE,
    receiverAddress:
      receipt.receiptPlan?.receiverAddress ?? receipt.paymentIntentPlan?.receiverAddress ?? config.suiOperatorAddress ?? '<SUI_OPERATOR_ADDRESS>',
    paymentDigest: receipt.receiptPlan?.paymentDigest ?? receipt.suiPaymentDigest,
  };
}
