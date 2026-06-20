import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PaymentReplayLedger, ReplayLedgerError } from '../src/live/replayLedger.js';
import type { X402SuiPaymentPayload } from '../src/live/types.js';

describe('PaymentReplayLedger', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'walrusproof-replay-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('persists x402 payment nonces and transaction digests outside run receipts', async () => {
    const ledger = new PaymentReplayLedger(tempDir);
    const payload = samplePayload();

    await expect(ledger.recordPayment(payload, '2026-06-20T00:00:00.000Z')).resolves.toMatchObject({
      key: 'sui:testnet:payment_intent_run_1:pay_nonce:set_nonce:/api/runs/run_1/worker-task:1000:0xreceiver:sui_worker',
      transaction: '0xpayment',
      runId: 'run_1',
    });

    await expect(ledger.recordPayment({ ...payload, transaction: '0xpayment_2' })).rejects.toMatchObject({
      name: 'ReplayLedgerError',
      status: 409,
      message: expect.stringContaining('nonce was already recorded'),
    } satisfies Partial<ReplayLedgerError>);

    const restartedLedger = new PaymentReplayLedger(tempDir);
    await expect(
      restartedLedger.recordPayment({
        ...samplePayload({ runId: 'run_2', paymentIntentId: 'payment_intent_run_2', paymentNonce: 'pay_nonce_2', settlementNonce: 'set_nonce_2' }),
        transaction: '0xpayment',
      }),
    ).rejects.toMatchObject({
      name: 'ReplayLedgerError',
      status: 409,
      message: expect.stringContaining('transaction was already recorded'),
    } satisfies Partial<ReplayLedgerError>);

    await expect(restartedLedger.list()).resolves.toHaveLength(1);
  });
});

function samplePayload(overrides: Partial<X402SuiPaymentPayload> = {}): X402SuiPaymentPayload {
  return {
    objectType: 'suiproof.x402_sui_payment_payload.v1',
    x402Version: 1,
    scheme: 'sui-payment-kit',
    network: 'sui:testnet',
    transaction: '0xpayment',
    runId: 'run_1',
    resource: '/api/runs/run_1/worker-task',
    paymentIntentId: 'payment_intent_run_1',
    paymentNonce: 'pay_nonce',
    settlementNonce: 'set_nonce',
    amountMist: '1000',
    receiverAddress: '0xreceiver',
    coinType: '0x2::sui::SUI',
    workerAgentId: 'sui_worker',
    ...overrides,
  };
}
