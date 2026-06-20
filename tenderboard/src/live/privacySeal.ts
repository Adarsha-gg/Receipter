import { stableHash } from './hash.js';
import type { SealEncryptionMode, TaskDataLabel, TenderBoardConfig } from './types.js';

export type SealEncryptionProvider = 'deterministic-test' | 'seal-sdk';

export interface SealEncryptMemoryRequest {
  objectType: 'walrusproof.seal_encrypt_memory_request.v1';
  runId: string;
  workerAgentId: string;
  dataLabel: Exclude<TaskDataLabel, 'public'>;
  plaintext: string;
  aad: {
    network: string;
    packageId: string | undefined;
    receiptRegistryId: string | undefined;
    evidenceHash: string | undefined;
  };
  policy: {
    namespace: string;
    policyId: string | undefined;
  };
}

export interface SealEncryptMemoryResult {
  objectType: 'walrusproof.seal_encrypted_memory.v1';
  provider: SealEncryptionProvider;
  live: boolean;
  algorithm: string;
  policyId: string | undefined;
  plaintextHash: string;
  ciphertextHash: string;
  ciphertext: string;
}

export interface SealPrivacyEngine {
  readonly mode: SealEncryptionMode;
  encryptMemory(request: SealEncryptMemoryRequest): Promise<SealEncryptMemoryResult>;
}

export function isPrivateMemoryLabel(label: TaskDataLabel | undefined): label is Exclude<TaskDataLabel, 'public'> {
  return label === 'buyer_private' || label === 'secret';
}

export function createSealPrivacyEngine(config: TenderBoardConfig): SealPrivacyEngine {
  const mode = config.sealEncryptionMode ?? 'disabled';
  if (mode === 'deterministic-test') {
    return new DeterministicSealPrivacyEngine();
  }
  if (mode === 'sdk') {
    return new UnimplementedSealSdkPrivacyEngine();
  }
  return new DisabledSealPrivacyEngine();
}

export function buildSealEncryptMemoryRequest(
  receipt: {
    runId: string;
    workerAgentId: string;
    privacy?: { requestedDataLabel: TaskDataLabel } | undefined;
    deliveryText: string | undefined;
    workerEvidence?: unknown;
    suiNetwork: string;
    suiPackageId: string | undefined;
    suiReceiptRegistryId: string | undefined;
    verificationManifest: { evidenceHash: string | undefined };
  },
  config: TenderBoardConfig,
): SealEncryptMemoryRequest | undefined {
  const dataLabel = receipt.privacy?.requestedDataLabel;
  if (!isPrivateMemoryLabel(dataLabel)) return undefined;

  return {
    objectType: 'walrusproof.seal_encrypt_memory_request.v1',
    runId: receipt.runId,
    workerAgentId: receipt.workerAgentId,
    dataLabel,
    plaintext: JSON.stringify(
      {
        deliveryText: receipt.deliveryText,
        workerEvidence: receipt.workerEvidence,
      },
      null,
      2,
    ),
    aad: {
      network: receipt.suiNetwork,
      packageId: receipt.suiPackageId,
      receiptRegistryId: receipt.suiReceiptRegistryId,
      evidenceHash: receipt.verificationManifest.evidenceHash,
    },
    policy: {
      namespace: config.sealNamespace ?? 'walrusproof',
      policyId: config.sealPolicyId,
    },
  };
}

export async function encryptPrivateMemoryForUpload(
  receipt: Parameters<typeof buildSealEncryptMemoryRequest>[0],
  config: TenderBoardConfig,
  engine: SealPrivacyEngine = createSealPrivacyEngine(config),
): Promise<SealEncryptMemoryResult | undefined> {
  const request = buildSealEncryptMemoryRequest(receipt, config);
  if (!request) return undefined;

  if (config.mode === 'sui' && engine.mode !== 'sdk') {
    throw new Error(
      `Seal encryption is required for ${request.dataLabel} memory in TENDERBOARD_MODE=sui, but SEAL_ENCRYPTION_MODE=${engine.mode} is not a live Seal SDK integration.`,
    );
  }

  return engine.encryptMemory(request);
}

class DisabledSealPrivacyEngine implements SealPrivacyEngine {
  readonly mode = 'disabled' as const;

  async encryptMemory(request: SealEncryptMemoryRequest): Promise<SealEncryptMemoryResult> {
    throw new Error(
      `Seal encryption is disabled; refusing to upload ${request.dataLabel} memory without buyer-private encryption.`,
    );
  }
}

class UnimplementedSealSdkPrivacyEngine implements SealPrivacyEngine {
  readonly mode = 'sdk' as const;

  async encryptMemory(): Promise<SealEncryptMemoryResult> {
    throw new Error('SEAL_ENCRYPTION_MODE=sdk was selected, but the live Seal SDK adapter is not implemented in this build.');
  }
}

export class DeterministicSealPrivacyEngine implements SealPrivacyEngine {
  readonly mode = 'deterministic-test' as const;

  async encryptMemory(request: SealEncryptMemoryRequest): Promise<SealEncryptMemoryResult> {
    const plaintextHash = stableHash({
      plaintext: request.plaintext,
      aad: request.aad,
      policy: request.policy,
    });
    const ciphertextHash = stableHash({
      provider: this.mode,
      runId: request.runId,
      workerAgentId: request.workerAgentId,
      dataLabel: request.dataLabel,
      plaintextHash,
    });
    const ciphertext = Buffer.from(
      JSON.stringify({
        v: 1,
        fake: true,
        hash: ciphertextHash,
      }),
    ).toString('base64url');

    return {
      objectType: 'walrusproof.seal_encrypted_memory.v1',
      provider: this.mode,
      live: false,
      algorithm: 'deterministic-test-seal-v1',
      policyId: request.policy.policyId,
      plaintextHash,
      ciphertextHash,
      ciphertext,
    };
  }
}
