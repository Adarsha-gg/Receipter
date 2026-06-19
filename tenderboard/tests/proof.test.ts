import { describe, expect, it } from 'vitest';
import { buildClearingObjects } from '../src/live/clearingObjects.js';
import { renderReceiptProof } from '../src/live/proof.js';
import { makeEvent } from '../src/live/runStore.js';
import { buildEvidenceBundle } from '../src/live/walrusRuntime.js';
import type { LiveRunReceipt } from '../src/live/types.js';

describe('renderReceiptProof', () => {
  it('renders a judge-readable Sui proof without private notes', () => {
    const proof = renderReceiptProof(sampleReceipt());

    expect(proof).toContain('# SuiProof Market Run Proof: run_proof');
    expect(proof).toContain('Sui payment digest: 0xsui');
    expect(proof).toContain('Walrus blob id: walrus_blob_1');
    expect(proof).toContain('Payment nonce: payment_nonce_proof');
    expect(proof).toContain('Payment URI: sui:pay?');
    expect(proof).toContain('PaymentKit mode: sui_pay_uri_metadata_only');
    expect(proof).toContain('Settlement nonce: settlement_nonce_proof');
    expect(proof).toContain('Amount MIST: 35000000');
    expect(proof).toContain('Trust verdict: allow');
    expect(proof).toContain('Selected worker bid: public_scout_standard');
    expect(proof).toContain('| public_scout_standard | sui_worker | 0.035 SUI | 24h | public | available |');
    expect(proof).toContain('## Market agents');
    expect(proof).toContain('Hirer agent: Sui Hirer Agent');
    expect(proof).toContain('Worker agent: Opportunity Scout Worker');
    expect(proof).toContain('Handoff status: ready_to_anchor');
    expect(proof).toContain('## Clearing objects');
    expect(proof).toContain('## Worker Reputation Passport');
    expect(proof).toContain('Anchored runs: 2');
    expect(proof).toContain('Last Walrus blob: walrus_blob_previous');
    expect(proof).toContain('Clearing verdict: ready_to_anchor');
    expect(proof).toContain('Settlement action: anchor_sui_receipt');
    expect(proof).toContain('Bound selected bid: public_scout_standard');
    expect(proof).toContain('Walrus ready: yes');
    expect(proof).toContain('Checker pack: research');
    expect(proof).toContain('Safe task only.');
    expect(proof).toContain('Spec hash: sha256:spec');
    expect(proof).toContain('Opportunity Scout Report');
    expect(proof).toContain('Source receipt: source_receipt_proof');
    expect(proof).toContain('source_hn_1');
    expect(proof).not.toContain('private strategy note');
  });

  it('includes formal clearing objects in the Walrus evidence bundle', () => {
    const bundle = buildEvidenceBundle(sampleReceipt());

    expect(bundle.paymentIntentPlan).toMatchObject({
      paymentNonce: 'payment_nonce_proof',
      settlementNonce: 'settlement_nonce_proof',
      amountMist: '35000000',
    });
    expect(bundle.receiptPlan).toMatchObject({
      paymentDigest: '0xsui',
      walrusBlobId: 'walrus_blob_1',
    });
    expect(bundle.reputationSnapshot).toMatchObject({
      workerAgentId: 'sui_worker',
      anchoredRunCount: 2,
      walrusEvidenceCount: 2,
    });
    expect(bundle.agents.agentHandoff).toMatchObject({
      hirerAgentId: 'sui_hirer.governed.buyer',
      workerAgentId: 'sui_worker',
      status: 'ready_to_anchor',
    });
    expect(bundle.clearingObjects.obligationObject?.selectedBid?.bidId).toBe('public_scout_standard');
    expect(bundle.clearingObjects.evidenceEnvelope).toMatchObject({
      evidenceHash: 'sha256:evidence',
      walrusReady: true,
      walrusBlobId: 'walrus_blob_1',
    });
    expect(bundle.clearingObjects.clearingDecision).toMatchObject({
      verdict: 'ready_to_anchor',
      walrusReady: true,
    });
    expect(bundle.clearingObjects.settlementInstruction).toMatchObject({
      action: 'anchor_sui_receipt',
      selectedBidId: 'public_scout_standard',
    });
    expect(bundle.workerEvidence?.sourceReceipt.observations[0]).toMatchObject({
      observationId: 'source_hn_1',
      source: 'hacker_news',
      record: {
        title: 'Public opportunity',
        url: 'https://example.com',
      },
    });
    expect(bundle.workerEvidence?.claims[0]?.sourceObservationId).toBe('source_hn_1');
  });
});

