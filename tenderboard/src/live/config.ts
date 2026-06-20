import path from 'node:path';
import type { SafeConfig, SealEncryptionMode, TenderBoardConfig, TenderBoardMode, WalrusUploadStrategy } from './types.js';

const DEFAULT_PORT = 4174;
const DEFAULT_MAX_PAYMENT_SUI = '0.05';
const DEFAULT_RECEIPTS_DIR = 'data/runs';
const DEFAULT_WORKER_AGENT_ID = 'sui_opportunity_scout';
const DEFAULT_MEMWAL_NAMESPACE = 'walrusproof';

export function loadTenderBoardConfig(env: NodeJS.ProcessEnv = process.env): TenderBoardConfig {
  const mode = parseMode(env.TENDERBOARD_MODE ?? 'sui-dev');
  const port = parsePort(env.TENDERBOARD_PORT);
  const maxPaymentSui = parseAmount(env.TENDERBOARD_MAX_PAYMENT_SUI ?? DEFAULT_MAX_PAYMENT_SUI);
  const receiptsDir = path.resolve(env.TENDERBOARD_RECEIPTS_DIR ?? DEFAULT_RECEIPTS_DIR);
  const workerAgentId = blankToUndefined(env.TENDERBOARD_WORKER_AGENT_ID) ?? DEFAULT_WORKER_AGENT_ID;
  const memoryBackend = parseMemoryBackend(env.MEMORY_BACKEND ?? 'walrus');
  const memwalDelegateKey = blankToUndefined(env.MEMWAL_DELEGATE_KEY);
  const memwalAccountId = blankToUndefined(env.MEMWAL_ACCOUNT_ID);
  const memwalServerUrl = blankToUndefined(env.MEMWAL_SERVER_URL);
  const memwalNamespace = blankToUndefined(env.MEMWAL_NAMESPACE) ?? DEFAULT_MEMWAL_NAMESPACE;
  const missingMemwalSettings = memwalRequiredSettings({ memwalDelegateKey, memwalAccountId, memwalServerUrl });
  const sealEncryptionMode = parseSealEncryptionMode(env.SEAL_ENCRYPTION_MODE ?? 'disabled');
  const sealPolicyId = blankToUndefined(env.SEAL_POLICY_ID);
  const sealNamespace = blankToUndefined(env.SEAL_NAMESPACE) ?? DEFAULT_MEMWAL_NAMESPACE;
  const suiNetwork = blankToUndefined(env.SUI_NETWORK) ?? 'testnet';
  const suiRpcUrl = blankToUndefined(env.SUI_RPC_URL) ?? defaultSuiRpcUrl(suiNetwork);
  const suiPackageId = blankToUndefined(env.SUI_PACKAGE_ID);
  const suiReceiptRegistryId = blankToUndefined(env.SUI_RECEIPT_REGISTRY_ID);
  const suiStakeOracleRegistryId = blankToUndefined(env.SUI_STAKE_ORACLE_REGISTRY_ID);
  const suiOperatorAddress = blankToUndefined(env.SUI_OPERATOR_ADDRESS);
  const workerAgentAddress = blankToUndefined(env.TENDERBOARD_WORKER_AGENT_ADDRESS) ?? suiOperatorAddress;
  const walrusPublisherUrl = blankToUndefined(env.WALRUS_PUBLISHER_URL);
  const walrusAggregatorUrl = blankToUndefined(env.WALRUS_AGGREGATOR_URL);
  const walrusUploadStrategy = parseWalrusUploadStrategy(env.WALRUS_UPLOAD_STRATEGY ?? 'raw-walrus');
  const harborUploadUrl = blankToUndefined(env.HARBOR_UPLOAD_URL);
  const suiCliPath = blankToUndefined(env.SUI_CLI_PATH);
  const suiClientConfig = blankToUndefined(env.SUI_CLIENT_CONFIG);

  const missingSuiSettings = suiRequiredSettings({
    suiPackageId,
    suiReceiptRegistryId,
    suiOperatorAddress,
    walrusPublisherUrl,
    walrusAggregatorUrl,
  });

  if (mode === 'sui' && memoryBackend === 'memwal' && missingMemwalSettings.length > 0) {
    throw new Error(
      `TENDERBOARD_MODE=sui with MEMORY_BACKEND=memwal requires ${missingMemwalSettings.join(', ')}. ` +
        'Set the MemWal credentials or use MEMORY_BACKEND=walrus.',
    );
  }

  const safe: SafeConfig = {
    mode,
    port,
    maxPaymentSui,
    receiptsDir,
    workerAgentId,
    memory: {
      backend: memoryBackend,
      memwalConfigured: Boolean(memwalDelegateKey && memwalAccountId && memwalServerUrl),
      memwalReady: memoryBackend === 'memwal' && missingMemwalSettings.length === 0,
      missingMemwalSettings,
      memwalServerConfigured: Boolean(memwalServerUrl),
      memwalAccountConfigured: Boolean(memwalAccountId),
      memwalNamespace,
      sealEncryptionMode,
      sealLiveConfigured: sealEncryptionMode === 'sdk',
      sealPolicyConfigured: Boolean(sealPolicyId),
    },
    sui: {
      network: suiNetwork,
      rpcUrlConfigured: Boolean(suiRpcUrl),
      packageIdConfigured: Boolean(suiPackageId),
      receiptRegistryIdConfigured: Boolean(suiReceiptRegistryId),
      stakeOracleRegistryIdConfigured: Boolean(suiStakeOracleRegistryId),
      operatorAddressConfigured: Boolean(suiOperatorAddress),
      walrusPublisherConfigured: Boolean(walrusPublisherUrl),
      walrusAggregatorConfigured: Boolean(walrusAggregatorUrl),
      suiCliConfigured: Boolean(suiCliPath),
      readyForSui: missingSuiSettings.length === 0,
      missingSuiSettings,
    },
    walrus: {
      uploadStrategy: walrusUploadStrategy,
      harborUploadConfigured: Boolean(harborUploadUrl),
    },
  };

  return {
    mode,
    port,
    maxPaymentSui,
    receiptsDir,
    workerAgentId,
    memoryBackend,
    memwalDelegateKey,
    memwalAccountId,
    memwalServerUrl,
    memwalNamespace,
    sealEncryptionMode,
    sealPolicyId,
    sealNamespace,
    suiNetwork,
    suiRpcUrl,
    suiPackageId,
    suiReceiptRegistryId,
    suiStakeOracleRegistryId,
    suiOperatorAddress,
    workerAgentAddress,
    walrusPublisherUrl,
    walrusAggregatorUrl,
    walrusUploadStrategy,
    harborUploadUrl,
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

function parseMemoryBackend(value: string): 'walrus' | 'memwal' {
  if (value === 'walrus' || value === 'memwal') {
    return value;
  }

  throw new Error(`Invalid MEMORY_BACKEND: ${value}. Expected walrus or memwal.`);
}

function parseSealEncryptionMode(value: string): SealEncryptionMode {
  if (value === 'disabled' || value === 'deterministic-test' || value === 'sdk') {
    return value;
  }

  throw new Error(`Invalid SEAL_ENCRYPTION_MODE: ${value}. Expected disabled, deterministic-test, or sdk.`);
}

function parseWalrusUploadStrategy(value: string): WalrusUploadStrategy {
  if (value === 'raw-walrus' || value === 'harbor') {
    return value;
  }

  throw new Error(`Invalid WALRUS_UPLOAD_STRATEGY: ${value}. Expected raw-walrus or harbor.`);
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

function memwalRequiredSettings(values: {
  memwalDelegateKey: string | undefined;
  memwalAccountId: string | undefined;
  memwalServerUrl: string | undefined;
}): string[] {
  const missing: string[] = [];
  if (!values.memwalDelegateKey) missing.push('MEMWAL_DELEGATE_KEY');
  if (!values.memwalAccountId) missing.push('MEMWAL_ACCOUNT_ID');
  if (!values.memwalServerUrl) missing.push('MEMWAL_SERVER_URL');
  return missing;
}
