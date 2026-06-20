import { describe, expect, it } from 'vitest';
import { buildAgentMemoryPassport } from '../src/live/agentMemory.js';
import { loadTenderBoardConfig } from '../src/live/config.js';
import type { LiveRunReceipt } from '../src/live/types.js';
import { buildAgentPassportUpdateCliArgs, encodeAgentPassportMoveArgument } from '../src/sui/agentPassportExecutor.js';
import { buildAgentPassportUpdateTransactionData } from '../src/sui/agentPassportPlan.js';
import { textToHexBytes } from '../src/sui/anchorExecutor.js';

describe('AgentPassport update transaction data', () => {
  it('builds the update_memory_pointer call after receipt anchoring', () => {
    const receipt = sampleAnchoredReceipt();
    const passport = buildAgentMemoryPassport('worker_1', [receipt], '2026-06-20T00:00:00.000Z', {
      passportBindings: [{ workerAgentId: 'worker_1', ownerAddress: '0xowner', passportObjectId: '0xpassport' }],
    });

    const plan = buildAgentPassportUpdateTransactionData({
      network: 'testnet',
      packageId: '0xpackage',
      passport,
      memoryIndexBlobId: 'walrus_memory_index_blob',
      anchoredReceipt: receipt,
    });

    expect(plan.ready).toBe(true);
    expect(plan.missing).toEqual([]);
    expect(plan.moveCall).toEqual({
      packageId: '0xpackage',
      module: 'agent_passport',
      function: 'update_memory_pointer',
      arguments: [
        '0xpassport',
        'walrus_memory_index_blob',
        passport.latestMemoryPointer?.memoryHash,
        'walrus_blob',
        '0xanchor',
        '1',
        '1',
        '1',
      ],
    });
    expect(plan.ownerAddress).toBe('0xowner');
    expect(plan.latestMemoryPointer).toMatchObject({ runId: 'run_1' });
  });

  it('reports unready data without pretending an unbound passport can be updated', () => {
    const receipt = sampleAnchoredReceipt({ suiAnchorDigest: undefined });
    const passport = buildAgentMemoryPassport('worker_1', [receipt], '2026-06-20T00:00:00.000Z');

    const plan = buildAgentPassportUpdateTransactionData({
      network: 'testnet',
      packageId: undefined,
      passport,
      memoryIndexBlobId: undefined,
      anchoredReceipt: receipt,
    });

    expect(plan.ready).toBe(false);
    expect(plan.missing).toEqual([
      'SUI_PACKAGE_ID',
      'AGENT_PASSPORT_OBJECT_ID',
      'WALRUS_MEMORY_INDEX_BLOB_ID',
      'LATEST_SUI_ANCHOR_DIGEST',
    ]);
    expect(plan.moveCall.arguments[0]).toBe('<AGENT_PASSPORT_OBJECT_ID>');
    expect(plan.moveCall.arguments[4]).toBe('<LATEST_SUI_ANCHOR_DIGEST>');
  });

  it('builds Sui CLI args with only byte-vector arguments encoded', () => {
    const receipt = sampleAnchoredReceipt();
    const passport = buildAgentMemoryPassport('worker_1', [receipt], '2026-06-20T00:00:00.000Z', {
      passportBindings: [{ workerAgentId: 'worker_1', ownerAddress: '0xowner', passportObjectId: '0xpassport' }],
    });
    const plan = buildAgentPassportUpdateTransactionData({
      network: 'testnet',
      packageId: '0xpackage',
      passport,
      memoryIndexBlobId: 'walrus_memory_index_blob',
      anchoredReceipt: receipt,
    });
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui',
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      SUI_CLIENT_CONFIG: 'C:\\sui\\client.yaml',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
    });

    const args = buildAgentPassportUpdateCliArgs(plan, config);
    const moveArgs = args.slice(args.indexOf('--args') + 1, args.indexOf('--gas-budget'));

    expect(args.slice(0, 8)).toEqual(['client', '--client.config', 'C:\\sui\\client.yaml', 'call', '--package', '0xpackage', '--module', 'agent_passport']);
    expect(moveArgs[0]).toBe('0xpassport');
    expect(moveArgs[1]).toBe(textToHexBytes('walrus_memory_index_blob'));
    expect(moveArgs[2]).toBe(textToHexBytes(passport.latestMemoryPointer!.memoryHash));
    expect(moveArgs[3]).toBe(textToHexBytes('walrus_blob'));
    expect(moveArgs[4]).toBe(textToHexBytes('0xanchor'));
    expect(moveArgs[5]).toBe('1');
    expect(encodeAgentPassportMoveArgument('0xpassport', 0)).toBe('0xpassport');
    expect(encodeAgentPassportMoveArgument('walrus_blob', 3)).toBe(textToHexBytes('walrus_blob'));
  });
});

function sampleAnchoredReceipt(overrides: Partial<LiveRunReceipt> = {}): LiveRunReceipt {
  const receipt: LiveRunReceipt = {
    runId: 'run_1',
    mode: 'sui',
    status: 'anchored',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-20T00:00:00.000Z',
    taskTitle: 'Verify public opportunity',
    sanitizedTask: 'Verify public opportunity',
    maxPayment: { amount: '0.035', currency: 'SUI' },
    trustDecision: {
      workerAgentId: 'worker_1',
      score: 92,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: [],
      controls: [],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Use public sources.'],
      requiredChecks: [],
      settlementRule: 'anchor when admissible',
      reputationWriteback: 'append to passport',
      claimResults: [],
    },
    workerAgentId: 'worker_1',
    workOrderId: undefined,
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiWorkOrderObjectId: undefined,
    suiEscrowObjectId: undefined,
    suiPaymentDigest: '0xpayment',
    suiAnchorDigest: '0xanchor',
    walrusBlobId: 'walrus_blob',
    walrusBlobObjectId: undefined,
    walrusCertifiedEpoch: undefined,
    walrusEndEpoch: undefined,
    walrusReadUrl: undefined,
    deliveryText: 'Delivered.',
    events: [],
    error: undefined,
  };
  return { ...receipt, ...overrides };
}
