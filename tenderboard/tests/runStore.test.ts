import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeEvent, RunStore } from '../src/live/runStore.js';
import type { LiveRunReceipt } from '../src/live/types.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tenderboard-runs-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('RunStore', () => {
  it('writes and reads receipts', async () => {
    const store = new RunStore(tempDir);
    const receipt = sampleReceipt();

    await store.create(receipt);

    expect(await store.get(receipt.runId)).toMatchObject({
      runId: receipt.runId,
      status: 'awaiting_payment_approval',
    });
  });

  it('appends events without exposing private notes', async () => {
    const store = new RunStore(tempDir);
    const receipt = sampleReceipt();
    await store.create(receipt);

    await store.appendEvent(
      receipt.runId,
      makeEvent({ source: 'app', type: 'checked', message: 'Private notes were excluded.' }),
    );

    const stored = await store.require(receipt.runId);
    expect(stored.events).toHaveLength(2);
    expect(JSON.stringify(stored)).not.toContain('do not send this field');
  });

  it('lists receipt summaries newest first', async () => {
    const store = new RunStore(tempDir);
    await store.create(sampleReceipt({ runId: 'run_old', createdAt: '2026-06-18T18:00:00.000Z' }));
    await store.create(sampleReceipt({ runId: 'run_new', createdAt: '2026-06-18T19:00:00.000Z' }));

    const summaries = await store.list();

    expect(summaries.map((summary) => summary.runId)).toEqual(['run_new', 'run_old']);
    expect(JSON.stringify(summaries)).not.toContain('sanitizedTask');
  });
});

function sampleReceipt(overrides: Partial<LiveRunReceipt> = {}): LiveRunReceipt {
  return {
    runId: 'run_test',
    mode: 'mock',
    status: 'awaiting_payment_approval',
    createdAt: '2026-06-18T18:00:00.000Z',
    updatedAt: '2026-06-18T18:00:00.000Z',
    taskTitle: 'Write checklist',
    sanitizedTask: 'Task: Write checklist',
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
        { id: 'safe_packet', label: 'Safe worker packet', status: 'passed', detail: 'No forbidden secret pattern remains.' },
      ],
      settlementRule: 'Release after approval and delivery.',
      reputationWriteback: 'Use receipt as feedback.',
    },
    crooServiceId: undefined,
    negotiationId: undefined,
    orderId: undefined,
    paymentTxHash: undefined,
    deliveryText: undefined,
    error: undefined,
    events: [makeEvent({ source: 'app', type: 'run_created', message: 'Task created.' })],
    ...overrides,
  };
}
