import { describe, expect, it } from 'vitest';
import { buildClearingObjects } from '../src/live/clearingObjects.js';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { buildTrustProof, finalizeVerificationManifest } from '../src/live/trustProof.js';
import type { LiveRunReceipt, ScoutEvidence, VerificationManifest } from '../src/live/types.js';

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
    expect(proof.verificationManifest.requiredChecks.map((check) => check.id)).toContain('walrus_evidence');
    expect(proof.verificationManifest.summary).toMatchObject({
      admissibility: 'pending',
      evidenceStrength: 'none',
      settlementEligible: false,
      reputationEligible: false,
    });
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
      status: 'pending',
      detail: 'Receipt is a reputation candidate; waiting for Sui anchor before WorkerReputationUpdated.',
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

  it('binds worker source evidence into the finalized evidence hash', () => {
    const receipt = sampleReceipt();
    const withoutEvidence = finalizeVerificationManifest(receipt, 'Opportunity Scout Report');
    const withEvidence = finalizeVerificationManifest(
      {
        ...receipt,
        workerEvidence: {
          schema: 'tenderboard.scout_evidence.v1',
          generatedAt: '2026-06-19T18:00:00.000Z',
          query: 'Sui agent grants',
          sourceReceipt: {
            schema: 'tenderboard.source_receipt.v1',
            receiptId: 'source_receipt_1',
            generatedAt: '2026-06-19T18:00:00.000Z',
            query: 'Sui agent grants',
            observations: [],
            warnings: [],
            receiptHash: 'sha256:source',
          },
          claims: [],
          evidenceHash: 'sha256:worker',
        },
      },
      'Opportunity Scout Report',
    );

    expect(withEvidence.evidenceHash).toMatch(/^sha256:/);
    expect(withEvidence.evidenceHash).not.toBe(withoutEvidence.evidenceHash);
  });

  it('blocks settlement when delivery lacks source-backed verification', () => {
    const receipt = {
      ...sampleReceipt(),
      verificationManifest: researchManifest(),
      walrusBlobId: 'walrus_dev_blob_run_trust',
      walrusBlobObjectId: '0xwalrus',
      walrusReadUrl: 'https://aggregator.example/blob',
      deliveryText: 'Opportunity Scout Report without source receipts',
    };
    const finalized = finalizeVerificationManifest(receipt, receipt.deliveryText);
    const clearing = buildClearingObjects({ ...receipt, verificationManifest: finalized });

    expect(finalized.summary).toMatchObject({
      admissibility: 'insufficient',
      evidenceStrength: 'walrus_backed',
      settlementEligible: false,
    });
    expect(finalized.summary?.blockerIds).toEqual(expect.arrayContaining(['criteria_coverage', 'public_sources']));
    expect(clearing.clearingDecision).toMatchObject({
      verdict: 'requires_review',
      verificationAdmissibility: 'insufficient',
      evidenceStrength: 'walrus_backed',
    });
    expect(clearing.settlementInstruction.action).toBe('manual_review');
  });

  it('marks source-backed Walrus evidence admissible for anchoring', () => {
    const receipt = {
      ...sampleReceipt(),
      verificationManifest: researchManifest(),
      walrusBlobId: 'walrus_dev_blob_run_trust',
      walrusBlobObjectId: '0xwalrus',
      walrusReadUrl: 'https://aggregator.example/blob',
      deliveryText: 'Opportunity Scout Report with source-backed claims',
      workerEvidence: validWorkerEvidence(),
    };
    const finalized = finalizeVerificationManifest(receipt, receipt.deliveryText);
    const clearing = buildClearingObjects({ ...receipt, verificationManifest: finalized });

    expect(finalized.requiredChecks.find((check) => check.id === 'criteria_coverage')).toMatchObject({
      status: 'passed',
    });
    expect(finalized.requiredChecks.find((check) => check.id === 'public_sources')).toMatchObject({
      status: 'passed',
    });
    expect(finalized.requiredChecks.find((check) => check.id === 'walrus_evidence')).toMatchObject({
      status: 'passed',
    });
    expect(finalized.summary).toMatchObject({
      admissibility: 'admissible',
      evidenceStrength: 'walrus_backed',
      settlementEligible: true,
      reputationEligible: false,
    });
    expect(clearing.clearingDecision).toMatchObject({
      verdict: 'ready_to_anchor',
      verificationAdmissibility: 'admissible',
      evidenceStrength: 'walrus_backed',
      blockerIds: ['reputation_signal'],
    });
    expect(clearing.settlementInstruction.action).toBe('anchor_sui_receipt');
  });

  it('requires every source claim to bind to an observation', () => {
    const receipt = {
      ...sampleReceipt(),
      verificationManifest: researchManifest(),
      walrusBlobId: 'walrus_dev_blob_run_trust',
      deliveryText: 'Opportunity Scout Report with broken source claims',
      workerEvidence: {
        ...validWorkerEvidence(),
        claims: [
          {
            claimId: 'claim_broken',
            resultIndex: 0,
            title: 'Broken claim',
            url: 'https://example.com/broken',
            sourceObservationId: 'missing_observation',
            statement: 'This claim is not bound.',
          },
        ],
      },
    };
    const finalized = finalizeVerificationManifest(receipt, receipt.deliveryText);
    const clearing = buildClearingObjects({ ...receipt, verificationManifest: finalized });

    expect(finalized.requiredChecks.find((check) => check.id === 'public_sources')).toMatchObject({
      status: 'requires_review',
      detail: '1 claim(s) are not bound to a source observation.',
    });
    expect(finalized.summary?.settlementEligible).toBe(false);
    expect(clearing.clearingDecision.verdict).toBe('requires_review');
  });
});

