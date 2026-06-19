import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import type { LiveRunReceipt } from '../src/live/types.js';
import { buildSuiAnchorPlan, renderSuiAnchorPlan } from '../src/sui/anchorPlan.js';

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
    ]);
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
    suiPaymentDigest: '0xsui_payment',
    suiAnchorDigest: undefined,
    walrusBlobId: undefined,
    deliveryText: 'Sui opportunity report',
    error: undefined,
    events: [],
  };
}
