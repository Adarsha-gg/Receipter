import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import { RunStore } from '../src/live/runStore.js';
import type { LiveRunReceipt } from '../src/live/types.js';
import { createTenderBoardServer, type LiveRuntime } from '../src/server/httpServer.js';
import { fakeScoutFetch } from './helpers/fakeScoutFetch.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tenderboard-server-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('TenderBoard product server', () => {
  it('serves safe config and does not expose SDK keys', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'live',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      CROO_API_URL: 'https://api.croo.network',
      CROO_WS_URL: 'wss://api.croo.network/ws',
      CROO_REQUESTER_SDK_KEY: 'croo_sk_requester_secret',
      CROO_WORKER_SDK_KEY: 'croo_sk_worker_secret',
      CROO_WORKER_SERVICE_ID: 'svc_worker',
    });

    try {
      const response = await fetch(`${baseUrl}/api/config`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toContain('readyForLive');
      expect(text).not.toContain('croo_sk_requester_secret');
      expect(text).not.toContain('croo_sk_worker_secret');
    } finally {
      await close();
    }
  });

  it('creates a run without storing private notes', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'mock',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Write launch checklist',
        instructions: 'Make it useful.',
        privateNotes: 'do not send this field to the worker',
        maxPayment: { amount: '0.05', currency: 'USDC' },
      });

      const receiptResponse = await fetch(`${baseUrl}/api/runs/${created.runId}`);
      const receiptText = await receiptResponse.text();

      expect(created.status).toBe('awaiting_payment_approval');
      expect(created.sanitizedTask).toContain('Write launch checklist');
      expect(receiptText).not.toContain('do not send this field');
      expect(receiptText).toContain('negotiation_created');
    } finally {
      await close();
    }
  });

  it('lists runs and serves downloadable receipt JSON', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'mock',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Run history task',
        instructions: 'Make it useful.',
        privateNotes: 'do not send this field',
        maxPayment: { amount: '0.05', currency: 'USDC' },
      });

      const runs = await (await fetch(`${baseUrl}/api/runs`)).json();
      expect(runs[0]).toMatchObject({ runId: created.runId, taskTitle: 'Run history task' });
      expect(JSON.stringify(runs)).not.toContain('do not send this field');

      const receiptResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/receipt`);
      const receiptText = await receiptResponse.text();
      expect(receiptResponse.headers.get('content-disposition')).toContain(`${created.runId}.json`);
      expect(receiptText).toContain(created.runId);
      expect(receiptText).not.toContain('do not send this field');
    } finally {
      await close();
    }
  });

  it('requires payment approval before mock delivery is saved', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'mock',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Write launch checklist',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.05', currency: 'USDC' },
      });

      const before = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      expect(before.paymentTxHash).toBeUndefined();
      expect(before.deliveryText).toBeUndefined();

      const after = await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      expect(after.status).toBe('delivered');
      expect(after.paymentTxHash).toContain('mock_tx_');
      expect(after.deliveryText).toContain('Opportunity Scout Report');
    } finally {
      await close();
    }
  });

  it('does not invent a transaction hash in dry-run mode', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'dry-run',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Dry run task',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.05', currency: 'USDC' },
      });

      const after = await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      expect(after.status).toBe('delivered');
      expect(after.deliveryText).toContain('Opportunity Scout Report');
      expect(after.paymentTxHash).toBeUndefined();
      expect(JSON.stringify(after.events)).toContain('payment_skipped_dry_run');
    } finally {
      await close();
    }
  });

  it('delegates live runs and live payments to the live runtime without creating mock tx hashes', async () => {
    const fakeLiveRuntime: LiveRuntime = {
      async startRun(receipt: LiveRunReceipt) {
        return {
          ...receipt,
          status: 'awaiting_payment_approval',
          negotiationId: 'real_neg_123',
          orderId: 'real_order_123',
        };
      },
      async approvePayment(runId: string) {
        return {
          runId,
          mode: 'live',
          status: 'paid',
          createdAt: '2026-06-18T19:30:00.000Z',
          updatedAt: '2026-06-18T19:31:00.000Z',
          taskTitle: 'Write launch checklist',
          sanitizedTask: 'Task: Write launch checklist',
          maxPayment: { amount: '0.05', currency: 'USDC' },
          crooServiceId: 'svc_worker',
          negotiationId: 'real_neg_123',
          orderId: 'real_order_123',
          paymentTxHash: '0xrealpaymenttx',
          deliveryText: undefined,
          error: undefined,
          events: [],
        };
      },
    };
    const { baseUrl, close } = await startTestServer(
      {
        TENDERBOARD_MODE: 'live',
        TENDERBOARD_RECEIPTS_DIR: tempDir,
        CROO_API_URL: 'https://api.croo.network',
        CROO_WS_URL: 'wss://api.croo.network/ws',
        CROO_REQUESTER_SDK_KEY: 'croo_sk_requester_secret',
        CROO_WORKER_SDK_KEY: 'croo_sk_worker_secret',
        CROO_WORKER_SERVICE_ID: 'svc_worker',
      },
      fakeLiveRuntime,
    );

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Write launch checklist',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.05', currency: 'USDC' },
      });

      const paid = await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      expect(paid.paymentTxHash).toBe('0xrealpaymenttx');
      expect(paid.paymentTxHash).not.toContain('mock_tx_');
    } finally {
      await close();
    }
  });
});

async function startTestServer(
  env: NodeJS.ProcessEnv,
  liveRuntime?: LiveRuntime,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const config = loadTenderBoardConfig(env);
  const store = new RunStore(config.receiptsDir);
  const server = liveRuntime
    ? createTenderBoardServer({ config, store, liveRuntime, scoutFetch: fakeScoutFetch as typeof fetch })
    : createTenderBoardServer({ config, store, scoutFetch: fakeScoutFetch as typeof fetch });
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
