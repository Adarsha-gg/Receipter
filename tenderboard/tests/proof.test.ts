import { describe, expect, it } from 'vitest';
import { buildClearingObjects } from '../src/live/clearingObjects.js';
import { buildMemWalReputationFact, createMemWalClient, MemWalMemoryStore, WalrusMemoryStore, type MemoryStore } from '../src/live/memoryStore.js';
import { DeterministicSealPrivacyEngine } from '../src/live/privacySeal.js';
import { renderReceiptProof } from '../src/live/proof.js';
import { makeEvent } from '../src/live/runStore.js';
import { buildEvidenceBundle, selectWalrusUploadStrategy, storeEvidenceOnWalrus } from '../src/live/walrusRuntime.js';
import type { LiveRunReceipt, TenderBoardConfig } from '../src/live/types.js';

describe('renderReceiptProof', () => {
  it('renders a judge-readable Sui proof without private notes', () => {
    const proof = renderReceiptProof(sampleReceipt());

    expect(proof).toContain('# WalrusProof Memory Proof: run_proof');
    expect(proof).toContain('Sui payment digest: 0xsui');
    expect(proof).toContain('Walrus blob id: walrus_blob_1');
    expect(proof).toContain('Payment nonce: payment_nonce_proof');
    expect(proof).toContain('Payment URI: sui:pay?');
    expect(proof).toContain('PaymentKit mode: sui_pay_uri_metadata_only');
    expect(proof).toContain('Settlement nonce: settlement_nonce_proof');
    expect(proof).toContain('Amount MIST: 35000000');
    expect(proof).toContain('Trust verdict: allow');
    expect(proof).toContain('Selected worker bid: public_scout_standard');
    expect(proof).toContain('| public_scout_standard | sui_worker | 0.035 SUI | 24h | public | available |');
    expect(proof).toContain('## Market agents');
    expect(proof).toContain('Hirer agent: Sui Hirer Agent');
    expect(proof).toContain('Worker agent: Opportunity Scout Worker');
    expect(proof).toContain('Handoff status: ready_to_anchor');
    expect(proof).toContain('## Clearing objects');
    expect(proof).toContain('## Worker Reputation Passport');
    expect(proof).toContain('Anchored runs: 2');
    expect(proof).toContain('Last Walrus blob: walrus_blob_previous');
    expect(proof).toContain('Clearing verdict: ready_to_anchor');
    expect(proof).toContain('Settlement action: anchor_sui_receipt');
    expect(proof).toContain('Bound selected bid: public_scout_standard');
    expect(proof).toContain('Walrus ready: yes');
    expect(proof).toContain('Checker pack: research');
    expect(proof).toContain('Safe task only.');
    expect(proof).toContain('Spec hash: sha256:spec');
    expect(proof).toContain('Opportunity Scout Report');
    expect(proof).toContain('Source receipt: source_receipt_proof');
    expect(proof).toContain('source_hn_1');
    expect(proof).not.toContain('private strategy note');
  });

  it('includes formal clearing objects in the Walrus evidence bundle', () => {
    const bundle = buildEvidenceBundle(sampleReceipt());

    expect(bundle.paymentIntentPlan).toMatchObject({
      paymentNonce: 'payment_nonce_proof',
      settlementNonce: 'settlement_nonce_proof',
      amountMist: '35000000',
    });
    expect(bundle.receiptPlan).toMatchObject({
      paymentDigest: '0xsui',
      walrusBlobId: 'walrus_blob_1',
    });
    expect(bundle.reputationSnapshot).toMatchObject({
      workerAgentId: 'sui_worker',
      anchoredRunCount: 2,
      walrusEvidenceCount: 2,
    });
    expect(bundle.agents.agentHandoff).toMatchObject({
      hirerAgentId: 'sui_hirer.governed.buyer',
      workerAgentId: 'sui_worker',
      status: 'ready_to_anchor',
    });
    expect(bundle.clearingObjects.obligationObject?.selectedBid?.bidId).toBe('public_scout_standard');
    expect(bundle.clearingObjects.evidenceEnvelope).toMatchObject({
      evidenceHash: 'sha256:evidence',
      walrusReady: true,
      walrusBlobId: 'walrus_blob_1',
    });
    expect(bundle.clearingObjects.clearingDecision).toMatchObject({
      verdict: 'ready_to_anchor',
      walrusReady: true,
    });
    expect(bundle.clearingObjects.settlementInstruction).toMatchObject({
      action: 'anchor_sui_receipt',
      selectedBidId: 'public_scout_standard',
    });
    expect(bundle.workerEvidence?.sourceReceipt.observations[0]).toMatchObject({
      observationId: 'source_hn_1',
      source: 'hacker_news',
      record: {
        title: 'Public opportunity',
        url: 'https://example.com',
      },
    });
    expect(bundle.workerEvidence?.claims[0]?.sourceObservationId).toBe('source_hn_1');
  });

  it('stores evidence through the Walrus HTTP publisher response format', async () => {
    const uploads: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      uploads.push({ input, init });
      return new Response(
        JSON.stringify({
          newlyCreated: {
            blobObject: {
              id: '0xwalrus_object',
              blobId: 'walrus_blob_live',
              certifiedEpoch: null,
              storage: {
                endEpoch: 436,
              },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const result = await storeEvidenceOnWalrus(
      sampleReceipt(),
      {
        mode: 'sui',
        suiNetwork: 'testnet',
        suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
        suiPackageId: '0xpackage',
        suiReceiptRegistryId: '0xregistry',
        suiStakeOracleRegistryId: undefined,
        suiOperatorAddress: '0xoperator',
        walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
        walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
        suiCliPath: undefined,
        suiClientConfig: undefined,
        missingSuiSettings: [],
        port: 0,
        maxPaymentSui: '0.050',
        receiptsDir: 'memory',
        workerAgentId: 'sui_worker',
        memoryBackend: 'walrus',
        memwalDelegateKey: undefined,
        memwalAccountId: undefined,
        memwalServerUrl: undefined,
        memwalNamespace: 'walrusproof',
        safe: {
          mode: 'sui',
          port: 0,
          maxPaymentSui: '0.050',
          receiptsDir: 'memory',
          workerAgentId: 'sui_worker',
          memory: {
            backend: 'walrus',
            memwalConfigured: false,
            memwalServerConfigured: false,
            memwalAccountConfigured: false,
            memwalNamespace: 'walrusproof',
          },
          sui: {
            network: 'testnet',
            rpcUrlConfigured: true,
            packageIdConfigured: true,
            receiptRegistryIdConfigured: true,
            stakeOracleRegistryIdConfigured: false,
            operatorAddressConfigured: true,
            walrusPublisherConfigured: true,
            walrusAggregatorConfigured: true,
            suiCliConfigured: false,
            readyForSui: true,
            missingSuiSettings: [],
          },
        },
      },
      fetchImpl,
    );

    expect(String(uploads[0]!.input)).toBe('https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=2&send_object_to=0xoperator');
    expect(uploads[0]!.init?.method).toBe('PUT');
    expect(String(uploads[0]!.init?.body)).toContain('"schema": "tenderboard.sui.evidence.v1"');
    expect(result).toEqual({
      blobId: 'walrus_blob_live',
      blobObjectId: '0xwalrus_object',
      certifiedEpoch: undefined,
      endEpoch: 436,
      readUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_live',
      uploadStrategy: 'raw-walrus',
    });
  });

  it('stores evidence through the Walrus HTTP already-certified response format', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          alreadyCertified: {
            blobId: 'walrus_blob_existing',
            endEpoch: null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const result = await storeEvidenceOnWalrus(
      sampleReceipt(),
      {
        mode: 'sui',
        suiNetwork: 'testnet',
        suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
        suiPackageId: '0xpackage',
        suiReceiptRegistryId: '0xregistry',
        suiStakeOracleRegistryId: undefined,
        suiOperatorAddress: undefined,
        walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
        walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
        suiCliPath: undefined,
        suiClientConfig: undefined,
        missingSuiSettings: [],
        port: 0,
        maxPaymentSui: '0.050',
        receiptsDir: 'memory',
        workerAgentId: 'sui_worker',
        memoryBackend: 'walrus',
        memwalDelegateKey: undefined,
        memwalAccountId: undefined,
        memwalServerUrl: undefined,
        memwalNamespace: 'walrusproof',
        safe: {
          mode: 'sui',
          port: 0,
          maxPaymentSui: '0.050',
          receiptsDir: 'memory',
          workerAgentId: 'sui_worker',
          memory: {
            backend: 'walrus',
            memwalConfigured: false,
            memwalServerConfigured: false,
            memwalAccountConfigured: false,
            memwalNamespace: 'walrusproof',
          },
          sui: {
            network: 'testnet',
            rpcUrlConfigured: true,
            packageIdConfigured: true,
            receiptRegistryIdConfigured: true,
            stakeOracleRegistryIdConfigured: false,
            operatorAddressConfigured: false,
            walrusPublisherConfigured: true,
            walrusAggregatorConfigured: true,
            suiCliConfigured: false,
            readyForSui: true,
            missingSuiSettings: [],
          },
        },
      },
      fetchImpl,
    );

    expect(result).toEqual({
      blobId: 'walrus_blob_existing',
      blobObjectId: undefined,
      certifiedEpoch: undefined,
      endEpoch: undefined,
      readUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_existing',
      uploadStrategy: 'raw-walrus',
    });
  });

  it('stores evidence through the injectable Walrus memory store wrapper', async () => {
    const fetchImpl = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          alreadyCertified: {
            blobId: 'walrus_blob_from_store',
            endEpoch: 500,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    const store = new WalrusMemoryStore(
      {
        mode: 'sui',
        suiNetwork: 'testnet',
        suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
        suiPackageId: '0xpackage',
        suiReceiptRegistryId: '0xregistry',
        suiStakeOracleRegistryId: undefined,
        suiOperatorAddress: undefined,
        walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
        walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
        suiCliPath: undefined,
        suiClientConfig: undefined,
        missingSuiSettings: [],
        port: 0,
        maxPaymentSui: '0.050',
        receiptsDir: 'memory',
        workerAgentId: 'sui_worker',
        memoryBackend: 'walrus',
        memwalDelegateKey: undefined,
        memwalAccountId: undefined,
        memwalServerUrl: undefined,
        memwalNamespace: 'walrusproof',
        safe: {
          mode: 'sui',
          port: 0,
          maxPaymentSui: '0.050',
          receiptsDir: 'memory',
          workerAgentId: 'sui_worker',
          memory: {
            backend: 'walrus',
            memwalConfigured: false,
            memwalServerConfigured: false,
            memwalAccountConfigured: false,
            memwalNamespace: 'walrusproof',
          },
          sui: {
            network: 'testnet',
            rpcUrlConfigured: true,
            packageIdConfigured: true,
            receiptRegistryIdConfigured: true,
            stakeOracleRegistryIdConfigured: false,
            operatorAddressConfigured: false,
            walrusPublisherConfigured: true,
            walrusAggregatorConfigured: true,
            suiCliConfigured: false,
            readyForSui: true,
            missingSuiSettings: [],
          },
        },
      },
      fetchImpl,
    );

    await expect(store.putEvidenceBundle(sampleReceipt())).resolves.toMatchObject({
      blobId: 'walrus_blob_from_store',
      endEpoch: 500,
      readUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/walrus_blob_from_store',
    });
  });

  it('writes a distilled reputation fact to MemWal after storing the full Walrus bundle', async () => {
    const remembered: string[] = [];
    const waited: string[] = [];
    const walrusStore: MemoryStore = {
      backend: 'walrus',
      putEvidenceBundle: async () => ({
        blobId: 'walrus_blob_for_memwal',
        blobObjectId: '0xwalrus',
        certifiedEpoch: undefined,
        endEpoch: 500,
        readUrl: 'https://aggregator.walrus.testnet.example/v1/blobs/walrus_blob_for_memwal',
      }),
    };
    const store = new MemWalMemoryStore(
      walrusStore,
      {
        remember: async (text, namespace) => {
          remembered.push(`${namespace}:${text}`);
          return { job_id: 'job_1', blob_id: 'memwal_blob_1' };
        },
        waitForRememberJob: async (jobId) => {
          waited.push(jobId);
        },
      },
      'worker:sui_worker',
    );

    await expect(store.putEvidenceBundle(sampleReceipt())).resolves.toMatchObject({
      blobId: 'walrus_blob_for_memwal',
      readUrl: 'https://aggregator.walrus.testnet.example/v1/blobs/walrus_blob_for_memwal',
    });
    expect(waited).toEqual(['job_1']);
    expect(remembered[0]).toContain('worker:sui_worker:WalrusProof verified work memory for agent sui_worker.');
    expect(remembered[0]).toContain('Walrus blob: walrus_blob_for_memwal.');
    expect(remembered[0]).toContain('Sui payment digest: 0xsui.');
  });

  it('builds a MemWal SDK client from configured credentials without leaking them through safe config', () => {
    const created: any[] = [];
    const client = { remember: async () => ({ job_id: 'job_1' }) };

    expect(
      createMemWalClient(
        {
          memwalDelegateKey: 'delegate_secret',
          memwalAccountId: 'account_1',
          memwalServerUrl: 'https://memory.walrus.example',
          memwalNamespace: 'walrusproof',
        } as any,
        () => ({
          MemWal: {
            create: (options) => {
              created.push(options);
              return client;
            },
          },
        }),
      ),
    ).toBe(client);
    expect(created[0]).toEqual({
      key: 'delegate_secret',
      accountId: 'account_1',
      serverUrl: 'https://memory.walrus.example',
      namespace: 'walrusproof',
    });
  });

  it('renders the MemWal reputation fact as a searchable work-memory summary', () => {
    const fact = buildMemWalReputationFact(sampleReceipt(), {
      blobId: 'walrus_blob_fact',
      blobObjectId: undefined,
      certifiedEpoch: undefined,
      endEpoch: undefined,
      readUrl: 'https://aggregator.example/v1/blobs/walrus_blob_fact',
    });

    expect(fact).toContain('WalrusProof verified work memory for agent sui_worker.');
    expect(fact).toContain('Run: run_proof.');
    expect(fact).toContain('Walrus blob: walrus_blob_fact.');
    expect(fact).toContain('Claim verification: 0 supported, 0 failed.');
  });

  it('selects the active raw Walrus or Harbor upload path explicitly', () => {
    expect(selectWalrusUploadStrategy(testWalrusConfig())).toMatchObject({
      strategy: 'raw-walrus',
      live: true,
      configured: true,
    });
    expect(
      selectWalrusUploadStrategy(
        testWalrusConfig({
          walrusUploadStrategy: 'harbor',
          harborUploadUrl: 'https://harbor.example/upload',
        }),
      ),
    ).toMatchObject({
      strategy: 'harbor',
      live: false,
      configured: true,
    });
  });

  it('fails loudly if Harbor upload is selected before a Harbor adapter exists', async () => {
    await expect(
      storeEvidenceOnWalrus(
        sampleReceipt(),
        testWalrusConfig({
          walrusUploadStrategy: 'harbor',
          harborUploadUrl: 'https://harbor.example/upload',
        }),
      ),
    ).rejects.toThrow('Harbor upload adapter is not implemented');
  });

  it('redacts buyer-private memory behind deterministic Seal test encryption in dev uploads', async () => {
    const privateReceipt = {
      ...sampleReceipt(),
      mode: 'sui-dev' as const,
      privacy: {
        requestedDataLabel: 'buyer_private' as const,
        privateNotesProvided: true,
        workerDataBoundary: 'Buyer-private memory must be encrypted before upload.',
      },
      deliveryText: 'buyer private acquisition strategy',
    };

    const result = await storeEvidenceOnWalrus(
      privateReceipt,
      testWalrusConfig({
        mode: 'sui-dev',
        sealEncryptionMode: 'deterministic-test',
      }),
      fetch,
      new DeterministicSealPrivacyEngine(),
    );
    const bundle = buildEvidenceBundle(privateReceipt, result.privacyEncryption);
    const bundleText = JSON.stringify(bundle);

    expect(result.uploadStrategy).toBe('walrus-dev');
    expect(result.privacyEncryption).toMatchObject({
      provider: 'deterministic-test',
      live: false,
      algorithm: 'deterministic-test-seal-v1',
    });
    expect(bundle.deliveryText).toBeUndefined();
    expect(bundle.workerEvidence).toBeUndefined();
    expect(bundleText).not.toContain('buyer private acquisition strategy');
  });

  it('refuses buyer-private production uploads without a live Seal SDK integration', async () => {
    await expect(
      storeEvidenceOnWalrus(
        {
          ...sampleReceipt(),
          privacy: {
            requestedDataLabel: 'buyer_private',
            privateNotesProvided: true,
            workerDataBoundary: 'Buyer-private memory must be encrypted before upload.',
          },
        },
        testWalrusConfig({ sealEncryptionMode: 'disabled' }),
      ),
    ).rejects.toThrow('Seal encryption is required for buyer_private memory in TENDERBOARD_MODE=sui');
  });
});

function testWalrusConfig(overrides: Partial<TenderBoardConfig> = {}): TenderBoardConfig {
  return {
    mode: 'sui',
    suiNetwork: 'testnet',
    suiRpcUrl: 'https://fullnode.testnet.sui.io:443',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiStakeOracleRegistryId: undefined,
    suiOperatorAddress: '0xoperator',
    walrusPublisherUrl: 'https://publisher.walrus-testnet.walrus.space',
    walrusAggregatorUrl: 'https://aggregator.walrus-testnet.walrus.space',
    walrusUploadStrategy: 'raw-walrus',
    harborUploadUrl: undefined,
    suiCliPath: undefined,
    suiClientConfig: undefined,
    missingSuiSettings: [],
    port: 0,
    maxPaymentSui: '0.050',
    receiptsDir: 'memory',
    workerAgentId: 'sui_worker',
    memoryBackend: 'walrus',
    memwalDelegateKey: undefined,
    memwalAccountId: undefined,
    memwalServerUrl: undefined,
    memwalNamespace: 'walrusproof',
    sealEncryptionMode: 'disabled',
    sealPolicyId: undefined,
    sealNamespace: 'walrusproof',
    safe: {
      mode: 'sui',
      port: 0,
      maxPaymentSui: '0.050',
      receiptsDir: 'memory',
      workerAgentId: 'sui_worker',
      memory: {
        backend: 'walrus',
        memwalConfigured: false,
        memwalReady: false,
        missingMemwalSettings: ['MEMWAL_DELEGATE_KEY', 'MEMWAL_ACCOUNT_ID', 'MEMWAL_SERVER_URL'],
        memwalServerConfigured: false,
        memwalAccountConfigured: false,
        memwalNamespace: 'walrusproof',
        sealEncryptionMode: 'disabled',
        sealLiveConfigured: false,
        sealPolicyConfigured: false,
      },
      sui: {
        network: 'testnet',
        rpcUrlConfigured: true,
        packageIdConfigured: true,
        receiptRegistryIdConfigured: true,
        stakeOracleRegistryIdConfigured: false,
        operatorAddressConfigured: true,
        walrusPublisherConfigured: true,
        walrusAggregatorConfigured: true,
        suiCliConfigured: false,
        readyForSui: true,
        missingSuiSettings: [],
      },
      walrus: {
        uploadStrategy: 'raw-walrus',
        harborUploadConfigured: false,
      },
    },
    ...overrides,
  };
}

function sampleReceipt(): LiveRunReceipt {
  const receipt: LiveRunReceipt = {
    runId: 'run_proof',
    mode: 'sui',
    status: 'delivered',
    createdAt: '2026-06-19T20:00:00.000Z',
    updatedAt: '2026-06-19T20:05:00.000Z',
    taskTitle: 'Find opportunities',
    sanitizedTask: 'Task: Find opportunities',
    privacy: {
      requestedDataLabel: 'public',
      privateNotesProvided: true,
      workerDataBoundary: 'Only public task instructions and acceptance criteria may be sent to worker bidders.',
    },
    maxPayment: { amount: '0.050', currency: 'SUI' },
    workerBidBoard: {
      buyerMaxPayment: { amount: '0.050', currency: 'SUI' },
      requestedDataLabel: 'public',
      selectedBidId: 'public_scout_standard',
      bids: [
        {
          bidId: 'public_scout_standard',
          workerAgentId: 'sui_worker',
          priceSui: '0.035',
          sla: '24h',
          requestedDataLabel: 'public',
          riskFlags: [],
          verdict: 'available',
          reason: 'Bid is within the SUI budget and only asks for public worker data.',
        },
      ],
    },
    hirerAgent: {
      objectType: 'suiproof.market_agent.v1',
      agentId: 'sui_hirer.governed.buyer',
      role: 'hirer',
      displayName: 'Sui Hirer Agent',
      responsibilities: ['Define the job.', 'Publish only safe packet.', 'Approve proof-gated payment.'],
      controls: ['Private notes stay local.', 'Bids must fit budget.', 'Reputation waits for anchor.'],
      budgetSui: '0.050',
      priceSui: undefined,
      requestedDataLabel: 'public',
    },
    workerAgent: {
      objectType: 'suiproof.market_agent.v1',
      agentId: 'sui_worker',
      role: 'worker',
      displayName: 'Opportunity Scout Worker',
      responsibilities: ['Bid on the task.', 'Return public-source evidence.', 'Produce source receipts.'],
      controls: ['Sanitized task only.', 'No buyer-private data.', 'Receipt-bound payment.'],
      budgetSui: undefined,
      priceSui: '0.035',
      requestedDataLabel: 'public',
    },
    agentHandoff: {
      objectType: 'suiproof.agent_handoff.v1',
      handoffId: 'handoff_proof',
      hirerAgentId: 'sui_hirer.governed.buyer',
      workerAgentId: 'sui_worker',
      selectedBidId: 'public_scout_standard',
      safePacketHash: 'sha256:safe_packet',
      specHash: 'sha256:spec',
      paymentIntentId: 'payment_intent_run_proof',
      status: 'ready_to_anchor',
    },
    trustDecision: {
      workerAgentId: 'sui_worker',
      score: 91,
      tier: 'AA',
      verdict: 'allow',
      pricedMultiplier: 1,
      reasons: ['No secret-looking lines were found in the public worker packet.'],
      controls: ['Sui payment approval is bound to the exact work order before delivery.'],
    },
    verificationManifest: {
      specHash: 'sha256:spec',
      evidenceHash: 'sha256:evidence',
      checkerPack: 'research',
      acceptanceCriteria: ['Safe task only.'],
      requiredChecks: [
        { id: 'safe_packet', label: 'Safe worker packet', status: 'passed', detail: 'No forbidden secret pattern remains.' },
      ],
      settlementRule: 'Release after Sui approval and delivery.',
      reputationWriteback: 'Use receipt as Sui feedback.',
    },
    paymentIntentPlan: {
      objectType: 'tenderboard.payment_intent_plan.v1',
      intentId: 'payment_intent_run_proof',
      paymentNonce: 'payment_nonce_proof',
      settlementNonce: 'settlement_nonce_proof',
      amountMist: '35000000',
      amountSui: '0.035',
      coinType: '0x2::sui::SUI',
      receiverAddress: '0xoperator',
      operatorAddress: '0xoperator',
      selectedBid: {
        bidId: 'public_scout_standard',
        workerAgentId: 'sui_worker',
        priceSui: '0.035',
        sla: '24h',
        requestedDataLabel: 'public',
      },
      specHash: 'sha256:spec',
      expectedNetwork: 'testnet',
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000&coinType=0x2%3A%3Asui%3A%3ASUI&paymentNonce=payment_nonce_proof&network=testnet&runId=run_proof',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      expiresAt: '2026-06-20T20:00:00.000Z',
      createdAt: '2026-06-19T20:00:00.000Z',
    },
    receiptPlan: {
      objectType: 'tenderboard.receipt_plan.v1',
      intentId: 'payment_intent_run_proof',
      paymentNonce: 'payment_nonce_proof',
      settlementNonce: 'settlement_nonce_proof',
      duplicatePreventionKey: 'testnet:payment_intent_run_proof:payment_nonce_proof:settlement_nonce_proof',
      amountMist: '35000000',
      amountSui: '0.035',
      coinType: '0x2::sui::SUI',
      receiverAddress: '0xoperator',
      operatorAddress: '0xoperator',
      selectedBidId: 'public_scout_standard',
      workerAgentId: 'sui_worker',
      specHash: 'sha256:spec',
      expectedNetwork: 'testnet',
      paymentUri: 'sui:pay?recipient=0xoperator&amountMist=35000000&coinType=0x2%3A%3Asui%3A%3ASUI&paymentNonce=payment_nonce_proof&network=testnet&runId=run_proof',
      paymentKitMode: 'sui_pay_uri_metadata_only',
      paymentKitCompatibility: 'sui:pay-uri-v1',
      paymentDigest: '0xsui',
      walrusBlobId: 'walrus_blob_1',
      walrusBlobObjectId: '0xwalrus',
      walrusCertifiedEpoch: 10,
      walrusEndEpoch: 12,
      walrusReadUrl: 'https://aggregator.walrus.testnet.example/v1/blobs/walrus_blob_1',
      anchorDigest: undefined,
      updatedAt: '2026-06-19T20:05:00.000Z',
    },
    workerAgentId: 'sui_worker',
    workOrderId: 'sui_work_order_1',
    suiNetwork: 'testnet',
    suiPackageId: '0xpackage',
    suiReceiptRegistryId: '0xregistry',
    suiWorkOrderObjectId: '0xworkorder',
    suiEscrowObjectId: '0xescrow',
    suiPaymentDigest: '0xsui',
    suiAnchorDigest: undefined,
    walrusBlobId: 'walrus_blob_1',
    walrusBlobObjectId: '0xwalrus',
    walrusCertifiedEpoch: 10,
    walrusEndEpoch: 12,
    walrusReadUrl: 'https://aggregator.walrus.testnet.example/v1/blobs/walrus_blob_1',
    reputationSnapshot: {
      objectType: 'tenderboard.worker_reputation_passport.v1',
      workerAgentId: 'sui_worker',
      generatedAt: '2026-06-19T20:05:00.000Z',
      anchoredRunCount: 2,
      walrusEvidenceCount: 2,
      sourceEvidenceCount: 4,
      memoryCount: 2,
      averageClaimSupport: 91.5,
      averageTrustScore: 90.5,
      tierCounts: { AAA: 0, AA: 2, A: 0, B: 0, C: 0 },
      totalMistEarned: '70000000',
      totalSuiEarned: '0.07',
      lastAnchoredRunId: 'run_previous',
      lastAnchoredAt: '2026-06-19T19:00:00.000Z',
      lastWalrusBlobId: 'walrus_blob_previous',
      lastMemoryId: 'memory_previous',
      lastEvidenceHash: 'sha256:previous',
      lastAnchorDigest: '0xprevious_anchor',
    },
    deliveryText: 'Opportunity Scout Report\nLink: https://example.com',
    workerEvidence: {
      schema: 'tenderboard.scout_evidence.v1',
      generatedAt: '2026-06-19T20:04:00.000Z',
      query: 'Find opportunities',
      sourceReceipt: {
        schema: 'tenderboard.source_receipt.v1',
        receiptId: 'source_receipt_proof',
        generatedAt: '2026-06-19T20:04:00.000Z',
        query: 'Find opportunities',
        observations: [
          {
            observationId: 'source_hn_1',
            source: 'hacker_news',
            sourceLabel: 'Hacker News',
            endpoint: 'https://hn.algolia.com/api/v1/search?query=Find%20opportunities&tags=story',
            query: 'Find opportunities',
            observedAt: '2026-06-19T20:04:00.000Z',
            title: 'Public opportunity',
            url: 'https://example.com',
            score: 10,
            publishedAt: '2026-06-18T00:00:00.000Z',
            recordHash: 'sha256:record',
            record: {
              title: 'Public opportunity',
              url: 'https://example.com',
              points: 10,
            },
          },
        ],
        warnings: [],
        receiptHash: 'sha256:source_receipt',
      },
      claims: [
        {
          claimId: 'claim_1_source_hn_1',
          resultIndex: 1,
          title: 'Public opportunity',
          url: 'https://example.com',
          sourceObservationId: 'source_hn_1',
          statement: 'Hacker News result "Public opportunity" was used in the rendered Opportunity Scout report.',
        },
      ],
      evidenceHash: 'sha256:worker_evidence',
    },
    error: undefined,
    events: [makeEvent({ source: 'sui', type: 'sui_dev_payment_recorded', message: 'Sui dev payment digest recorded.' })],
  };
  return {
    ...receipt,
    ...buildClearingObjects(receipt),
  };
}
