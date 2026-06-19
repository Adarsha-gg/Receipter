import { describe, expect, it } from 'vitest';
import { renderReceiptProof } from '../src/live/proof.js';
import { makeEvent } from '../src/live/runStore.js';
import type { LiveRunReceipt } from '../src/live/types.js';

describe('renderReceiptProof', () => {
  it('renders a judge-readable proof without private notes', () => {
    const proof = renderReceiptProof(sampleReceipt());

    expect(proof).toContain('# TenderBoard Run Proof: run_proof');
    expect(proof).toContain('Payment tx hash: 0xabc');
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
    mode: 'live',
    status: 'delivered',
    createdAt: '2026-06-18T20:00:00.000Z',
    updatedAt: '2026-06-18T20:05:00.000Z',
    taskTitle: 'Find opportunities',
    sanitizedTask: 'Task: Find opportunities',
    maxPayment: { amount: '0.05', currency: 'USDC' },
    trustDecision: {
      workerAgentId: 'svc_worker',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['No secret-looking lines were found in the public worker packet.'],
      controls: ['Payment requires explicit approval.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Safe task only.'],
      requiredChecks: [
        { id: 'safe_packet', label: 'Safe worker packet', status: 'passed', detail: 'No forbidden secret pattern remains.' },
      ],
      settlementRule: 'Release after approval and delivery.',
      reputationWriteback: 'Use receipt as feedback.',
    },
    crooServiceId: 'svc_worker',
    negotiationId: 'neg_1',
    orderId: 'order_1',
    paymentTxHash: '0xabc',
    deliveryText: 'Opportunity Scout Report\nLink: https://example.com',
    error: undefined,
    events: [makeEvent({ source: 'croo', type: 'payment_paid', message: 'CROO payment transaction sent.' })],
  };
}
