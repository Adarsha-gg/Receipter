import type { SuiMoveArgument, SuiReceiptAnchorPayload, SuiWalletTransactionRequest } from '../live/types.js';
import type { SuiAnchorPlan } from './anchorPlan.js';
import {
  assertConfigured,
  buildSuiWalletTransactionBase,
  objectArgument,
  pureU16,
  pureU64,
  pureUtf8Vector,
} from './walletTransactionBuilder.js';

const ANCHOR_U16_ARGUMENT_INDEXES = new Set([4, 19]);
const ANCHOR_U64_ARGUMENT_INDEXES = new Set([16, 17, 18]);

export function buildSuiReceiptAnchorTransactionRequest(plan: SuiAnchorPlan): SuiWalletTransactionRequest {
  if (!plan.ready) {
    throw new Error(`Sui anchor plan is not ready for wallet signing. Missing: ${plan.missing.join(', ')}`);
  }

  const packageId = plan.moveCall.packageId;
  const receiptRegistryId = plan.receiptRegistryId;
  const walrusBlobId = plan.walrus.blobId;
  assertConfigured('SUI_PACKAGE_ID', packageId);
  assertConfigured('SUI_RECEIPT_REGISTRY_ID', receiptRegistryId);
  assertConfigured('WALRUS_BLOB_ID', walrusBlobId);

  const target = `${packageId}::${plan.moveCall.module}::${plan.moveCall.function}`;

  return buildSuiWalletTransactionBase({
    kind: 'receipt_anchor',
    network: plan.network,
    signerRole: 'operator',
    description: `Anchor WalrusProof receipt ${anchorArgument(plan, 1)} to the Sui receipt registry.`,
    required: {
      packageId,
      receiptRegistryId,
      receiverAddress: plan.payment.receiverAddress,
      walrusBlobId,
    },
    metadata: {
      runId: anchorArgument(plan, 1),
      specHash: anchorArgument(plan, 2),
      evidenceHash: anchorArgument(plan, 3),
      paymentReference: anchorArgument(plan, 7),
      walrusBlobId,
      paymentNonce: plan.payment.paymentNonce,
      settlementNonce: plan.payment.settlementNonce,
      duplicatePreventionKey: plan.payment.duplicatePreventionKey,
      amountMist: plan.payment.amountMist,
      receiverAddress: plan.payment.receiverAddress,
      workerAgentId: plan.reputation.workerAgentId,
    },
    commands: [
      {
        kind: 'moveCall',
        target,
        arguments: plan.moveCall.arguments.map((value, index) => buildAnchorMoveArgument(value, index)),
      },
    ],
  });
}

export function buildSuiReceiptAnchorPayload(plan: SuiAnchorPlan, transaction: string): SuiReceiptAnchorPayload {
  const packageId = plan.moveCall.packageId;
  const receiptRegistryId = plan.receiptRegistryId;
  const walrusBlobId = plan.walrus.blobId;
  assertConfigured('SUI_PACKAGE_ID', packageId);
  assertConfigured('SUI_RECEIPT_REGISTRY_ID', receiptRegistryId);
  assertConfigured('WALRUS_BLOB_ID', walrusBlobId);

  return {
    objectType: 'walrusproof.sui_receipt_anchor_payload.v1',
    version: 1,
    network: `sui:${plan.network}`,
    transaction,
    runId: anchorArgument(plan, 1),
    receiptRegistryId,
    packageId,
    paymentReference: anchorArgument(plan, 7),
    walrusBlobId,
    duplicatePreventionKey: plan.payment.duplicatePreventionKey,
    workerAgentId: plan.reputation.workerAgentId,
  };
}

export function buildAnchorMoveArgument(value: string, index: number): SuiMoveArgument {
  if (index === 0) return objectArgument(value, true);
  if (ANCHOR_U16_ARGUMENT_INDEXES.has(index)) return pureU16(value);
  if (ANCHOR_U64_ARGUMENT_INDEXES.has(index)) return pureU64(value);
  return pureUtf8Vector(value);
}

function anchorArgument(plan: SuiAnchorPlan, index: number): string {
  const value = plan.moveCall.arguments[index];
  if (value === undefined) {
    throw new Error(`Sui anchor plan is missing Move argument ${index}.`);
  }
  return value;
}
