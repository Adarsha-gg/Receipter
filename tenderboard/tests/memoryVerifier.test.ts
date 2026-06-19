import { describe, expect, it } from 'vitest';
import { buildAgentMemoryRecord } from '../src/live/agentMemory.js';
import { stableHash } from '../src/live/hash.js';
import { makeEvent } from '../src/live/runStore.js';
import { verifyMemoryRecord } from '../src/live/memoryVerifier.js';
import { buildEvidenceBundle } from '../src/live/walrusRuntime.js';
import type { LiveRunReceipt, ScoutEvidence, SourceReceipt } from '../src/live/types.js';

describe('verifyMemoryRecord', () => {
  it('accepts a pre-anchor Walrus bundle after the local receipt is Sui-anchored', async () => {
    const preAnchorReceipt = makeReceipt('sha256:pre_anchor');
    const walrusBundle = buildEvidenceBundle(preAnchorReceipt);
    const postAnchorReceipt = {
      ...preAnchorReceipt,
      status: 'anchored' as const,
      updatedAt: '2026-06-19T00:05:00.000Z',
      suiAnchorDigest: '0xsui_anchor',
      verificationManifest: {
        ...preAnchorReceipt.verificationManifest,
        evidenceHash: 'sha256:post_anchor',
      },
      events: [
        ...preAnchorReceipt.events,
        makeEvent({
          at: '2026-06-19T00:05:00.000Z',
          source: 'sui',
          type: 'sui_receipt_anchored',
          message: 'Final receipt committed to Sui.',
          data: { evidenceHash: preAnchorReceipt.verificationManifest.evidenceHash },
        }),
      ],
    };
    postAnchorReceipt.memoryRecord = buildAgentMemoryRecord(postAnchorReceipt);

    const verification = await verifyMemoryRecord(postAnchorReceipt, async () =>
      new Response(JSON.stringify(walrusBundle), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    expect(verification.verified).toBe(true);
    expect(verification.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'source_receipt_hash', status: 'passed' }),
        expect.objectContaining({ id: 'worker_evidence_hash', status: 'passed' }),
        expect.objectContaining({ id: 'walrus_readback', status: 'passed' }),
      ]),
    );
  });
});

