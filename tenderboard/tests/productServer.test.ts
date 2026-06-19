import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { RunStore } from '../src/live/runStore.js';
import { createTenderBoardServer } from '../src/server/httpServer.js';
import { fakeScoutFetch } from './helpers/fakeScoutFetch.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tenderboard-server-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('SuiProof Market product server', () => {
  it('serves Sui readiness without exposing private env values', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      PRIVATE_KEY: 'do_not_leak',
    });

    try {
      const response = await fetch(`${baseUrl}/api/config`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toContain('readyForSui');
      expect(text).toContain('packageIdConfigured');
      expect(text).not.toContain('do_not_leak');
    } finally {
      await close();
    }
  });

  it('creates a Sui work order without storing private notes', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Write Sui launch checklist',
        instructions: 'Make it useful.',
        acceptanceCriteria: ['Return three concrete Sui launch steps.', 'Include owner and risk for each step.'],
        checkerPack: 'research',
        requestedDataLabel: 'public',
        privateNotes: 'do not send this field to the worker',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const receiptResponse = await fetch(`${baseUrl}/api/runs/${created.runId}`);
      const receiptText = await receiptResponse.text();
      const receipt = JSON.parse(receiptText);

      expect(created.status).toBe('awaiting_payment_approval');
      expect(created.sanitizedTask).toContain('Write Sui launch checklist');
      expect(receiptText).not.toContain('do not send this field');
      expect(receiptText).toContain('sui_work_order_created');
      expect(receipt.paymentIntentPlan).toMatchObject({
        intentId: `payment_intent_${created.runId}`,
        amountMist: '35000000',
        amountSui: '0.035',
        coinType: '0x2::sui::SUI',
        receiverAddress: '<SUI_OPERATOR_ADDRESS>',
        expectedNetwork: 'testnet',
        paymentKitMode: 'sui_pay_uri_metadata_only',
        paymentKitCompatibility: 'sui:pay-uri-v1',
      });
      expect(receipt.paymentIntentPlan.paymentUri).toContain('sui:pay?');
      expect(receipt.paymentIntentPlan.paymentUri).toContain('amountMist=35000000');
      expect(receipt.paymentIntentPlan.paymentUri).toContain('coinType=0x2%3A%3Asui%3A%3ASUI');
      expect(receipt.paymentIntentPlan.paymentUri).toContain(`nonce=${receipt.paymentIntentPlan.paymentNonce}`);
      expect(receipt.paymentIntentPlan.paymentUri).toContain('label=SuiProof+Market');
      expect(receipt.paymentIntentPlan.paymentUri).toContain('message=SuiProof+Market+agent+work+payment');
      expect(receipt.paymentIntentPlan.paymentUri).toContain(`runId=${created.runId}`);
      expect(receipt.paymentIntentPlan.paymentUri).toContain('selectedBidId=public_scout_standard');
      expect(receipt.paymentIntentPlan.paymentUri).not.toContain('Make%20it%20useful');
      expect(receipt.paymentIntentPlan.paymentUri).not.toContain('do_not_leak');
      expect(receipt.paymentIntentPlan.paymentNonce).toMatch(/^pay_[0-9a-f]{32}$/);
      expect(receipt.paymentIntentPlan.paymentNonce.length).toBeLessThanOrEqual(36);
      expect(receipt.paymentIntentPlan.settlementNonce).toMatch(/^set_[0-9a-f]{32}$/);
      expect(receipt.paymentIntentPlan.settlementNonce.length).toBeLessThanOrEqual(36);
      expect(receipt.receiptPlan).toMatchObject({
        intentId: receipt.paymentIntentPlan.intentId,
        paymentNonce: receipt.paymentIntentPlan.paymentNonce,
        settlementNonce: receipt.paymentIntentPlan.settlementNonce,
        amountMist: '35000000',
        selectedBidId: 'public_scout_standard',
        paymentUri: receipt.paymentIntentPlan.paymentUri,
        paymentKitMode: 'sui_pay_uri_metadata_only',
      });
      expect(receipt.receiptPlan.paymentDigest).toBeUndefined();
      expect(receipt.reputationSnapshot).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        anchoredRunCount: 0,
        walrusEvidenceCount: 0,
      });
      expect(receipt.hirerAgent).toMatchObject({
        role: 'hirer',
        displayName: 'Sui Hirer Agent',
        budgetSui: '0.050',
      });
      expect(receipt.workerAgent).toMatchObject({
        role: 'worker',
        displayName: 'Opportunity Scout Worker',
        priceSui: '0.035',
      });
      expect(receipt.agentHandoff).toMatchObject({
        hirerAgentId: receipt.hirerAgent.agentId,
        workerAgentId: receipt.workerAgent.agentId,
        selectedBidId: 'public_scout_standard',
        paymentIntentId: receipt.paymentIntentPlan.intentId,
        status: 'awaiting_payment',
      });
      expect(receiptText).toContain('trustDecision');
      expect(receiptText).toContain('verificationManifest');
      expect(receiptText).toContain('workerBidBoard');
      expect(receiptText).toContain('obligationObject');
      expect(receiptText).toContain('evidenceEnvelope');
      expect(receiptText).toContain('clearingDecision');
      expect(receiptText).toContain('settlementInstruction');
      expect(receiptText).toContain('public_sources');
    } finally {
      await close();
    }
  });

  it('makes safe worker bids available and blocks over-budget and unsafe-data bids', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Source Sui builder opportunities',
        instructions: 'Use public sources only.',
        requestedDataLabel: 'public',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      const bids = receipt.workerBidBoard.bids;

      expect(receipt.privacy).toMatchObject({
        requestedDataLabel: 'public',
        privateNotesProvided: false,
      });
      expect(receipt.workerBidBoard.selectedBidId).toBe('public_scout_standard');
      expect(receipt.obligationObject.selectedBid).toMatchObject({
        bidId: 'public_scout_standard',
        requestedDataLabel: 'public',
      });
      expect(receipt.obligationObject.acceptanceCriteria).toContain('Worker must only receive the sanitized task packet.');
      expect(receipt.evidenceEnvelope).toMatchObject({
        deliveryPresent: false,
        walrusReady: false,
        requestedDataLabel: 'public',
      });
      expect(receipt.clearingDecision).toMatchObject({
        verdict: 'pending_delivery',
        walrusReady: false,
      });
      expect(receipt.settlementInstruction).toMatchObject({
        action: 'hold_payment',
        selectedBidId: 'public_scout_standard',
      });
      expect(bids.find((bid: any) => bid.bidId === 'public_scout_standard')).toMatchObject({
        priceSui: '0.035',
        requestedDataLabel: 'public',
        verdict: 'available',
      });
      expect(bids.find((bid: any) => bid.bidId === 'public_scout_expedited')).toMatchObject({
        priceSui: '0.075',
        verdict: 'blocked',
      });
      expect(bids.find((bid: any) => bid.bidId === 'public_scout_expedited').riskFlags).toContain('over_budget');
      expect(bids.find((bid: any) => bid.bidId === 'context_scout_private')).toMatchObject({
        requestedDataLabel: 'buyer_private',
        verdict: 'blocked',
      });
      expect(bids.find((bid: any) => bid.bidId === 'context_scout_private').riskFlags).toContain('unsafe_data_request');
    } finally {
      await close();
    }
  });

  it('blocks worker sourcing when the buyer labels the task data unsafe for workers', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const response = await fetch(`${baseUrl}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Use private CRM notes',
          instructions: 'Summarize private buyer notes.',
          requestedDataLabel: 'buyer_private',
          maxPayment: { amount: '0.050', currency: 'SUI' },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('No safe worker bid is available');
      expect(body.error).toContain('buyer-private');
    } finally {
      await close();
    }
  });

  it('requires approval, stores Walrus evidence, and anchors a Sui dev receipt', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Find Sui ecosystem opportunities',
        instructions: 'Make it useful.',
        privateNotes: 'private strategy note: do not send this field',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const before = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      expect(before.suiPaymentDigest).toBeUndefined();
      expect(before.deliveryText).toBeUndefined();
      expect(before.reputationSnapshot.anchoredRunCount).toBe(0);
      expect(before.paymentIntentPlan.paymentNonce).toMatch(/^pay_[0-9a-f]{32}$/);
      expect(before.paymentIntentPlan.paymentNonce.length).toBeLessThanOrEqual(36);
      expect(before.paymentIntentPlan.settlementNonce).toMatch(/^set_[0-9a-f]{32}$/);
      expect(before.paymentIntentPlan.settlementNonce.length).toBeLessThanOrEqual(36);
      expect(before.paymentIntentPlan.amountMist).toBe('35000000');
      expect(before.receiptPlan.paymentDigest).toBeUndefined();
      expect(before.agentHandoff.status).toBe('awaiting_payment');

      const unpaidWorkerTaskResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-task`);
      const unpaidWorkerTask = await unpaidWorkerTaskResponse.json();
      expect(unpaidWorkerTaskResponse.status).toBe(402);
      expect(unpaidWorkerTaskResponse.headers.get('x-payment-protocol')).toBe('x402');
      expect(unpaidWorkerTask).toMatchObject({
        objectType: 'suiproof.x402_sui_payment_challenge.v1',
        x402Version: 1,
        error: 'X402_PAYMENT_REQUIRED',
        settlement: 'sui-payment-kit',
        intentModel: 'sui-payment-intent',
      });
      expect(unpaidWorkerTask.accepts[0]).toMatchObject({
        scheme: 'sui-payment-kit',
        network: 'sui:testnet',
        maxAmountRequired: '35000000',
        resource: `/api/runs/${created.runId}/worker-task`,
        payTo: '<SUI_OPERATOR_ADDRESS>',
        asset: '0x2::sui::SUI',
        extra: {
          paymentUri: before.paymentIntentPlan.paymentUri,
          paymentIntentId: before.paymentIntentPlan.intentId,
          paymentNonce: before.paymentIntentPlan.paymentNonce,
          settlementNonce: before.paymentIntentPlan.settlementNonce,
          workerAgentId: 'sui_opportunity_scout',
          runId: created.runId,
        },
      });
      expect(JSON.stringify(unpaidWorkerTask)).not.toContain('private strategy note');

      const after = await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      expect(after.status).toBe('working');
      expect(after.agentHandoff.status).toBe('working');
      expect(after.reputationSnapshot.anchoredRunCount).toBe(0);
      expect(after.suiPaymentDigest).toContain('sui_dev_payment_');
      expect(after.receiptPlan.paymentDigest).toBe(after.suiPaymentDigest);
      expect(after.deliveryText).toBeUndefined();
      expect(JSON.stringify(after.events)).toContain('worker_task_available');

      const paidWorkerTaskResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-task`);
      const paidWorkerTask = await paidWorkerTaskResponse.json();
      const xPaymentResponse = JSON.parse(paidWorkerTaskResponse.headers.get('x-payment-response') ?? '{}');
      expect(paidWorkerTaskResponse.status).toBe(200);
      expect(paidWorkerTaskResponse.headers.get('x-payment-protocol')).toBe('x402');
      expect(xPaymentResponse).toMatchObject({
        objectType: 'suiproof.x402_sui_payment_response.v1',
        x402Version: 1,
        settlement: 'sui-payment-kit',
        network: 'sui:testnet',
        transaction: after.suiPaymentDigest,
        paymentIntentId: before.paymentIntentPlan.intentId,
        paymentNonce: before.paymentIntentPlan.paymentNonce,
      });
      expect(paidWorkerTask).toMatchObject({
        runId: created.runId,
        status: 'working',
        sanitizedTask: expect.stringContaining('Find Sui ecosystem opportunities'),
        agentHandoff: {
          status: 'working',
        },
      });
      expect(JSON.stringify(paidWorkerTask)).not.toContain('private strategy note');

      const handoff = await (await fetch(`${baseUrl}/api/runs/${created.runId}/agent-handoff`)).json();
      expect(handoff.agentHandoff).toMatchObject({
        hirerAgentId: after.hirerAgent.agentId,
        workerAgentId: after.workerAgent.agentId,
        status: 'working',
      });

      const delivered = await postJson(`${baseUrl}/api/runs/${created.runId}/worker-delivery`, {});
      expect(delivered.status).toBe('delivered');
      expect(delivered.agentHandoff.status).toBe('ready_to_anchor');
      expect(delivered.deliveryText).toContain('Opportunity Scout Report');
      expect(delivered.workerEvidence).toMatchObject({
        schema: 'tenderboard.scout_evidence.v1',
        query: expect.any(String),
        sourceReceipt: {
          schema: 'tenderboard.source_receipt.v1',
        },
      });
      expect(delivered.workerEvidence.sourceReceipt.observations.length).toBeGreaterThan(0);
      expect(delivered.workerEvidence.claims.length).toBeGreaterThan(0);
      const observationIds = new Set(delivered.workerEvidence.sourceReceipt.observations.map((observation: any) => observation.observationId));
      expect(delivered.workerEvidence.claims.every((claim: any) => observationIds.has(claim.sourceObservationId))).toBe(true);
      expect(JSON.stringify(delivered)).not.toContain('private strategy note');
      expect(delivered.evidenceEnvelope).toMatchObject({
        deliveryPresent: true,
        walrusReady: false,
      });
      expect(delivered.evidenceEnvelope.evidenceHash).toMatch(/^sha256:/);
      expect(delivered.clearingDecision).toMatchObject({
        verdict: 'pending_walrus',
        walrusReady: false,
      });
      expect(delivered.settlementInstruction.action).toBe('store_walrus_evidence');
      expect(JSON.stringify(delivered.events)).toContain('walrus_upload_pending');

      const withEvidence = await postJson(`${baseUrl}/api/runs/${created.runId}/store-evidence`, {});
      expect(withEvidence.status).toBe('anchoring');
      expect(withEvidence.agentHandoff.status).toBe('ready_to_anchor');
      expect(withEvidence.reputationSnapshot.anchoredRunCount).toBe(0);
      expect(withEvidence.walrusBlobId).toContain('walrus_dev_blob_');
      expect(withEvidence.walrusBlobObjectId).toMatch(/^0x/);
      expect(withEvidence.receiptPlan).toMatchObject({
        paymentNonce: before.paymentIntentPlan.paymentNonce,
        settlementNonce: before.paymentIntentPlan.settlementNonce,
        walrusBlobId: withEvidence.walrusBlobId,
        walrusBlobObjectId: withEvidence.walrusBlobObjectId,
      });
      expect(withEvidence.verificationManifest.evidenceHash).toMatch(/^sha256:/);
      expect(withEvidence.evidenceEnvelope).toMatchObject({
        evidenceHash: withEvidence.verificationManifest.evidenceHash,
        walrusReady: true,
        walrusBlobId: withEvidence.walrusBlobId,
      });
      expect(withEvidence.clearingDecision).toMatchObject({
        verdict: 'ready_to_anchor',
        walrusReady: true,
      });
      expect(withEvidence.settlementInstruction.action).toBe('anchor_sui_receipt');

      const anchored = await postJson(`${baseUrl}/api/runs/${created.runId}/anchor-receipt`, {});
      expect(anchored.status).toBe('anchored');
      expect(anchored.agentHandoff.status).toBe('anchored');
      expect(anchored.suiAnchorDigest).toContain('sui_dev_anchor_');
      expect(anchored.receiptPlan.anchorDigest).toBe(anchored.suiAnchorDigest);
      expect(anchored.reputationSnapshot).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        anchoredRunCount: 1,
        walrusEvidenceCount: 1,
        sourceEvidenceCount: expect.any(Number),
        totalMistEarned: '35000000',
        lastAnchoredRunId: created.runId,
        lastWalrusBlobId: anchored.walrusBlobId,
        lastEvidenceHash: anchored.verificationManifest.evidenceHash,
      });
      expect(anchored.verificationManifest.requiredChecks.find((check: any) => check.id === 'reputation_signal')).toMatchObject({
        status: 'passed',
      });
      expect(anchored.clearingDecision.verdict).toBe('anchored');
      expect(anchored.settlementInstruction).toMatchObject({
        action: 'record_settlement',
        suiAnchorDigest: anchored.suiAnchorDigest,
      });
      expect(JSON.stringify(anchored.events)).toContain('sui_dev_receipt_anchored');
      expect(JSON.stringify(anchored.events)).toContain('worker_reputation_updated');

      const second = await postJson(`${baseUrl}/api/runs`, {
        title: 'Find another Sui ecosystem opportunity',
        instructions: 'Use public sources only.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });
      const secondReceipt = await (await fetch(`${baseUrl}/api/runs/${second.runId}`)).json();
      expect(secondReceipt.reputationSnapshot).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        anchoredRunCount: 1,
        walrusEvidenceCount: 1,
        lastAnchoredRunId: created.runId,
      });

      const runs = await (await fetch(`${baseUrl}/api/runs`)).json();
      expect(runs.find((run: any) => run.runId === created.runId).reputationSnapshot.anchoredRunCount).toBe(1);
    } finally {
      await close();
    }
  });

  it('requires a payment digest before approval in Sui mode', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Require real digest',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const response = await fetch(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Sui mode requires suiPaymentDigest');
    } finally {
      await close();
    }
  });

  it('lists runs and serves downloadable Sui receipt JSON', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Run history task',
        instructions: 'Make it useful.',
        privateNotes: 'do not send this field',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const runs = await (await fetch(`${baseUrl}/api/runs`)).json();
      expect(runs[0]).toMatchObject({ runId: created.runId, taskTitle: 'Run history task' });
      expect(JSON.stringify(runs)).not.toContain('do not send this field');

      const receiptResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/receipt`);
      const receiptText = await receiptResponse.text();
      expect(receiptResponse.headers.get('content-disposition')).toContain(`${created.runId}.json`);
      expect(receiptText).toContain(created.runId);
      expect(receiptText).toContain('suiNetwork');
      expect(receiptText).not.toContain('do not send this field');
    } finally {
      await close();
    }
  });
});

async function startTestServer(env: NodeJS.ProcessEnv): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const config = loadTenderBoardConfig(env);
  const store = new RunStore(config.receiptsDir);
  const server = createTenderBoardServer({ config, store, scoutFetch: fakeScoutFetch as typeof fetch });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json));
  return json;
}
