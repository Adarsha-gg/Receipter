import { describe, expect, it } from 'vitest';
import { buildClearingObjects } from '../src/live/clearingObjects.js';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { buildTrustProof, finalizeVerificationManifest } from '../src/live/trustProof.js';
import type { LiveRunReceipt } from '../src/live/types.js';

describe('trust proof model', () => {
  it('anchors a safe task with a Sui trust decision and verification manifest', () => {
    const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'sui-dev', TENDERBOARD_MAX_PAYMENT_SUI: '0.250' });
    const proof = buildTrustProof({
      request: {
        title: 'Find Sui agent grants',
        instructions: 'Return public links.',
        acceptanceCriteria: ['Return at least three links.', 'Rank the best opportunity first.'],
        checkerPack: 'research',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      },
      sanitizedTask: 'Task: Find Sui agent grants\nInstructions:\nReturn public links.',
      removedLines: [],
      privateNotesProvided: true,
      config,
    });

    expect(proof.trustDecision.verdict).toBe('allow');
    expect(proof.trustDecision.tier).toBe('AA');
    expect(proof.trustDecision.reasons).toContain('Buyer-defined acceptance criteria were anchored before dispatch.');
    expect(proof.trustDecision.controls).toContain('Final evidence must produce a Walrus blob id before Sui anchoring.');
    expect(proof.verificationManifest.checkerPack).toBe('research');
    expect(proof.verificationManifest.acceptanceCriteria).toContain('Payment requires a Sui work order id and explicit operator approval.');
    expect(proof.verificationManifest.specHash).toMatch(/^sha256:/);
    expect(proof.verificationManifest.requiredChecks.map((check) => check.id)).toContain('public_sources');
  });

  it('finalizes Sui evidence checks after delivery', () => {
    const receipt = sampleReceipt();
    const finalized = finalizeVerificationManifest(receipt, 'Opportunity Scout Report');
    const clearing = buildClearingObjects({ ...receipt, verificationManifest: finalized });

    expect(finalized.evidenceHash).toMatch(/^sha256:/);
    expect(finalized.requiredChecks.find((check) => check.id === 'delivery_evidence')).toMatchObject({
      status: 'passed',
    });
    expect(finalized.requiredChecks.find((check) => check.id === 'reputation_signal')).toMatchObject({
      status: 'passed',
    });
    expect(finalized.requiredChecks.find((check) => check.id === 'order_bound_approval')).toMatchObject({
      status: 'passed',
    });
    expect(clearing.obligationObject).toMatchObject({
      taskTitle: 'Find Sui agent grants',
      specHash: 'sha256:spec',
      requestedDataLabel: 'public',
    });
    expect(clearing.evidenceEnvelope).toMatchObject({
      evidenceHash: finalized.evidenceHash,
      deliveryPresent: true,
      walrusReady: false,
    });
    expect(clearing.clearingDecision).toMatchObject({
      verdict: 'pending_walrus',
      evidenceHash: finalized.evidenceHash,
      walrusReady: false,
    });
    expect(clearing.settlementInstruction).toMatchObject({
      action: 'store_walrus_evidence',
      selectedBidId: undefined,
    });
  });
});

function sampleReceipt(): LiveRunReceipt {
  return {
    runId: 'run_trust',
    mode: 'sui-dev',
    status: 'delivered',
    createdAt: '2026-06-19T18:00:00.000Z',
    updatedAt: '2026-06-19T18:00:00.000Z',
    taskTitle: 'Find Sui agent grants',
    sanitizedTask: 'Task: Find Sui agent grants',
    privacy: {
      requestedDataLabel: 'public',
      privateNotesProvided: false,
      workerDataBoundary: 'Only public task instructions and acceptance criteria may be sent to worker bidders.',
    },
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
      evidenceHash: undefined,
      checkerPack: 'research',
      acceptanceCriteria: ['Safe task only.'],
      requiredChecks: [
        { id: 'order_bound_approval', label: 'Sui work-order approval', status: 'pending', detail: 'Waiting.' },
        { id: 'delivery_evidence', label: 'Delivery evidence', status: 'pending', detail: 'Waiting.' },
        { id: 'reputation_signal', label: 'Reputation signal', status: 'pending', detail: 'Waiting.' },
      ],
      settlementRule: 'Release after Sui approval and delivery.',
      reputationWriteback: 'Use receipt as Sui feedback.',
    },
    workerAgentId: 'sui_worker',
    workOrderId: 'sui_work_order_1',
    suiNetwork: 'testnet',
    suiPackageId: undefined,
    suiReceiptRegistryId: undefined,
    suiWorkOrderObjectId: '0xworkorder',
    suiEscrowObjectId: '0xescrow',
    suiPaymentDigest: 'sui_dev_payment_1',
    suiAnchorDigest: undefined,
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: 'Opportunity Scout Report',
    error: undefined,
    events: [],
  };
}
