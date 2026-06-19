import { describe, expect, it } from 'vitest';
import type { LiveRunReceipt, TenderBoardConfig } from '../src/live/types.js';
import { buildSuiX402PaymentCliArgs, buildX402PaymentPayload } from '../src/sui/paymentExecutor.js';

describe('Sui x402 payment executor', () => {
  it('builds a PTB that transfers SUI and records the payment intent marker', () => {
    const receipt = {
      runId: 'run_pay',
      workerAgentId: 'sui_opportunity_scout',
      paymentIntentPlan: {
        intentId: 'payment_intent_run_pay',
        paymentNonce: 'pay_nonce',
        settlementNonce: 'set_nonce',
        amountMist: '35000000',
        receiverAddress: '0xreceiver',
        coinType: '0x2::sui::SUI',
        expectedNetwork: 'testnet',
      },
    } as LiveRunReceipt;
    const config = {
      suiPackageId: '0xpackage',
      suiClientConfig: 'client.yaml',
    } as TenderBoardConfig;

    const args = buildSuiX402PaymentCliArgs(receipt, config);
    const payload = buildX402PaymentPayload(receipt, '0xdigest');

    expect(args).toContain('ptb');
    expect(args).toContain('--split-coins');
    expect(args).toContain('[35000000]');
    expect(args).toContain('--transfer-objects');
    expect(args).toContain('@0xreceiver');
    expect(args).toContain('--move-call');
    expect(args).toContain('0xpackage::receipts::record_payment_intent');
    expect(args).toContain('--make-move-vec');
    expect(args).toContain('[114,117,110,95,112,97,121]');
    expect(args).toContain('[47,97,112,105,47,114,117,110,115,47,114,117,110,95,112,97,121,47,119,111,114,107,101,114,45,116,97,115,107]');
    expect(args).toContain('runId');
    expect(args).toContain('paymentNonce');
    expect(payload).toMatchObject({
      transaction: '0xdigest',
      resource: '/api/runs/run_pay/worker-task',
      paymentNonce: 'pay_nonce',
      receiverAddress: '0xreceiver',
    });
  });
});
