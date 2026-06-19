import path from 'node:path';
import type { SafeConfig, TenderBoardConfig, TenderBoardMode } from './types.js';

const DEFAULT_PORT = 4174;
const DEFAULT_MAX_PAYMENT_USDC = '0.25';
const DEFAULT_RECEIPTS_DIR = 'data/runs';

export function loadTenderBoardConfig(env: NodeJS.ProcessEnv = process.env): TenderBoardConfig {
  const mode = parseMode(env.TENDERBOARD_MODE ?? env.TENDERBOARD_ORDER_MODE ?? 'mock');
  const port = parsePort(env.TENDERBOARD_PORT);
  const maxPaymentUsdc = parseAmount(env.TENDERBOARD_MAX_PAYMENT_USDC ?? DEFAULT_MAX_PAYMENT_USDC);
  const receiptsDir = path.resolve(env.TENDERBOARD_RECEIPTS_DIR ?? DEFAULT_RECEIPTS_DIR);
  const embeddedWorker = parseBoolean(env.TENDERBOARD_EMBED_WORKER ?? 'true');

  const crooApiUrl = blankToUndefined(env.CROO_API_URL);
  const crooWsUrl = blankToUndefined(env.CROO_WS_URL);
  const baseRpcUrl = blankToUndefined(env.BASE_RPC_URL);
  const requesterSdkKey = blankToUndefined(env.CROO_REQUESTER_SDK_KEY ?? env.CROO_SDK_KEY);
  const workerSdkKey = blankToUndefined(env.CROO_WORKER_SDK_KEY);
  const workerServiceId = blankToUndefined(env.CROO_WORKER_SERVICE_ID ?? env.CROO_TARGET_SERVICE_ID);
  const suiNetwork = blankToUndefined(env.SUI_NETWORK) ?? 'testnet';
  const suiPackageId = blankToUndefined(env.SUI_PACKAGE_ID);
  const suiReceiptRegistryId = blankToUndefined(env.SUI_RECEIPT_REGISTRY_ID);
  const walrusPublisherUrl = blankToUndefined(env.WALRUS_PUBLISHER_URL);
  const walrusAggregatorUrl = blankToUndefined(env.WALRUS_AGGREGATOR_URL);

  const missingLiveSettings = liveRequiredSettings({
    crooApiUrl,
    crooWsUrl,
    requesterSdkKey,
    workerSdkKey,
    workerServiceId,
    maxPaymentUsdc,
  });
  const missingSuiSettings = suiRequiredSettings({
    suiPackageId,
    suiReceiptRegistryId,
    walrusPublisherUrl,
    walrusAggregatorUrl,
  });

  const safe: SafeConfig = {
    mode,
    port,
    maxPaymentUsdc,
    receiptsDir,
    embeddedWorker,
    sui: {
      network: suiNetwork,
      packageIdConfigured: Boolean(suiPackageId),
      receiptRegistryIdConfigured: Boolean(suiReceiptRegistryId),
      walrusPublisherConfigured: Boolean(walrusPublisherUrl),
      walrusAggregatorConfigured: Boolean(walrusAggregatorUrl),
      readyForSuiAnchor: missingSuiSettings.length === 0,
      missingSuiSettings,
    },
    croo: {
      apiUrlConfigured: Boolean(crooApiUrl),
      wsUrlConfigured: Boolean(crooWsUrl),
      requesterSdkKeyConfigured: Boolean(requesterSdkKey),
      workerSdkKeyConfigured: Boolean(workerSdkKey),
      workerServiceIdConfigured: Boolean(workerServiceId),
      baseRpcUrlConfigured: Boolean(baseRpcUrl),
    },
    readyForLive: missingLiveSettings.length === 0,
    missingLiveSettings,
  };

  return {
    mode,
    port,
    maxPaymentUsdc,
    receiptsDir,
    crooApiUrl,
    crooWsUrl,
    baseRpcUrl,
    requesterSdkKey,
    workerSdkKey,
    workerServiceId,
    embeddedWorker,
    missingLiveSettings,
    suiNetwork,
    suiPackageId,
    suiReceiptRegistryId,
    walrusPublisherUrl,
    walrusAggregatorUrl,
    missingSuiSettings,
    safe,
  };
}

function parseMode(value: string): TenderBoardMode {
  if (value === 'mock' || value === 'dry-run' || value === 'live') {
    return value;
  }

  throw new Error(`Invalid TENDERBOARD_MODE: ${value}. Expected mock, dry-run, or live.`);
}

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid TENDERBOARD_PORT: ${value}.`);
  }
  return port;
}

function parseAmount(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Invalid TENDERBOARD_MAX_PAYMENT_USDC: ${value}.`);
  }
  return amount.toFixed(2);
}

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid TENDERBOARD_EMBED_WORKER: ${value}. Expected true or false.`);
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') return undefined;
  return value.trim();
}

function liveRequiredSettings(values: {
  crooApiUrl: string | undefined;
  crooWsUrl: string | undefined;
  requesterSdkKey: string | undefined;
  workerSdkKey: string | undefined;
  workerServiceId: string | undefined;
  maxPaymentUsdc: string;
}): string[] {
  const missing: string[] = [];
  if (!values.crooApiUrl) missing.push('CROO_API_URL');
  if (!values.crooWsUrl) missing.push('CROO_WS_URL');
  if (!values.requesterSdkKey) missing.push('CROO_REQUESTER_SDK_KEY');
  if (!values.workerSdkKey) missing.push('CROO_WORKER_SDK_KEY');
  if (!values.workerServiceId) missing.push('CROO_WORKER_SERVICE_ID');
  if (!values.maxPaymentUsdc) missing.push('TENDERBOARD_MAX_PAYMENT_USDC');
  return missing;
}

function suiRequiredSettings(values: {
  suiPackageId: string | undefined;
  suiReceiptRegistryId: string | undefined;
  walrusPublisherUrl: string | undefined;
  walrusAggregatorUrl: string | undefined;
}): string[] {
  const missing: string[] = [];
  if (!values.suiPackageId) missing.push('SUI_PACKAGE_ID');
  if (!values.suiReceiptRegistryId) missing.push('SUI_RECEIPT_REGISTRY_ID');
  if (!values.walrusPublisherUrl) missing.push('WALRUS_PUBLISHER_URL');
  if (!values.walrusAggregatorUrl) missing.push('WALRUS_AGGREGATOR_URL');
  return missing;
}
