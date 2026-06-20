import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';

describe('loadTenderBoardConfig', () => {
  it('returns safe Sui config without leaking unrelated env secrets', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui',
      TENDERBOARD_PORT: '4174',
      TENDERBOARD_MAX_PAYMENT_SUI: '0.050',
      TENDERBOARD_WORKER_AGENT_ID: 'sui_worker',
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      SUI_STAKE_ORACLE_REGISTRY_ID: '0xoracle',
      SUI_CLI_PATH: 'C:\\sui\\sui.exe',
      SUI_CLIENT_CONFIG: 'C:\\secret\\client.yaml',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      MEMORY_BACKEND: 'memwal',
      MEMWAL_DELEGATE_KEY: 'memwal_secret',
      MEMWAL_ACCOUNT_ID: 'memwal_account',
      MEMWAL_SERVER_URL: 'https://memory.walrus.example',
      MEMWAL_NAMESPACE: 'walrusproof-test',
      PRIVATE_KEY: 'do_not_leak',
    });

    const safeText = JSON.stringify(config.safe);
    expect(config.safe.mode).toBe('sui');
    expect(config.safe.maxPaymentSui).toBe('0.050');
    expect(config.safe.sui.readyForSui).toBe(true);
    expect(config.safe.sui.suiCliConfigured).toBe(true);
    expect(config.safe.sui.stakeOracleRegistryIdConfigured).toBe(true);
    expect(config.suiStakeOracleRegistryId).toBe('0xoracle');
    expect(config.suiCliPath).toBe('C:\\sui\\sui.exe');
    expect(config.suiClientConfig).toBe('C:\\secret\\client.yaml');
    expect(config.workerAgentId).toBe('sui_worker');
    expect(config.memoryBackend).toBe('memwal');
    expect(config.safe.memory).toMatchObject({
      backend: 'memwal',
      memwalConfigured: true,
      memwalReady: true,
      missingMemwalSettings: [],
      memwalServerConfigured: true,
      memwalAccountConfigured: true,
      memwalNamespace: 'walrusproof-test',
      sealEncryptionMode: 'disabled',
      sealLiveConfigured: false,
    });
    expect(config.safe.walrus).toMatchObject({
      uploadStrategy: 'raw-walrus',
      harborUploadConfigured: false,
    });
    expect(safeText).not.toContain('do_not_leak');
    expect(safeText).not.toContain('client.yaml');
    expect(safeText).not.toContain('memwal_secret');
  });

  it('reports missing Sui settings plainly', () => {
    const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'sui-dev' });

    expect(config.safe.sui.network).toBe('testnet');
    expect(config.safe.sui.readyForSui).toBe(false);
    expect(config.safe.sui.missingSuiSettings).toEqual([
      'SUI_PACKAGE_ID',
      'SUI_RECEIPT_REGISTRY_ID',
      'SUI_OPERATOR_ADDRESS',
      'WALRUS_PUBLISHER_URL',
      'WALRUS_AGGREGATOR_URL',
    ]);
  });

  it('rejects non-Sui modes', () => {
    expect(() => loadTenderBoardConfig({ TENDERBOARD_MODE: 'live' })).toThrow('Expected sui-dev or sui');
  });

  it('rejects unknown memory backends', () => {
    expect(() => loadTenderBoardConfig({ MEMORY_BACKEND: 'postgres' })).toThrow('Expected walrus or memwal');
  });

  it('fails loudly when production MemWal mode is missing credentials', () => {
    expect(() =>
      loadTenderBoardConfig({
        TENDERBOARD_MODE: 'sui',
        MEMORY_BACKEND: 'memwal',
        MEMWAL_ACCOUNT_ID: 'account',
      }),
    ).toThrow('TENDERBOARD_MODE=sui with MEMORY_BACKEND=memwal requires MEMWAL_DELEGATE_KEY, MEMWAL_SERVER_URL');
  });

  it('surfaces MemWal readiness gaps in dev mode without leaking credentials', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'sui-dev',
      MEMORY_BACKEND: 'memwal',
      MEMWAL_SERVER_URL: 'https://memory.walrus.example',
      SEAL_ENCRYPTION_MODE: 'deterministic-test',
      WALRUS_UPLOAD_STRATEGY: 'harbor',
      HARBOR_UPLOAD_URL: 'https://harbor.example/upload',
    });

    expect(config.safe.memory).toMatchObject({
      backend: 'memwal',
      memwalConfigured: false,
      memwalReady: false,
      missingMemwalSettings: ['MEMWAL_DELEGATE_KEY', 'MEMWAL_ACCOUNT_ID'],
      sealEncryptionMode: 'deterministic-test',
      sealLiveConfigured: false,
    });
    expect(config.safe.walrus).toMatchObject({
      uploadStrategy: 'harbor',
      harborUploadConfigured: true,
    });
  });
});