function researchManifest(): VerificationManifest {
  const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'sui-dev', TENDERBOARD_MAX_PAYMENT_SUI: '0.250' });
  return buildTrustProof({
    request: {
      title: 'Find Sui agent grants',
      instructions: 'Return public links.',
      acceptanceCriteria: ['Return at least three links.'],
      checkerPack: 'research',
      maxPayment: { amount: '0.050', currency: 'SUI' },
    },
    sanitizedTask: 'Task: Find Sui agent grants\nInstructions:\nReturn public links.',
    removedLines: [],
    privateNotesProvided: false,
    config,
  }).verificationManifest;
}

function validWorkerEvidence(): ScoutEvidence {
  return {
    schema: 'tenderboard.scout_evidence.v1',
    generatedAt: '2026-06-19T18:00:00.000Z',
    query: 'Sui agent grants',
    sourceReceipt: {
      schema: 'tenderboard.source_receipt.v1',
      receiptId: 'source_receipt_1',
      generatedAt: '2026-06-19T18:00:00.000Z',
      query: 'Sui agent grants',
      observations: [
        {
          observationId: 'obs_1',
          source: 'github',
          sourceLabel: 'GitHub',
          endpoint: 'https://api.github.com/search/repositories',
          query: 'Sui agent grants',
          observedAt: '2026-06-19T18:00:00.000Z',
          title: 'Sui grant opportunity',
          url: 'https://example.com/sui-grant',
          score: 100,
          publishedAt: '2026-06-18T18:00:00.000Z',
          recordHash: 'sha256:record',
          record: { title: 'Sui grant opportunity' },
        },
      ],
      warnings: [],
      receiptHash: 'sha256:source',
    },
    claims: [
      {
        claimId: 'claim_1',
        resultIndex: 0,
        title: 'Sui grant opportunity',
        url: 'https://example.com/sui-grant',
        sourceObservationId: 'obs_1',
        statement: 'Sui grant opportunity is supported by source observation obs_1.',
      },
    ],
    evidenceHash: 'sha256:worker',
  };
}

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
