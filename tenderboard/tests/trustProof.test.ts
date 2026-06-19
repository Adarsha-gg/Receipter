import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { buildTrustProof, finalizeVerificationManifest } from '../src/live/trustProof.js';
import type { LiveRunReceipt } from '../src/live/types.js';

describe('trust proof model', () => {
  it('anchors a safe task with a trust decision and verification manifest', () => {
    const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'mock', TENDERBOARD_MAX_PAYMENT_USDC: '0.25' });
    const proof = buildTrustProof({
      request: {
        title: 'Find agent grants',
        instructions: 'Return public links.',
        acceptanceCriteria: ['Return at least three links.', 'Rank the best opportunity first.'],
        checkerPack: 'research',
        maxPayment: { amount: '0.05', currency: 'USDC' },
      },
      sanitizedTask: 'Task: Find agent grants\nInstructions:\nReturn public links.',
      removedLines: [],
      privateNotesProvided: true,
      config,
    });

    expect(proof.trustDecision.verdict).toBe('allow');
    expect(proof.trustDecision.tier).toBe('AA');
    expect(proof.trustDecision.reasons).toContain('Buyer-defined acceptance criteria were anchored before dispatch.');
    expect(proof.verificationManifest.checkerPack).toBe('research');
    expect(proof.verificationManifest.acceptanceCriteria).toContain('Return at least three links.');
    expect(proof.verificationManifest.specHash).toMatch(/^sha256:/);
    expect(proof.verificationManifest.requiredChecks.map((check) => check.id)).toContain('public_sources');
  });

  it('finalizes evidence checks after delivery', () => {
    const receipt = sampleReceipt();
    const finalized = finalizeVerificationManifest(receipt, 'Opportunity Scout Report');

    expect(finalized.evidenceHash).toMatch(/^sha256:/);
    expect(finalized.requiredChecks.find((check) => check.id === 'delivery_evidence')).toMatchObject({
      status: 'passed',
    });
    expect(finalized.requiredChecks.find((check) => check.id === 'reputation_signal')).toMatchObject({
      status: 'passed',
    });
  });
});

function sampleReceipt(): LiveRunReceipt {
  return {
    runId: 'run_trust',
    mode: 'mock',
    status: 'delivered',
    createdAt: '2026-06-18T18:00:00.000Z',
    updatedAt: '2026-06-18T18:00:00.000Z',
    taskTitle: 'Find agent grants',
    sanitizedTask: 'Task: Find agent grants',
    maxPayment: { amount: '0.05', currency: 'USDC' },
    trustDecision: {
      workerAgentId: 'mock_worker_service',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['No secret-looking lines were found in the public worker packet.'],
      controls: ['Payment requires explicit approval.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: undefined,
      checkerPack: 'research',
      acceptanceCriteria: ['Safe task only.'],
      requiredChecks: [
        { id: 'order_bound_approval', label: 'Order-bound approval', status: 'pending', detail: 'Waiting.' },
        { id: 'delivery_evidence', label: 'Delivery evidence', status: 'pending', detail: 'Waiting.' },
        { id: 'reputation_signal', label: 'Reputation signal', status: 'pending', detail: 'Waiting.' },
      ],
      settlementRule: 'Release after approval and delivery.',
      reputationWriteback: 'Use receipt as feedback.',
    },
    crooServiceId: 'mock_worker_service',
    negotiationId: 'neg_1',
    orderId: 'order_1',
    paymentTxHash: 'mock_tx_1',
    deliveryText: 'Opportunity Scout Report',
    error: undefined,
    events: [],
  };
}
