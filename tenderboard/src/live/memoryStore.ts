import { createRequire } from 'node:module';
import { buildEvidenceBundle } from './walrusRuntime.js';
import type { LiveRunReceipt, TenderBoardConfig } from './types.js';
import { storeEvidenceOnWalrus, type WalrusStoreResult } from './walrusRuntime.js';

const requireOptional = createRequire(import.meta.url);

export type MemoryStoreBackend = 'walrus' | 'memwal';

export interface MemoryStore {
  readonly backend: MemoryStoreBackend;
  putEvidenceBundle(receipt: LiveRunReceipt): Promise<WalrusStoreResult>;
}

export interface MemWalRememberJob {
  job_id?: string;
  jobId?: string;
  blob_id?: string;
  blobId?: string;
}

export interface MemWalClient {
  remember(text: string, namespace?: string): Promise<MemWalRememberJob>;
  waitForRememberJob?(jobId: string): Promise<MemWalRememberJob | void>;
}

export interface MemWalSdkModule {
  MemWal: {
    create(options: {
      key: string;
      accountId: string;
      serverUrl: string;
      namespace?: string;
    }): MemWalClient;
  };
}

export interface MemWalReadiness {
  ready: boolean;
  missingSettings: string[];
}

export class WalrusMemoryStore implements MemoryStore {
  readonly backend = 'walrus' as const;

  constructor(
    private readonly config: TenderBoardConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  putEvidenceBundle(receipt: LiveRunReceipt): Promise<WalrusStoreResult> {
    return storeEvidenceOnWalrus(receipt, this.config, this.fetchImpl);
  }
}

export class MemWalMemoryStore implements MemoryStore {
  readonly backend = 'memwal' as const;

  constructor(
    private readonly walrusStore: MemoryStore,
    private readonly memwalClient: MemWalClient,
    private readonly namespace: string | undefined,
  ) {}

  async putEvidenceBundle(receipt: LiveRunReceipt): Promise<WalrusStoreResult> {
    const walrus = await this.walrusStore.putEvidenceBundle(receipt);
    const fact = buildMemWalReputationFact(receipt, walrus);
    const job = await this.memwalClient.remember(fact, this.namespace);
    const jobId = job.job_id ?? job.jobId;
    if (jobId && this.memwalClient.waitForRememberJob) {
      await this.memwalClient.waitForRememberJob(jobId);
    }
    return walrus;
  }
}

export function createMemoryStore(config: TenderBoardConfig, fetchImpl?: typeof fetch): MemoryStore {
  const walrusStore = new WalrusMemoryStore(config, fetchImpl);
  if (config.memoryBackend === 'walrus') {
    return walrusStore;
  }

  assertMemWalReady(config);
  return new MemWalMemoryStore(walrusStore, createMemWalClient(config), config.memwalNamespace);
}

export function createMemWalClient(config: TenderBoardConfig, moduleLoader: () => MemWalSdkModule = loadMemWalSdk): MemWalClient {
  assertMemWalReady(config);
  const options = {
    key: config.memwalDelegateKey as string,
    accountId: config.memwalAccountId as string,
    serverUrl: config.memwalServerUrl as string,
    ...(config.memwalNamespace ? { namespace: config.memwalNamespace } : {}),
  };
  return moduleLoader().MemWal.create(options);
}

export function getMemWalReadiness(config: Pick<TenderBoardConfig, 'memwalDelegateKey' | 'memwalAccountId' | 'memwalServerUrl'>): MemWalReadiness {
  const missingSettings: string[] = [];
  if (!config.memwalDelegateKey) missingSettings.push('MEMWAL_DELEGATE_KEY');
  if (!config.memwalAccountId) missingSettings.push('MEMWAL_ACCOUNT_ID');
  if (!config.memwalServerUrl) missingSettings.push('MEMWAL_SERVER_URL');
  return {
    ready: missingSettings.length === 0,
    missingSettings,
  };
}

export function assertMemWalReady(config: Pick<TenderBoardConfig, 'memwalDelegateKey' | 'memwalAccountId' | 'memwalServerUrl'>): void {
  const readiness = getMemWalReadiness(config);
  if (!readiness.ready) {
    throw new Error(`MEMORY_BACKEND=memwal requires ${readiness.missingSettings.join(', ')}.`);
  }
}

export function buildMemWalReputationFact(receipt: LiveRunReceipt, walrus: WalrusStoreResult): string {
  const bundle = buildEvidenceBundle(receipt);
  const claimResults = receipt.verificationManifest.claimResults ?? [];
  const supportedClaimCount = claimResults.filter((claim) => claim.verdict === 'supported').length;
  const failedClaimCount = Math.max(0, claimResults.length - supportedClaimCount);
  return [
    `WalrusProof verified work memory for agent ${receipt.workerAgentId}.`,
    `Run: ${receipt.runId}.`,
    `Task: ${receipt.taskTitle}.`,
    `Checker pack: ${receipt.verificationManifest.checkerPack}.`,
    `Walrus blob: ${walrus.blobId}.`,
    `Walrus read URL: ${walrus.readUrl}.`,
    `Evidence hash: ${receipt.verificationManifest.evidenceHash ?? bundle.verification.evidenceHash ?? 'pending'}.`,
    `Sui payment digest: ${receipt.suiPaymentDigest ?? 'pending'}.`,
    `Sui anchor digest: ${receipt.suiAnchorDigest ?? 'pending'}.`,
    `Claim verification: ${supportedClaimCount} supported, ${failedClaimCount} failed.`,
    `Admissibility: ${receipt.verificationManifest.summary?.admissibility ?? receipt.clearingDecision?.verificationAdmissibility ?? 'pending'}.`,
    `Evidence strength: ${receipt.verificationManifest.summary?.evidenceStrength ?? receipt.clearingDecision?.evidenceStrength ?? 'none'}.`,
  ].join(' ');
}

function loadMemWalSdk(): MemWalSdkModule {
  try {
    return requireOptional('@mysten-incubation/memwal') as MemWalSdkModule;
  } catch (error) {
    throw new Error(
      `MEMORY_BACKEND=memwal requires the optional @mysten-incubation/memwal package. Install it and its peer dependencies first. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
