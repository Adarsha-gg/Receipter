import type { LiveRunReceipt, TenderBoardConfig } from '../live/types.js';

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
  const paymentReference = receipt.paymentTxHash ?? receipt.orderId ?? 'not-paid';
  const argumentsForMove = [
    config.suiReceiptRegistryId ?? '<SUI_RECEIPT_REGISTRY_ID>',
    receipt.runId,
    receipt.verificationManifest.specHash,
    receipt.verificationManifest.evidenceHash ?? 'pending',
    String(receipt.trustDecision.score),
    receipt.trustDecision.verdict,
    receipt.verificationManifest.checkerPack,
    paymentReference,
    walrusBlobId ?? '<WALRUS_BLOB_ID>',
  ];

  return {
    ready: config.missingSuiSettings.length === 0 && Boolean(walrusBlobId),
    network: config.suiNetwork,
    missing: walrusBlobId ? config.missingSuiSettings : [...config.missingSuiSettings, 'WALRUS_BLOB_ID'],
    packageId: config.suiPackageId,
    receiptRegistryId: config.suiReceiptRegistryId,
    walrus: {
      publisherUrl: config.walrusPublisherUrl,
      aggregatorUrl: config.walrusAggregatorUrl,
      blobId: walrusBlobId,
    },
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
