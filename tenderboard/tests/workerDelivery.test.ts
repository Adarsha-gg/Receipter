import { describe, expect, it } from 'vitest';
import { stableHash } from '../src/live/hash.js';
import { validateExternalWorkerDelivery, workerDeliveryPayloadHash } from '../src/live/suiRuntime.js';
import type { ExternalWorkerDeliveryPayload, LiveRunReceipt, ScoutEvidence } from '../src/live/types.js';

describe('external worker delivery validation', () => {
  it('accepts source-backed delivery bound to the selected worker and run', () => {
    const receipt = sampleReceipt();
    const sourceEvidence = validWorkerEvidence();
    const deliveryText = 'External worker completed the task with public source-backed evidence.';
    const payload: ExternalWorkerDeliveryPayload = {
      objectType: 'walrusproof.external_worker_delivery.v1',
      runId: receipt.runId,
      workerAgentId: receipt.workerAgentId,
      deliveryText,
      sourceEvidence,
      identityProof: {
        proofType: 'sui-address',
        subject: '0xworker_owner',
        publicKey: undefined,
        signature: '0xsigned',
        signedPayloadHash: workerDeliveryPayloadHash({
          runId: receipt.runId,
          workerAgentId: receipt.workerAgentId,
          deliveryText,
          sourceEvidence,
        }),
        issuedAt: '2026-06-20T12:00:00.000Z',
      },
    };

    const result = validateExternalWorkerDelivery(receipt, payload);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.delivery).toMatchObject({
      deliveryText,
      workerEvidence: sourceEvidence,
      payloadHash: payload.identityProof?.signedPayloadHash,
      identityProof: payload.identityProof,
    });
  });

  it('rejects delivery for the wrong worker or run', () => {
    const receipt = sampleReceipt();
    const payload = {
      objectType: 'walrusproof.external_worker_delivery.v1',
      runId: 'run_other',
      workerAgentId: 'sui_other_worker',
      deliveryText: 'External worker completed the task.',
      sourceEvidence: validWorkerEvidence(),
    } satisfies ExternalWorkerDeliveryPayload;

    const result = validateExternalWorkerDelivery(receipt, payload);

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('does not match receipt run run_delivery');
    expect(result.errors.join(' ')).toContain('does not match selected worker sui_worker');
  });

  it('rejects tampered source evidence hashes before receipt storage', () => {
    const receipt = sampleReceipt();
    const sourceEvidence = {
      ...validWorkerEvidence(),
      evidenceHash: 'sha256:tampered',
    };
    const result = validateExternalWorkerDelivery(receipt, {
      objectType: 'walrusproof.external_worker_delivery.v1',
      runId: receipt.runId,
      workerAgentId: receipt.workerAgentId,
      deliveryText: 'External worker completed the task.',
      sourceEvidence,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Worker evidence hash does not match its contents.');
  });

  it('rejects private notes and secret-looking fields in worker delivery', () => {
    const receipt = sampleReceipt();
    const sourceEvidence = validWorkerEvidence({
      record: {
        title: 'Sui grant opportunity',
        privateNotes: 'private strategy note',
        api_key: 'abc123',
      },
    });

    const result = validateExternalWorkerDelivery(receipt, {
      objectType: 'walrusproof.external_worker_delivery.v1',
      runId: receipt.runId,
      workerAgentId: receipt.workerAgentId,
      deliveryText: 'Completed using private notes from the buyer.',
      sourceEvidence,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Worker delivery contains secret-looking text and cannot be accepted.',
        'Worker delivery appears to include private notes and cannot be accepted.',
        expect.stringContaining('privateNotes'),
      ]),
    );
  });
});

function validWorkerEvidence(overrides: { record?: Record<string, unknown> } = {}): ScoutEvidence {
  const record = overrides.record ?? { title: 'Sui grant opportunity' };
  const observation = {
    observationId: 'obs_1',
    source: 'github' as const,
    sourceLabel: 'GitHub',
    endpoint: 'https://api.github.com/search/repositories',
    query: 'Sui agent grants',
    observedAt: '2026-06-20T12:00:00.000Z',
    title: 'Sui grant opportunity',
    url: 'https://example.com/sui-grant',
    score: 100,
    publishedAt: '2026-06-20T11:00:00.000Z',
    recordHash: stableHash(record),
    record,
  };
  const sourceReceiptBody = {
    schema: 'tenderboard.source_receipt.v1' as const,
    generatedAt: '2026-06-20T12:00:00.000Z',
    query: 'Sui agent grants',
    observations: [observation],
    warnings: [],
  };
  const sourceReceipt = {
    ...sourceReceiptBody,
    receiptId: 'source_receipt_1',
    receiptHash: stableHash(sourceReceiptBody),
  };
  const body = {
    schema: 'tenderboard.scout_evidence.v1' as const,
    generatedAt: '2026-06-20T12:00:00.000Z',
    query: 'Sui agent grants',
    sourceReceipt,
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
  };
  return {
    ...body,
    evidenceHash: stableHash(body),
  };
}

function sampleReceipt(): LiveRunReceipt {
  return {
    runId: 'run_delivery',
    mode: 'sui',
    status: 'working',
    createdAt: '2026-06-20T12:00:00.000Z',
    updatedAt: '2026-06-20T12:00:00.000Z',
    taskTitle: 'Find Sui agent grants',
    sanitizedTask: 'Task: Find Sui agent grants',
    maxPayment: { amount: '0.050', currency: 'SUI' },
    workerBidBoard: {
      buyerMaxPayment: { amount: '0.050', currency: 'SUI' },
      requestedDataLabel: 'public',
      selectedBidId: 'bid_1',
      bids: [
        {
          bidId: 'bid_1',
          workerAgentId: 'sui_worker',
          priceSui: '0.035',
          sla: '15m',
          requestedDataLabel: 'public',
          riskFlags: [],
          verdict: 'available',
          reason: 'Available.',
        },
      ],
    },
    trustDecision: {
      workerAgentId: 'sui_worker',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['Worker route is pinned to sui_worker.'],
      controls: ['Sui payment approval is bound to the exact work order before delivery.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: undefined,
      checkerPack: 'research',
      acceptanceCriteria: ['Use public sources.'],
      requiredChecks: [],
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
    suiPaymentDigest: '0xpayment',
    suiAnchorDigest: undefined,
    walrusBlobId: undefined,
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: undefined,
    error: undefined,
    events: [],
  };
}
