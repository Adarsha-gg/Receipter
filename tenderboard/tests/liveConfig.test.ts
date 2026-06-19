import { describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';

describe('loadTenderBoardConfig', () => {
  it('returns safe config without leaking SDK keys', () => {
    const config = loadTenderBoardConfig({
      TENDERBOARD_MODE: 'live',
      TENDERBOARD_PORT: '4174',
      TENDERBOARD_MAX_PAYMENT_USDC: '0.05',
      CROO_API_URL: 'https://api.croo.network',
      CROO_WS_URL: 'wss://api.croo.network/ws',
      CROO_REQUESTER_SDK_KEY: 'croo_sk_requester_secret',
      CROO_WORKER_SDK_KEY: 'croo_sk_worker_secret',
      CROO_WORKER_SERVICE_ID: 'svc_worker',
      SUI_NETWORK: 'testnet',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
    });

    const safeText = JSON.stringify(config.safe);
    expect(config.safe.readyForLive).toBe(true);
    expect(config.safe.sui.readyForSuiAnchor).toBe(true);
    expect(safeText).not.toContain('croo_sk_requester_secret');
    expect(safeText).not.toContain('croo_sk_worker_secret');
  });

  it('reports missing live settings plainly', () => {
    const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'live' });

    expect(config.safe.readyForLive).toBe(false);
    expect(config.safe.missingLiveSettings).toContain('CROO_API_URL');
    expect(config.safe.missingLiveSettings).toContain('CROO_REQUESTER_SDK_KEY');
    expect(config.safe.missingLiveSettings).toContain('CROO_WORKER_SDK_KEY');
  });

  it('reports missing Sui anchor settings separately from CROO live settings', () => {
    const config = loadTenderBoardConfig({ TENDERBOARD_MODE: 'mock' });

    expect(config.safe.sui.network).toBe('testnet');
    expect(config.safe.sui.readyForSuiAnchor).toBe(false);
    expect(config.safe.sui.missingSuiSettings).toEqual([
      'SUI_PACKAGE_ID',
      'SUI_RECEIPT_REGISTRY_ID',
      'WALRUS_PUBLISHER_URL',
      'WALRUS_AGGREGATOR_URL',
    ]);
  });
});
