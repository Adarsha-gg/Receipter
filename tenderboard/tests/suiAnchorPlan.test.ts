import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import type { LiveRunReceipt } from '../src/live/types.js';
import { buildSuiAnchorPlan, renderSuiAnchorPlan } from '../src/sui/anchorPlan.js';
import { suiAmountToMist } from '../src/sui/paymentPlan.js';

describe('Sui anchor plan', () => {
  it('maps a finalized receipt into the Move call arguments', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui',
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
    });
    const plan = buildSuiAnchorPlan(sampleReceipt(), config, 'walrus_blob_123');

    expect(plan.ready).toBe(true);
    expect(plan.network).toBe('testnet');
    expect(plan.moveCall.packageId).toBe('0xpackage');
    expect(plan.moveCall.arguments).toEqual([
      '0xregistry',
      'run_sui',
      'sha256:spec',
      'sha256:evidence',
      '91',
      'allow',
      'research',
      '0xsui_payment',
      'walrus_blob_123',
      'payment_nonce_123',
      '35000000',
      '0x2::sui::SUI',
      '0xoperator',
      'settlement_nonce_456',
      'testnet:payment_intent_run_sui:payment_nonce_123:settlement_nonce_456',
      'sui_worker',
      '1',
      '1',
      '0',
      '91',
      'AAA:0,AA:1,A:0,B:0,C:0',
      '35000000',
    ]);
    expect(renderSuiAnchorPlan(plan)).toContain('Payment nonce: payment_nonce_123');
    expect(renderSuiAnchorPlan(plan)).toContain('Amount MIST: 35000000');
    expect(renderSuiAnchorPlan(plan)).toContain('Payment URI: sui:pay?');
    expect(renderSuiAnchorPlan(plan)).toContain('Reputation event: WorkerReputationUpdated');
    expect(plan.reputation).toMatchObject({
      eventName: 'WorkerReputationUpdated',
      workerAgentId: 'sui_worker',
      anchoredRunCountAfter: 1,
      walrusEvidenceCountAfter: 1,
      totalMistEarnedAfter: '35000000',
    });
  });

  it('converts decimal SUI amounts to MIST without floating point rounding', () => {
    expect(suiAmountToMist('0.035')).toBe('35000000');
    expect(suiAmountToMist('1.000000001')).toBe('1000000001');
  });

  it('renders missing deployment settings without overclaiming readiness', () => {
    const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'sui-dev' });
    const plan = buildSuiAnchorPlan(sampleReceipt(), config);
    const rendered = renderSuiAnchorPlan(plan);

    expect(plan.ready).toBe(false);
    expect(plan.missing).toContain('SUI_PACKAGE_ID');
    expect(plan.missing).toContain('WALRUS_BLOB_ID');
    expect(rendered).toContain('Ready: no');
    expect(rendered).toContain('sui client call');
    expect(rendered).toContain('--package <SUI_PACKAGE_ID>');
  });
});

function sampleReceipt(): LiveRunReceipt {
  return {
    runId: 'run_sui',
    mode: 'sui-dev',
    status: 'delivered',
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
      requiredChecks: [
        { id: 'order_bound_approval', label: 'Sui work-order approval', status: 'passed', detail: 'Approved.' },
        { id: 'delivery_evidence', label: 'Delivery evidence', status: 'passed', detail: 'Delivered.' },
      ],
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
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
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
      walrusBlobId: undefined,
      walrusBlobObjectId: undefined,
      walrusCertifiedEpoch: undefined,
      walrusEndEpoch: undefined,
      walrusReadUrl: undefined,
      anchorDigest: undefined,
      updatedAt: '2026-06-19T01:00:00.000Z',
    },
  };
}
