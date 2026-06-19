import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { buildSuiAnchorPlan } from '../src/sui/anchorPlan.js';
import { buildSuiAnchorCliArgs, encodeMoveArgument, textToHexBytes } from '../src/sui/anchorExecutor.js';
import type { LiveRunReceipt } from '../src/live/types.js';

describe('Sui anchor executor', () => {
  it('builds a Sui CLI call with vector fields encoded as hex bytes', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui',
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      SUI_CLI_PATH: 'C:\\sui\\sui.exe',
      SUI_CLIENT_CONFIG: 'C:\\sui\\client.yaml',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus-testnet.walrus.space',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus-testnet.walrus.space',
    });
    const plan = buildSuiAnchorPlan(sampleReceipt(), config, 'walrus_blob_123');

    const args = buildSuiAnchorCliArgs(plan, config);

    expect(args.slice(0, 8)).toEqual([
      'client',
      '--client.config',
      'C:\\sui\\client.yaml',
      'call',
      '--package',
      '0xpackage',
      '--module',
      'receipts',
    ]);
    const moveArgs = args.slice(args.indexOf('--args') + 1, args.indexOf('--gas-budget'));
    expect(moveArgs[0]).toBe('0xregistry');
    expect(moveArgs[1]).toBe(textToHexBytes('run_sui'));
    expect(moveArgs[4]).toBe('91');
    expect(moveArgs[5]).toBe(textToHexBytes('allow'));
    expect(moveArgs[12]).toBe(textToHexBytes('0xoperator'));
    expect(moveArgs[16]).toBe('1');
    expect(moveArgs[19]).toBe('91');
    expect(moveArgs[20]).toBe(textToHexBytes('AAA:0,AA:1,A:0,B:0,C:0'));
    expect(args.at(-1)).toBe('--json');
  });

  it('only encodes vector byte arguments', () => {
    expect(encodeMoveArgument('0xregistry', 0)).toBe('0xregistry');
    expect(encodeMoveArgument('run_sui', 1)).toBe('0x72756e5f737569');
    expect(encodeMoveArgument('91', 4)).toBe('91');
  });
});

function sampleReceipt(): LiveRunReceipt {
  return {
    runId: 'run_sui',
    mode: 'sui',
    status: 'anchoring',
    createdAt: '2026-06-19T01:00:00.000Z',
    updatedAt: '2026-06-19T01:00:00.000Z',
    taskTitle: 'Find Sui agent opportunities',
    sanitizedTask: 'Task: Find Sui agent opportunities',
    maxPayment: { amount: '0.050', currency: 'SUI' },
    trustDecision: {
      workerAgentId: 'sui_worker',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['Buyer-defined acceptance criteria were anchored before dispatch.'],
      controls: ['Payment requires explicit approval.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Return public Sui links.'],
      requiredChecks: [{ id: 'delivery_evidence', label: 'Delivery evidence', status: 'passed', detail: 'Delivered.' }],
      settlementRule: 'Release after Sui approval and delivery.',
      reputationWriteback: 'Use receipt as Sui feedback.',
    },
    workerAgentId: 'sui_worker',
    workOrderId: 'sui_work_order_1',
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiWorkOrderObjectId: '0xworkorder',
    suiEscrowObjectId: '0xescrow',
    suiPaymentDigest: '0xsui_payment',
    suiAnchorDigest: undefined,
    walrusBlobId: 'walrus_blob_123',
    walrusBlobObjectId: '0xwalrus',
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: 436,
    walrusReadUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_123',
    deliveryText: 'Sui opportunity report',
    error: undefined,
    events: [],
    paymentIntentPlan: {
      objectType: 'tenderboard.payment_intent_plan.v1',
      intentId: 'payment_intent_run_sui',
      paymentNonce: 'payment_nonce_123',
      settlementNonce: 'settlement_nonce_456',
      amountMist: '35000000',
      amountSui: '0.035',
      coinType: '0x2::sui::SUI',
      receiverAddress: '0xoperator',
      operatorAddress: '0xoperator',
      selectedBid: {
        bidId: 'public_scout_standard',
        workerAgentId: 'sui_worker',
        priceSui: '0.035',
        sla: '24h',
        requestedDataLabel: 'public',
      },
      specHash: 'sha256:spec',
      expectedNetwork: 'testnet',
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000&coinType=0x2%3A%3Asui%3A%3ASUI&paymentNonce=payment_nonce_123&network=testnet&runId=run_sui',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      expiresAt: '2026-06-20T01:00:00.000Z',
      createdAt: '2026-06-19T01:00:00.000Z',
    },
    receiptPlan: {
      objectType: 'tenderboard.receipt_plan.v1',
      intentId: 'payment_intent_run_sui',
      paymentNonce: 'payment_nonce_123',
      settlementNonce: 'settlement_nonce_456',
      duplicatePreventionKey: 'testnet:payment_intent_run_sui:payment_nonce_123:settlement_nonce_456',
      amountMist: '35000000',
      amountSui: '0.035',
      coinType: '0x2::sui::SUI',
      receiverAddress: '0xoperator',
      operatorAddress: '0xoperator',
      selectedBidId: 'public_scout_standard',
      workerAgentId: 'sui_worker',
      specHash: 'sha256:spec',
      expectedNetwork: 'testnet',
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000&coinType=0x2%3A%3Asui%3A%3ASUI&paymentNonce=payment_nonce_123&network=testnet&runId=run_sui',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      paymentDigest: '0xsui_payment',
      walrusBlobId: 'walrus_blob_123',
      walrusBlobObjectId: '0xwalrus',
      walrusCertifiedEpoch: undefined,
      walrusEndEpoch: 436,
      walrusReadUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_123',
      anchorDigest: undefined,
      updatedAt: '2026-06-19T01:00:00.000Z',
    },
    reputationSnapshot: undefined,
    workerEvidence: undefined,
  };
}
