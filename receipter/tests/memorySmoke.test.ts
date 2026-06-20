import { describe, expect, it } from 'vitest';
import { buildLiveMemorySmokeReceipt, verifyWalrusSmokeReadback } from '../src/live/memorySmoke.js';
import type { ReceipterConfig } from '../src/live/types.js';

describe('live memory smoke helpers', () => {
  it('builds a public MemWal smoke receipt bound to the configured Sui/Walrus context', () => {
    const receipt = buildLiveMemorySmokeReceipt(testConfig(), new Date('2026-06-19T20:30:00.000Z'));

    expect(receipt.runId).toBe('memwal_smoke_20260619203000');
    expect(receipt.workerAgentId).toBe('sui_smoke_worker');
    expect(receipt.suiNetwork).toBe('testnet');
    expect(receipt.suiPackageId).toBe('0xpackage');
    expect(receipt.suiReceiptRegistryId).toBe('0xregistry');
    expect(receipt.verificationManifest.summary).toMatchObject({
      admissibility: 'admissible',
      evidenceStrength: 'source_receipt',
      settlementEligible: true,
      reputationEligible: true,
    });
    expect(receipt.workerEvidence?.sourceReceipt.observations[0]?.url).toBe('https://github.com/MystenLabs/walrus');
    expect(receipt.deliveryText).not.toContain('private');
  });

  it('verifies Walrus readback contains the smoke run and evidence schema', async () => {
    const readback = await verifyWalrusSmokeReadback(
      {
        blobId: 'blob_1',
        blobObjectId: undefined,
        certifiedEpoch: undefined,
        endEpoch: undefined,
        readUrl: 'https://aggregator.example/v1/blobs/blob_1',
      },
      'memwal_smoke_1',
      async () =>
        new Response('{"schema": "receipter.sui.evidence.v1", "run": { "runId": "memwal_smoke_1" }}', {
          status: 200,
        }),
    );

    expect(readback).toMatchObject({
      ok: true,
      httpStatus: 200,
      containsRunId: true,
      containsEvidenceSchema: true,
    });
    expect(readback.byteLength).toBeGreaterThan(0);
  });

  it('fails Walrus readback when the blob does not contain the expected run', async () => {
    const readback = await verifyWalrusSmokeReadback(
      {
        blobId: 'blob_1',
        blobObjectId: undefined,
        certifiedEpoch: undefined,
        endEpoch: undefined,
        readUrl: 'https://aggregator.example/v1/blobs/blob_1',
      },
      'memwal_smoke_expected',
      async () =>
        new Response('{"schema": "receipter.sui.evidence.v1", "run": { "runId": "other" }}', {
          status: 200,
        }),
    );

    expect(readback.ok).toBe(false);
    expect(readback.containsRunId).toBe(false);
    expect(readback.containsEvidenceSchema).toBe(true);
  });
});

function testConfig(): ReceipterConfig {
  return {
    mode: 'sui',
    port: 0,
    maxPaymentSui: '0.050',
    receiptsDir: 'memory',
    workerAgentId: 'sui_smoke_worker',
    memoryBackend: 'memwal',
    memwalDelegateKey: 'delegate',
    memwalAccountId: 'account',
    memwalServerUrl: 'https://memwal.example',
    memwalNamespace: 'receipter',
    suiNetwork: 'testnet',
    suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiStakeOracleRegistryId: '0xoracle',
    suiOperatorAddress: '0xoperator',
    workerAgentAddress: '0xworker',
    walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
    walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
    suiCliPath: undefined,
    suiClientConfig: undefined,
    suiCliFallbackEnabled: false,
    missingSuiSettings: [],
    safe: {
      mode: 'sui',
      port: 0,
      maxPaymentSui: '0.050',
      receiptsDir: 'memory',
      workerAgentId: 'sui_smoke_worker',
      memory: {
        backend: 'memwal',
        memwalConfigured: true,
        memwalServerConfigured: true,
        memwalAccountConfigured: true,
        memwalNamespace: 'receipter',
      },
      sui: {
        network: 'testnet',
        rpcUrlConfigured: true,
        packageIdConfigured: true,
        receiptRegistryIdConfigured: true,
        stakeOracleRegistryIdConfigured: true,
        operatorAddressConfigured: true,
        walrusPublisherConfigured: true,
        walrusAggregatorConfigured: true,
        suiCliConfigured: false,
        suiCliFallbackEnabled: false,
        readyForSui: true,
        missingSuiSettings: [],
      },
    },
  };
}
