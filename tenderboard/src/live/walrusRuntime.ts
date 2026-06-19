import { createHash } from 'node:crypto';
import type { LiveRunReceipt, TenderBoardConfig } from './types.js';

export interface WalrusStoreResult {
  blobId: string;
  blobObjectId: string | undefined;
  certifiedEpoch: number | undefined;
  endEpoch: number | undefined;
  readUrl: string | undefined;
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
  privacy: LiveRunReceipt['privacy'];
  workerBidBoard: LiveRunReceipt['workerBidBoard'];
  trust: LiveRunReceipt['trustDecision'];
  verification: LiveRunReceipt['verificationManifest'];
  clearingObjects: {
    obligationObject: LiveRunReceipt['obligationObject'];
    evidenceEnvelope: LiveRunReceipt['evidenceEnvelope'];
    clearingDecision: LiveRunReceipt['clearingDecision'];
    settlementInstruction: LiveRunReceipt['settlementInstruction'];
  };
  deliveryText: string | undefined;
  events: LiveRunReceipt['events'];
}

export function buildEvidenceBundle(receipt: LiveRunReceipt): EvidenceBundle {
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
    privacy: receipt.privacy,
    workerBidBoard: receipt.workerBidBoard,
    trust: receipt.trustDecision,
    verification: receipt.verificationManifest,
    clearingObjects: {
      obligationObject: receipt.obligationObject,
      evidenceEnvelope: receipt.evidenceEnvelope,
      clearingDecision: receipt.clearingDecision,
      settlementInstruction: receipt.settlementInstruction,
    },
    deliveryText: receipt.deliveryText,
    events: receipt.events,
  };
}

export function makeEvidenceBundleText(receipt: LiveRunReceipt): string {
  return `${JSON.stringify(buildEvidenceBundle(receipt), null, 2)}\n`;
}

export function makeWalrusDevBlob(receipt: LiveRunReceipt): WalrusStoreResult {
  const hash = createHash('sha256').update(makeEvidenceBundleText(receipt)).digest('hex');
  return {
    blobId: `walrus_dev_blob_${hash.slice(0, 32)}`,
    blobObjectId: `0x${hash.slice(0, 64)}`,
    certifiedEpoch: 0,
    endEpoch: 2,
    readUrl: `walrus-dev://${hash.slice(0, 32)}`,
  };
}

export async function storeEvidenceOnWalrus(
  receipt: LiveRunReceipt,
  config: TenderBoardConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<WalrusStoreResult> {
  if (config.mode === 'sui-dev') {
    return makeWalrusDevBlob(receipt);
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
    body: makeEvidenceBundleText(receipt),
  });

  if (!response.ok) {
    throw new Error(`Walrus upload failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as WalrusPublisherResponse;
  return parseWalrusPublisherResponse(body, config);
}

function parseWalrusPublisherResponse(body: WalrusPublisherResponse, config: TenderBoardConfig): WalrusStoreResult {
  const newlyCreated = body.newlyCreated?.blobObject;
  if (newlyCreated?.blobId) {
    return {
      blobId: newlyCreated.blobId,
      blobObjectId: newlyCreated.id,
      certifiedEpoch: newlyCreated.certifiedEpoch,
      endEpoch: newlyCreated.storage?.endEpoch,
      readUrl: buildWalrusReadUrl(config, newlyCreated.blobId),
    };
  }

  const alreadyCertified = body.alreadyCertified;
  if (alreadyCertified?.blobId) {
    return {
      blobId: alreadyCertified.blobId,
      blobObjectId: undefined,
      certifiedEpoch: undefined,
      endEpoch: alreadyCertified.endEpoch,
      readUrl: buildWalrusReadUrl(config, alreadyCertified.blobId),
    };
  }

  throw new Error('Walrus upload response did not include a blob id.');
}

function buildWalrusReadUrl(config: TenderBoardConfig, blobId: string): string | undefined {
  if (!config.walrusAggregatorUrl) return undefined;
  return `${config.walrusAggregatorUrl.replace(/\/+$/, '')}/v1/blobs/${encodeURIComponent(blobId)}`;
}

interface WalrusPublisherResponse {
  newlyCreated?: {
    blobObject?: {
      id?: string;
      blobId?: string;
      certifiedEpoch?: number;
      storage?: {
        endEpoch?: number;
      };
    };
  };
  alreadyCertified?: {
    blobId?: string;
    endEpoch?: number;
  };
}
