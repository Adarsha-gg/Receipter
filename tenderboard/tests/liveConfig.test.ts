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
    });

    const safeText = JSON.stringify(config.safe);
    expect(config.safe.readyForLive).toBe(true);
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
});
