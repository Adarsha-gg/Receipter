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
    expect(proof).toContain('Selected worker bid: public_scout_standard');
    expect(proof).toContain('| public_scout_standard | sui_worker | 0.035 SUI | 24h | public | available |');
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
    privacy: {
      requestedDataLabel: 'public',
      privateNotesProvided: true,
      workerDataBoundary: 'Only public task instructions and acceptance criteria may be sent to worker bidders.',
    },
    maxPayment: { amount: '0.050', currency: 'SUI' },
    workerBidBoard: {
      buyerMaxPayment: { amount: '0.050', currency: 'SUI' },
      requestedDataLabel: 'public',
      selectedBidId: 'public_scout_standard',
      bids: [
        {
          bidId: 'public_scout_standard',
          workerAgentId: 'sui_worker',
          priceSui: '0.035',
          sla: '24h',
          requestedDataLabel: 'public',
          riskFlags: [],
          verdict: 'available',
          reason: 'Bid is within the SUI budget and only asks for public worker data.',
        },
      ],
    },
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
    suiWorkOrderObjectId: '0xworkorder',
    suiEscrowObjectId: '0xescrow',
    suiPaymentDigest: '0xsui',
    suiAnchorDigest: undefined,
    walrusBlobId: 'walrus_blob_1',
    walrusBlobObjectId: '0xwalrus',
    walrusCertifiedEpoch: 10,
    walrusEndEpoch: 12,
    walrusReadUrl: 'https://aggregator.walrus.testnet.example/v1/blobs/walrus_blob_1',
    deliveryText: 'Opportunity Scout Report\nLink: https://example.com',
    error: undefined,
    events: [makeEvent({ source: 'sui', type: 'sui_dev_payment_recorded', message: 'Sui dev payment digest recorded.' })],
  };
}
