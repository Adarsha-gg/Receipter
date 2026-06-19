import path from 'node:path';
import type { SafeConfig, TenderBoardConfig, TenderBoardMode } from './types.js';

const DEFAULT_PORT = 4174;
const DEFAULT_MAX_PAYMENT_SUI = '0.05';
const DEFAULT_RECEIPTS_DIR = 'data/runs';
const DEFAULT_WORKER_AGENT_ID = 'sui_opportunity_scout';

export function loadTenderBoardConfig(env: NodeJS.ProcessEnv = process.env): TenderBoardConfig {
  const mode = parseMode(env.TENDERBOARD_MODE ?? 'sui-dev');
  const port = parsePort(env.TENDERBOARD_PORT);
  const maxPaymentSui = parseAmount(env.TENDERBOARD_MAX_PAYMENT_SUI ?? DEFAULT_MAX_PAYMENT_SUI);
  const receiptsDir = path.resolve(env.TENDERBOARD_RECEIPTS_DIR ?? DEFAULT_RECEIPTS_DIR);
  const workerAgentId = blankToUndefined(env.TENDERBOARD_WORKER_AGENT_ID) ?? DEFAULT_WORKER_AGENT_ID;
  const suiNetwork = blankToUndefined(env.SUI_NETWORK) ?? 'testnet';
  const suiRpcUrl = blankToUndefined(env.SUI_RPC_URL) ?? defaultSuiRpcUrl(suiNetwork);
  const suiPackageId = blankToUndefined(env.SUI_PACKAGE_ID);
  const suiReceiptRegistryId = blankToUndefined(env.SUI_RECEIPT_REGISTRY_ID);
  const suiOperatorAddress = blankToUndefined(env.SUI_OPERATOR_ADDRESS);
  const walrusPublisherUrl = blankToUndefined(env.WALRUS_PUBLISHER_URL);
  const walrusAggregatorUrl = blankToUndefined(env.WALRUS_AGGREGATOR_URL);
  const suiCliPath = blankToUndefined(env.SUI_CLI_PATH);
  const suiClientConfig = blankToUndefined(env.SUI_CLIENT_CONFIG);

  const missingSuiSettings = suiRequiredSettings({
    suiPackageId,
    suiReceiptRegistryId,
    suiOperatorAddress,
    walrusPublisherUrl,
    walrusAggregatorUrl,
  });

  const safe: SafeConfig = {
    mode,
    port,
    maxPaymentSui,
    receiptsDir,
    workerAgentId,
    sui: {
      network: suiNetwork,
      rpcUrlConfigured: Boolean(suiRpcUrl),
      packageIdConfigured: Boolean(suiPackageId),
      receiptRegistryIdConfigured: Boolean(suiReceiptRegistryId),
      operatorAddressConfigured: Boolean(suiOperatorAddress),
      walrusPublisherConfigured: Boolean(walrusPublisherUrl),
      walrusAggregatorConfigured: Boolean(walrusAggregatorUrl),
      suiCliConfigured: Boolean(suiCliPath),
      readyForSui: missingSuiSettings.length === 0,
      missingSuiSettings,
    },
  };

  return {
    mode,
    port,
    maxPaymentSui,
    receiptsDir,
    workerAgentId,
    suiNetwork,
    suiRpcUrl,
    suiPackageId,
    suiReceiptRegistryId,
    suiOperatorAddress,
    walrusPublisherUrl,
    walrusAggregatorUrl,
    suiCliPath,
    suiClientConfig,
    missingSuiSettings,
    safe,
  };
}

function defaultSuiRpcUrl(network: string): string | undefined {
  if (network === 'mainnet' || network === 'testnet' || network === 'devnet') {
    return `https://fullnode.${network}.sui.io:443`;
  }
  if (network.startsWith('http://') || network.startsWith('https://')) {
    return network;
  }
  return undefined;
}

function parseMode(value: string): TenderBoardMode {
  if (value === 'sui-dev' || value === 'sui') {
    return value;
  }

  throw new Error(`Invalid TENDERBOARD_MODE: ${value}. Expected sui-dev or sui.`);
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
    throw new Error(`Invalid TENDERBOARD_MAX_PAYMENT_SUI: ${value}.`);
  }
  return amount.toFixed(3);
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (!value || value.trim() === '') return undefined;
  return value.trim();
}

function suiRequiredSettings(values: {
  suiPackageId: string | undefined;
  suiReceiptRegistryId: string | undefined;
  suiOperatorAddress: string | undefined;
  walrusPublisherUrl: string | undefined;
  walrusAggregatorUrl: string | undefined;
}): string[] {
  const missing: string[] = [];
  if (!values.suiPackageId) missing.push('SUI_PACKAGE_ID');
  if (!values.suiReceiptRegistryId) missing.push('SUI_RECEIPT_REGISTRY_ID');
  if (!values.suiOperatorAddress) missing.push('SUI_OPERATOR_ADDRESS');
  if (!values.walrusPublisherUrl) missing.push('WALRUS_PUBLISHER_URL');
  if (!values.walrusAggregatorUrl) missing.push('WALRUS_AGGREGATOR_URL');
  return missing;
}
