import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import type { LiveRunReceipt, SuiMoveCallCommand, SuiSplitCoinsCommand, SuiTransferObjectsCommand } from '../src/live/types.js';
import { buildSuiAnchorPlan } from '../src/sui/anchorPlan.js';
import { buildSuiReceiptAnchorPayload, buildSuiReceiptAnchorTransactionRequest } from '../src/sui/anchorTransactionBuilder.js';
import { buildPaymentIntentPlan } from '../src/sui/paymentPlan.js';
import { buildSuiX402PaymentTransactionRequest } from '../src/sui/paymentTransactionBuilder.js';

describe('Sui wallet transaction builders', () => {
  it('builds an x402 payment transaction request for wallet signing', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui',
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xreceiver',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
    });
    const paymentIntentPlan = buildPaymentIntentPlan({
      runId: 'run_pay',
      createdAt: '2026-06-20T12:00:00.000Z',
      maxPayment: { amount: '0.050', currency: 'SUI' },
      selectedBid: {
        bidId: 'public_scout_standard',
        workerAgentId: 'sui_worker',
        priceSui: '0.035',
        sla: '24h',
        requestedDataLabel: 'public',
      },
      specHash: 'sha256:spec',
      config,
    });
    const receipt = {
      runId: 'run_pay',
      workerAgentId: 'sui_worker',
      paymentIntentPlan,
    } as LiveRunReceipt;

    const request = buildSuiX402PaymentTransactionRequest(receipt, config);

    expect(paymentIntentPlan.walletTransactionRequest).toMatchObject({
      kind: 'x402_payment',
      chain: 'sui:testnet',
      walletStandard: 'sui:signAndExecuteTransaction',
    });
    expect(request).toMatchObject({
      objectType: 'walrusproof.sui_wallet_transaction_request.v1',
      kind: 'x402_payment',
      signerRole: 'hirer',
      gasBudgetMist: '100000000',
      required: {
        packageId: '0xpackage',
        receiptRegistryId: '0xregistry',
        receiverAddress: '0xreceiver',
      },
      metadata: {
        runId: 'run_pay',
        resource: '/api/runs/run_pay/worker-task',
        amountMist: '35000000',
        receiverAddress: '0xreceiver',
        workerAgentId: 'sui_worker',
      },
    });

    const split = request.commands[0] as SuiSplitCoinsCommand;
    const transfer = request.commands[1] as SuiTransferObjectsCommand;
    const moveCall = request.commands[2] as SuiMoveCallCommand;
    expect(split).toMatchObject({ kind: 'splitCoins', source: 'gas', amountsMist: ['35000000'], assign: 'payment' });
    expect(transfer).toMatchObject({ kind: 'transferObjects', objects: ['payment.0'], recipient: '0xreceiver' });
    expect(moveCall.target).toBe('0xpackage::receipts::record_payment_intent');
    expect(moveCall.arguments[0]).toMatchObject({
      kind: 'pure',
      type: 'vector<u8>',
      value: 'run_pay',
      bytes: [114, 117, 110, 95, 112, 97, 121],
      hex: '0x72756e5f706179',
    });
    expect(moveCall.arguments[1]).toMatchObject({
      value: '/api/runs/run_pay/worker-task',
      hex: '0x2f6170692f72756e732f72756e5f7061792f776f726b65722d7461736b',
    });
  });

  it('builds a receipt anchor transaction request and signed payload', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui',
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus-testnet.walrus.space',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus-testnet.walrus.space',
    });
    const plan = buildSuiAnchorPlan(sampleReceipt(), config, 'walrus_blob_123');

    const request = buildSuiReceiptAnchorTransactionRequest(plan);
    const payload = buildSuiReceiptAnchorPayload(plan, '0xanchor_digest');

    expect(request).toMatchObject({
      objectType: 'walrusproof.sui_wallet_transaction_request.v1',
      kind: 'receipt_anchor',
      chain: 'sui:testnet',
      signerRole: 'operator',
      required: {
        packageId: '0xpackage',
        receiptRegistryId: '0xregistry',
        receiverAddress: '0xoperator',
        walrusBlobId: 'walrus_blob_123',
      },
      metadata: {
        runId: 'run_sui',
        paymentReference: '0xsui_payment',
        duplicatePreventionKey: 'testnet:payment_intent_run_sui:payment_nonce_123:settlement_nonce_456',
        workerAgentId: 'sui_worker',
      },
    });

    const moveCall = request.commands[0] as SuiMoveCallCommand;
    expect(moveCall.target).toBe('0xpackage::receipts::anchor_receipt');
    expect(moveCall.arguments[0]).toMatchObject({ kind: 'object', objectId: '0xregistry', mutable: true });
    expect(moveCall.arguments[1]).toMatchObject({ kind: 'pure', type: 'vector<u8>', value: 'run_sui', hex: '0x72756e5f737569' });
    expect(moveCall.arguments[4]).toMatchObject({ kind: 'pure', type: 'u16', value: '91' });
    expect(moveCall.arguments[16]).toMatchObject({ kind: 'pure', type: 'u64', value: '1' });
    expect(moveCall.arguments[20]).toMatchObject({
      kind: 'pure',
      type: 'vector<u8>',
      value: 'AAA:0,AA:1,A:0,B:0,C:0',
      hex: '0x4141413a302c41413a312c413a302c423a302c433a30',
    });
    expect(payload).toEqual({
      objectType: 'walrusproof.sui_receipt_anchor_payload.v1',
      version: 1,
      network: 'sui:testnet',
      transaction: '0xanchor_digest',
      runId: 'run_sui',
      receiptRegistryId: '0xregistry',
      packageId: '0xpackage',
      paymentReference: '0xsui_payment',
      walrusBlobId: 'walrus_blob_123',
      duplicatePreventionKey: 'testnet:payment_intent_run_sui:payment_nonce_123:settlement_nonce_456',
      workerAgentId: 'sui_worker',
    });
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
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000',
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
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000',
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
