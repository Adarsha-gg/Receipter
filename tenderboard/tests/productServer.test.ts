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

describe('TenderBoard Sui product server', () => {
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

      expect(created.status).toBe('awaiting_payment_approval');
      expect(created.sanitizedTask).toContain('Write Sui launch checklist');
      expect(receiptText).not.toContain('do not send this field');
      expect(receiptText).toContain('sui_work_order_created');
      expect(receiptText).toContain('trustDecision');
      expect(receiptText).toContain('verificationManifest');
      expect(receiptText).toContain('workerBidBoard');
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
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const before = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      expect(before.suiPaymentDigest).toBeUndefined();
      expect(before.deliveryText).toBeUndefined();

      const after = await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      expect(after.status).toBe('delivered');
      expect(after.suiPaymentDigest).toContain('sui_dev_payment_');
      expect(after.deliveryText).toContain('Opportunity Scout Report');
      expect(JSON.stringify(after.events)).toContain('walrus_upload_pending');

      const withEvidence = await postJson(`${baseUrl}/api/runs/${created.runId}/store-evidence`, {});
      expect(withEvidence.status).toBe('anchoring');
      expect(withEvidence.walrusBlobId).toContain('walrus_dev_blob_');
      expect(withEvidence.walrusBlobObjectId).toMatch(/^0x/);
      expect(withEvidence.verificationManifest.evidenceHash).toMatch(/^sha256:/);

      const anchored = await postJson(`${baseUrl}/api/runs/${created.runId}/anchor-receipt`, {});
      expect(anchored.status).toBe('anchored');
      expect(anchored.suiAnchorDigest).toContain('sui_dev_anchor_');
      expect(JSON.stringify(anchored.events)).toContain('sui_dev_receipt_anchored');
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
