import { describe, expect, it } from 'vitest';
import { renderReceiptProof } from '../src/live/proof.js';
import { makeEvent } from '../src/live/runStore.js';
import type { LiveRunReceipt } from '../src/live/types.js';

describe('renderReceiptProof', () => {
  it('renders a judge-readable Sui proof without private notes', () => {
    const proof = renderReceiptProof(sampleReceipt());

    expect(proof).toContain('# TenderBoard Sui Run Proof: run_proof');
    expect(proof).toContain('Sui payment digest: 0xsui');
    expect(proof).toContain('Walrus blob id: walrus_blob_1');
    expect(proof).toContain('Trust verdict: allow');
    expect(proof).toContain('Checker pack: research');
    expect(proof).toContain('Safe task only.');
    expect(proof).toContain('Spec hash: sha256:spec');
    expect(proof).toContain('Opportunity Scout Report');
    expect(proof).not.toContain('private strategy note');
  });
});

function sampleReceipt(): LiveRunReceipt {
  return {
    runId: 'run_proof',
    mode: 'sui',
    status: 'delivered',
    createdAt: '2026-06-19T20:00:00.000Z',
    updatedAt: '2026-06-19T20:05:00.000Z',
    taskTitle: 'Find opportunities',
    sanitizedTask: 'Task: Find opportunities',
    maxPayment: { amount: '0.050', currency: 'SUI' },
    trustDecision: {
      workerAgentId: 'sui_worker',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['No secret-looking lines were found in the public worker packet.'],
      controls: ['Sui payment approval is bound to the exact work order before delivery.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Safe task only.'],
      requiredChecks: [
        { id: 'safe_packet', label: 'Safe worker packet', status: 'passed', detail: 'No forbidden secret pattern remains.' },
      ],
      settlementRule: 'Release after Sui approval and delivery.',
      reputationWriteback: 'Use receipt as Sui feedback.',
    },
    workerAgentId: 'sui_worker',
    workOrderId: 'sui_work_order_1',
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiPaymentDigest: '0xsui',
    suiAnchorDigest: undefined,
    walrusBlobId: 'walrus_blob_1',
    deliveryText: 'Opportunity Scout Report\nLink: https://example.com',
    error: undefined,
    events: [makeEvent({ source: 'sui', type: 'sui_dev_payment_recorded', message: 'Sui dev payment digest recorded.' })],
  };
}