function sampleReceipt(): LiveRunReceipt {
  const receipt: LiveRunReceipt = {
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
    hirerAgent: {
      objectType: 'suiproof.market_agent.v1',
      agentId: 'sui_hirer.governed.buyer',
      role: 'hirer',
      displayName: 'Sui Hirer Agent',
      responsibilities: ['Define the job.', 'Publish only safe packet.', 'Approve proof-gated payment.'],
      controls: ['Private notes stay local.', 'Bids must fit budget.', 'Reputation waits for anchor.'],
      budgetSui: '0.050',
      priceSui: undefined,
      requestedDataLabel: 'public',
    },
    workerAgent: {
      objectType: 'suiproof.market_agent.v1',
      agentId: 'sui_worker',
      role: 'worker',
      displayName: 'Opportunity Scout Worker',
      responsibilities: ['Bid on the task.', 'Return public-source evidence.', 'Produce source receipts.'],
      controls: ['Sanitized task only.', 'No buyer-private data.', 'Receipt-bound payment.'],
      budgetSui: undefined,
      priceSui: '0.035',
      requestedDataLabel: 'public',
    },
    agentHandoff: {
      objectType: 'suiproof.agent_handoff.v1',
      handoffId: 'handoff_proof',
      hirerAgentId: 'sui_hirer.governed.buyer',
      workerAgentId: 'sui_worker',
      selectedBidId: 'public_scout_standard',
      safePacketHash: 'sha256:safe_packet',
      specHash: 'sha256:spec',
      paymentIntentId: 'payment_intent_run_proof',
      status: 'ready_to_anchor',
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
    paymentIntentPlan: {
      objectType: 'tenderboard.payment_intent_plan.v1',
      intentId: 'payment_intent_run_proof',
      paymentNonce: 'payment_nonce_proof',
      settlementNonce: 'settlement_nonce_proof',
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
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000&coinType=0x2%3A%3Asui%3A%3ASUI&paymentNonce=payment_nonce_proof&network=testnet&runId=run_proof',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      expiresAt: '2026-06-20T20:00:00.000Z',
      createdAt: '2026-06-19T20:00:00.000Z',
    },
    receiptPlan: {
      objectType: 'tenderboard.receipt_plan.v1',
      intentId: 'payment_intent_run_proof',
      paymentNonce: 'payment_nonce_proof',
      settlementNonce: 'settlement_nonce_proof',
      duplicatePreventionKey: 'testnet:payment_intent_run_proof:payment_nonce_proof:settlement_nonce_proof',
      amountMist: '35000000',
      amountSui: '0.035',
      coinType: '0x2::sui::SUI',
      receiverAddress: '0xoperator',
      operatorAddress: '0xoperator',
      selectedBidId: 'public_scout_standard',
      workerAgentId: 'sui_worker',
      specHash: 'sha256:spec',
      expectedNetwork: 'testnet',
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000&coinType=0x2%3A%3Asui%3A%3ASUI&paymentNonce=payment_nonce_proof&network=testnet&runId=run_proof',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      paymentDigest: '0xsui',
      walrusBlobId: 'walrus_blob_1',
      walrusBlobObjectId: '0xwalrus',
      walrusCertifiedEpoch: 10,
      walrusEndEpoch: 12,
      walrusReadUrl: 'https://aggregator.walrus.testnet.example/v1/blobs/walrus_blob_1',
      anchorDigest: undefined,
      updatedAt: '2026-06-19T20:05:00.000Z',
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
    reputationSnapshot: {
      objectType: 'tenderboard.worker_reputation_passport.v1',
      workerAgentId: 'sui_worker',
      generatedAt: '2026-06-19T20:05:00.000Z',
      anchoredRunCount: 2,
      walrusEvidenceCount: 2,
      sourceEvidenceCount: 4,
      averageTrustScore: 90.5,
      tierCounts: { AAA: 0, AA: 2, A: 0, B: 0, C: 0 },
      totalMistEarned: '70000000',
      totalSuiEarned: '0.07',
      lastAnchoredRunId: 'run_previous',
      lastAnchoredAt: '2026-06-19T19:00:00.000Z',
      lastWalrusBlobId: 'walrus_blob_previous',
      lastEvidenceHash: 'sha256:previous',
      lastAnchorDigest: '0xprevious_anchor',
    },
    deliveryText: 'Opportunity Scout Report\nLink: https://example.com',
    workerEvidence: {
      schema: 'tenderboard.scout_evidence.v1',
      generatedAt: '2026-06-19T20:04:00.000Z',
      query: 'Find opportunities',
      sourceReceipt: {
        schema: 'tenderboard.source_receipt.v1',
        receiptId: 'source_receipt_proof',
        generatedAt: '2026-06-19T20:04:00.000Z',
        query: 'Find opportunities',
        observations: [
          {
            observationId: 'source_hn_1',
            source: 'hacker_news',
            sourceLabel: 'Hacker News',
            endpoint: 'https://hn.algolia.com/api/v1/search?query=Find%20opportunities&tags=story',
            query: 'Find opportunities',
            observedAt: '2026-06-19T20:04:00.000Z',
            title: 'Public opportunity',
            url: 'https://example.com',
            score: 10,
            publishedAt: '2026-06-18T00:00:00.000Z',
            recordHash: 'sha256:record',
            record: {
              title: 'Public opportunity',
              url: 'https://example.com',
              points: 10,
            },
          },
        ],
        warnings: [],
        receiptHash: 'sha256:source_receipt',
      },
      claims: [
        {
          claimId: 'claim_1_source_hn_1',
          resultIndex: 1,
          title: 'Public opportunity',
          url: 'https://example.com',
          sourceObservationId: 'source_hn_1',
          statement: 'Hacker News result "Public opportunity" was used in the rendered Opportunity Scout report.',
        },
      ],
      evidenceHash: 'sha256:worker_evidence',
    },
    error: undefined,
    events: [makeEvent({ source: 'sui', type: 'sui_dev_payment_recorded', message: 'Sui dev payment digest recorded.' })],
  };
  return {
    ...receipt,
    ...buildClearingObjects(receipt),
  };
}