function makeReceipt(evidenceHash: string): LiveRunReceipt {
  const workerEvidence = makeWorkerEvidence();
  const receipt = {
    runId: 'run_memory_verify',
    mode: 'sui',
    status: 'anchoring',
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:04:00.000Z',
    taskTitle: 'Verify Walrus readback',
    sanitizedTask: 'Task: Verify Walrus readback',
    maxPayment: { amount: '0.050', currency: 'SUI' },
    trustDecision: {
      workerAgentId: 'sui_worker',
      score: 90,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['Source-backed evidence is present.'],
      controls: ['Walrus readback is required.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash,
      checkerPack: 'research',
      acceptanceCriteria: ['Store evidence on Walrus.'],
      requiredChecks: [],
      summary: {
        objectType: 'suiproof.verification_summary.v1',
        admissibility: 'admissible',
        evidenceStrength: 'walrus_backed',
        passed: 7,
        pending: 1,
        requiresReview: 0,
        blockerIds: ['reputation_signal'],
        settlementEligible: true,
        reputationEligible: false,
      },
      claimResults: [
        {
          objectType: 'suiproof.claim_verification.v1',
          claimId: 'claim_1',
          sourceObservationId: 'obs_1',
          verdict: 'supported',
          supportScore: 100,
          reasons: ['Claim is supported.'],
          sourceUrl: 'https://docs.wal.app/docs/http-api/storing-blobs',
          sourceTitle: 'Walrus HTTP API stores blobs',
          observedAt: '2026-06-19T00:01:00.000Z',
          publishedAt: '2026-06-19T00:01:00.000Z',
        },
      ],
      settlementRule: 'Anchor after Walrus storage.',
      reputationWriteback: 'Use Sui anchor for reputation.',
    },
    paymentIntentPlan: {
      objectType: 'tenderboard.payment_intent_plan.v1',
      intentId: 'payment_intent_run_memory_verify',
      paymentNonce: 'pay_nonce',
      settlementNonce: 'set_nonce',
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
      paymentUri: 'sui:pay?recipient=0xoperator',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      expiresAt: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-19T00:00:00.000Z',
    },
    receiptPlan: {
      objectType: 'tenderboard.receipt_plan.v1',
      intentId: 'payment_intent_run_memory_verify',
      paymentNonce: 'pay_nonce',
      settlementNonce: 'set_nonce',
      duplicatePreventionKey: 'testnet:payment_intent_run_memory_verify:pay_nonce:set_nonce',
      amountMist: '35000000',
      amountSui: '0.035',
      coinType: '0x2::sui::SUI',
      receiverAddress: '0xoperator',
      operatorAddress: '0xoperator',
      selectedBidId: 'public_scout_standard',
      workerAgentId: 'sui_worker',
      specHash: 'sha256:spec',
      expectedNetwork: 'testnet',
      paymentUri: 'sui:pay?recipient=0xoperator',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      paymentDigest: '0xpayment',
      walrusBlobId: 'walrus_blob_real',
      walrusBlobObjectId: '0xwalrus_object',
      walrusCertifiedEpoch: undefined,
      walrusEndEpoch: 436,
      walrusReadUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_real',
      anchorDigest: undefined,
      updatedAt: '2026-06-19T00:04:00.000Z',
    },
    workerAgentId: 'sui_worker',
    workOrderId: 'sui_work_order_run_memory_verify',
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiWorkOrderObjectId: undefined,
    suiEscrowObjectId: undefined,
    suiPaymentDigest: '0xpayment',
    suiAnchorDigest: undefined,
    walrusBlobId: 'walrus_blob_real',
    walrusBlobObjectId: '0xwalrus_object',
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: 436,
    walrusReadUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_real',
    deliveryText: 'Walrus HTTP API stores blobs.',
    workerEvidence,
    events: [],
    error: undefined,
  } satisfies LiveRunReceipt;
  return {
    ...receipt,
    memoryRecord: buildAgentMemoryRecord(receipt),
  };
}

function makeWorkerEvidence(): ScoutEvidence {
  const generatedAt = '2026-06-19T00:01:00.000Z';
  const record = {
    title: 'Walrus HTTP API stores blobs',
    url: 'https://docs.wal.app/docs/http-api/storing-blobs',
    finding: 'Walrus stores evidence bundles as blobs.',
  };
  const sourceReceiptBody = {
    schema: 'tenderboard.source_receipt.v1' as const,
    generatedAt,
    query: 'Verify Walrus readback',
    observations: [
      {
        observationId: 'obs_1',
        source: 'github' as const,
        sourceLabel: 'Walrus Docs',
        endpoint: 'https://docs.wal.app/docs/http-api/storing-blobs',
        query: 'Verify Walrus readback',
        observedAt: generatedAt,
        title: record.title,
        url: record.url,
        score: 100,
        publishedAt: generatedAt,
        recordHash: stableHash(record),
        record,
      },
    ],
    warnings: [],
  };
  const sourceReceipt: SourceReceipt = {
    ...sourceReceiptBody,
    receiptId: 'source_receipt_1',
    receiptHash: stableHash(sourceReceiptBody),
  };
  const body = {
    schema: 'tenderboard.scout_evidence.v1' as const,
    generatedAt,
    query: 'Verify Walrus readback',
    sourceReceipt,
    claims: [
      {
        claimId: 'claim_1',
        resultIndex: 1,
        title: record.title,
        url: record.url,
        sourceObservationId: 'obs_1',
        statement: 'Walrus HTTP API stores blobs as evidence bundles.',
      },
    ],
  };
  return {
    ...body,
    evidenceHash: stableHash(body),
  };
}
