import { stableHash } from './hash.js';
import { buildAgentMemoryRecord } from './agentMemory.js';
import type { LiveRunReceipt, TenderBoardConfig } from './types.js';
import { encryptPrivateMemoryForUpload, type SealEncryptMemoryResult, type SealPrivacyEngine } from './privacySeal.js';

export type WalrusUploadStrategyKind = 'walrus-dev' | 'raw-walrus' | 'harbor';

export interface WalrusUploadSelection {
  strategy: WalrusUploadStrategyKind;
  live: boolean;
  configured: boolean;
  reason: string;
}

export interface WalrusStoreResult {
  blobId: string;
  blobObjectId: string | undefined;
  certifiedEpoch: number | undefined;
  endEpoch: number | undefined;
  readUrl: string | undefined;
  uploadStrategy?: WalrusUploadStrategyKind;
  privacyEncryption?: SealEncryptMemoryResult | undefined;
}

export interface EvidenceBundle {
  schema: 'tenderboard.sui.evidence.v1';
  run: {
    runId: string;
    taskTitle: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  sui: {
    network: string;
    packageId: string | undefined;
    receiptRegistryId: string | undefined;
    workOrderId: string | undefined;
    workOrderObjectId: string | undefined;
    escrowObjectId: string | undefined;
    paymentDigest: string | undefined;
    anchorDigest: string | undefined;
  };
  paymentIntentPlan: LiveRunReceipt['paymentIntentPlan'];
  receiptPlan: LiveRunReceipt['receiptPlan'];
  agents: {
    hirerAgent: LiveRunReceipt['hirerAgent'];
    workerAgent: LiveRunReceipt['workerAgent'];
    agentHandoff: LiveRunReceipt['agentHandoff'];
  };
  reputationSnapshot: LiveRunReceipt['reputationSnapshot'];
  memoryRecord: LiveRunReceipt['memoryRecord'];
  privacy: LiveRunReceipt['privacy'];
  workerBidBoard: LiveRunReceipt['workerBidBoard'];
  trust: LiveRunReceipt['trustDecision'];
  verification: LiveRunReceipt['verificationManifest'];
  privacyEncryption: SealEncryptMemoryResult | undefined;
  clearingObjects: {
    obligationObject: LiveRunReceipt['obligationObject'];
    evidenceEnvelope: LiveRunReceipt['evidenceEnvelope'];
    clearingDecision: LiveRunReceipt['clearingDecision'];
    settlementInstruction: LiveRunReceipt['settlementInstruction'];
  };
  deliveryText: string | undefined;
  workerEvidence: LiveRunReceipt['workerEvidence'];
  events: LiveRunReceipt['events'];
}

export function buildEvidenceBundle(receipt: LiveRunReceipt, privacyEncryption?: SealEncryptMemoryResult | undefined): EvidenceBundle {
  return {
    schema: 'tenderboard.sui.evidence.v1',
    run: {
      runId: receipt.runId,
      taskTitle: receipt.taskTitle,
      status: receipt.status,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
    },
    sui: {
      network: receipt.suiNetwork,
      packageId: receipt.suiPackageId,
      receiptRegistryId: receipt.suiReceiptRegistryId,
      workOrderId: receipt.workOrderId,
      workOrderObjectId: receipt.suiWorkOrderObjectId,
      escrowObjectId: receipt.suiEscrowObjectId,
      paymentDigest: receipt.suiPaymentDigest,
      anchorDigest: receipt.suiAnchorDigest,
    },
    paymentIntentPlan: receipt.paymentIntentPlan,
    receiptPlan: receipt.receiptPlan,
    agents: {
      hirerAgent: receipt.hirerAgent,
      workerAgent: receipt.workerAgent,
      agentHandoff: receipt.agentHandoff,
    },
    reputationSnapshot: receipt.reputationSnapshot,
    memoryRecord: receipt.memoryRecord ?? buildAgentMemoryRecord(receipt),
    privacy: receipt.privacy,
    workerBidBoard: receipt.workerBidBoard,
    trust: receipt.trustDecision,
    verification: receipt.verificationManifest,
    privacyEncryption,
    clearingObjects: {
      obligationObject: receipt.obligationObject,
      evidenceEnvelope: receipt.evidenceEnvelope,
      clearingDecision: receipt.clearingDecision,
      settlementInstruction: receipt.settlementInstruction,
    },
    deliveryText: privacyEncryption ? undefined : receipt.deliveryText,
    workerEvidence: privacyEncryption ? undefined : receipt.workerEvidence,
    events: receipt.events,
  };
}

export function makeEvidenceBundleText(receipt: LiveRunReceipt, privacyEncryption?: SealEncryptMemoryResult | undefined): string {
  return `${JSON.stringify(buildEvidenceBundle(receipt, privacyEncryption), null, 2)}\n`;
}

export function makeWalrusDevBlob(receipt: LiveRunReceipt, privacyEncryption?: SealEncryptMemoryResult | undefined): WalrusStoreResult {
  const hash = stableHash(buildEvidenceBundle(receipt, privacyEncryption)).slice('sha256:'.length);
  return {
    blobId: `walrus_dev_blob_${hash.slice(0, 32)}`,
    blobObjectId: `0x${hash.slice(0, 64)}`,
    certifiedEpoch: 0,
    endEpoch: 2,
    readUrl: `walrus-dev://${hash.slice(0, 32)}`,
    uploadStrategy: 'walrus-dev',
    ...(privacyEncryption ? { privacyEncryption } : {}),
  };
}

export async function storeEvidenceOnWalrus(
  receipt: LiveRunReceipt,
  config: TenderBoardConfig,
  fetchImpl: typeof fetch = fetch,
  sealEngine?: SealPrivacyEngine,
): Promise<WalrusStoreResult> {
  const uploadSelection = selectWalrusUploadStrategy(config);
  const privacyEncryption = await encryptPrivateMemoryForUpload(receipt, config, sealEngine);

  if (config.mode === 'sui-dev') {
    return makeWalrusDevBlob(receipt, privacyEncryption);
  }

  if (uploadSelection.strategy === 'harbor') {
    throw new Error(
      'WALRUS_UPLOAD_STRATEGY=harbor is selected, but the Harbor upload adapter is not implemented in this build. Use WALRUS_UPLOAD_STRATEGY=raw-walrus for the current production path.',
    );
  }

  if (!config.walrusPublisherUrl) {
    throw new Error('WALRUS_PUBLISHER_URL is required to store evidence on Walrus.');
  }

  const publisher = config.walrusPublisherUrl.replace(/\/+$/, '');
  const uploadUrl = new URL(`${publisher}/v1/blobs`);
  uploadUrl.searchParams.set('epochs', '2');
  if (config.suiOperatorAddress) {
    uploadUrl.searchParams.set('send_object_to', config.suiOperatorAddress);
  }

  const response = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: makeEvidenceBundleText(receipt, privacyEncryption),
  });

  if (!response.ok) {
    throw new Error(`Walrus upload failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as WalrusPublisherResponse;
  return parseWalrusPublisherResponse(body, config, uploadSelection.strategy, privacyEncryption);
}

export function selectWalrusUploadStrategy(config: TenderBoardConfig): WalrusUploadSelection {
  if (config.mode === 'sui-dev') {
    return {
      strategy: 'walrus-dev',
      live: false,
      configured: true,
      reason: 'TENDERBOARD_MODE=sui-dev uses deterministic local Walrus blob ids.',
    };
  }

  const strategy = config.walrusUploadStrategy ?? 'raw-walrus';
  if (strategy === 'raw-walrus') {
    return {
      strategy,
      live: true,
      configured: Boolean(config.walrusPublisherUrl),
      reason: 'Raw Walrus publisher upload path is active.',
    };
  }

  return {
    strategy,
    live: false,
    configured: Boolean(config.harborUploadUrl),
    reason: 'Harbor was selected, but the Harbor upload adapter is not implemented in this build.',
  };
}

function parseWalrusPublisherResponse(
  body: WalrusPublisherResponse,
  config: TenderBoardConfig,
  uploadStrategy: WalrusUploadStrategyKind,
  privacyEncryption: SealEncryptMemoryResult | undefined,
): WalrusStoreResult {
  const newlyCreated = body.newlyCreated?.blobObject;
  if (newlyCreated?.blobId) {
    return {
      blobId: newlyCreated.blobId,
      blobObjectId: newlyCreated.id,
      certifiedEpoch: numberOrUndefined(newlyCreated.certifiedEpoch),
      endEpoch: numberOrUndefined(newlyCreated.storage?.endEpoch),
      readUrl: buildWalrusReadUrl(config, newlyCreated.blobId),
      uploadStrategy,
      ...(privacyEncryption ? { privacyEncryption } : {}),
    };
  }

  const alreadyCertified = body.alreadyCertified;
  if (alreadyCertified?.blobId) {
    return {
      blobId: alreadyCertified.blobId,
      blobObjectId: undefined,
      certifiedEpoch: undefined,
      endEpoch: numberOrUndefined(alreadyCertified.endEpoch),
      readUrl: buildWalrusReadUrl(config, alreadyCertified.blobId),
      uploadStrategy,
      ...(privacyEncryption ? { privacyEncryption } : {}),
    };
  }

  throw new Error('Walrus upload response did not include a blob id.');
}

function buildWalrusReadUrl(config: TenderBoardConfig, blobId: string): string | undefined {
  if (!config.walrusAggregatorUrl) return undefined;
  return `${config.walrusAggregatorUrl.replace(/\/+$/, '')}/v1/blobs/${encodeURIComponent(blobId)}`;
}

function numberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

interface WalrusPublisherResponse {
  newlyCreated?: {
    blobObject?: {
      id?: string;
      blobId?: string;
      certifiedEpoch?: number | null;
      storage?: {
        endEpoch?: number | null;
      };
    };
  };
  alreadyCertified?: {
    blobId?: string;
    endEpoch?: number | null;
  };
}
