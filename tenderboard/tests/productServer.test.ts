import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadTenderBoardConfig } from '../src/live/config.js';
import type { MemoryStore } from '../src/live/memoryStore.js';
import { RunStore } from '../src/live/runStore.js';
import { makeSuiDevDigest } from '../src/live/suiRuntime.js';
import { stableHash } from '../src/live/hash.js';
import type { LiveRunReceipt, ScoutEvidence, X402SuiPaymentPayload } from '../src/live/types.js';
import { createTenderBoardServer } from '../src/server/httpServer.js';
import { fakeScoutFetch } from './helpers/fakeScoutFetch.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tenderboard-server-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('WalrusProof product server', () => {
  it('serves Sui readiness without exposing private env values', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      PRIVATE_KEY: 'do_not_leak',
    });

    try {
      const response = await fetch(`${baseUrl}/api/config`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(text).toContain('readyForSui');
      expect(text).toContain('packageIdConfigured');
      expect(text).not.toContain('do_not_leak');
    } finally {
      await close();
    }
  });

  it('creates a Sui work order without storing private notes', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Write Sui launch checklist',
        instructions: 'Make it useful.',
        acceptanceCriteria: ['Return three concrete Sui launch steps.', 'Include owner and risk for each step.'],
        checkerPack: 'research',
        requestedDataLabel: 'public',
        privateNotes: 'do not send this field to the worker',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const receiptResponse = await fetch(`${baseUrl}/api/runs/${created.runId}`);
      const receiptText = await receiptResponse.text();
      const receipt = JSON.parse(receiptText);

      expect(created.status).toBe('awaiting_payment_approval');
      expect(created.sanitizedTask).toContain('Write Sui launch checklist');
      expect(receiptText).not.toContain('do not send this field');
      expect(receiptText).toContain('sui_work_order_created');
      expect(receipt.paymentIntentPlan).toMatchObject({
        intentId: `payment_intent_${created.runId}`,
        amountMist: '35000000',
        amountSui: '0.035',
        coinType: '0x2::sui::SUI',
        receiverAddress: '<SUI_OPERATOR_ADDRESS>',
        expectedNetwork: 'testnet',
        paymentKitMode: 'sui_pay_uri_metadata_only',
        paymentKitCompatibility: 'sui:pay-uri-v1',
      });
      expect(receipt.paymentIntentPlan.paymentUri).toContain('sui:pay?');
      expect(receipt.paymentIntentPlan.paymentUri).toContain('amountMist=35000000');
      expect(receipt.paymentIntentPlan.paymentUri).toContain('coinType=0x2%3A%3Asui%3A%3ASUI');
      expect(receipt.paymentIntentPlan.paymentUri).toContain(`nonce=${receipt.paymentIntentPlan.paymentNonce}`);
      expect(receipt.paymentIntentPlan.paymentUri).toContain('label=WalrusProof');
      expect(receipt.paymentIntentPlan.paymentUri).toContain('message=WalrusProof+agent+memory+payment');
      expect(receipt.paymentIntentPlan.paymentUri).toContain(`runId=${created.runId}`);
      expect(receipt.paymentIntentPlan.paymentUri).toContain('selectedBidId=public_scout_standard');
      expect(receipt.paymentIntentPlan.paymentUri).not.toContain('Make%20it%20useful');
      expect(receipt.paymentIntentPlan.paymentUri).not.toContain('do_not_leak');
      expect(receipt.paymentIntentPlan.paymentNonce).toMatch(/^pay_[0-9a-f]{32}$/);
      expect(receipt.paymentIntentPlan.paymentNonce.length).toBeLessThanOrEqual(36);
      expect(receipt.paymentIntentPlan.settlementNonce).toMatch(/^set_[0-9a-f]{32}$/);
      expect(receipt.paymentIntentPlan.settlementNonce.length).toBeLessThanOrEqual(36);
      expect(receipt.receiptPlan).toMatchObject({
        intentId: receipt.paymentIntentPlan.intentId,
        paymentNonce: receipt.paymentIntentPlan.paymentNonce,
        settlementNonce: receipt.paymentIntentPlan.settlementNonce,
        amountMist: '35000000',
        selectedBidId: 'public_scout_standard',
        paymentUri: receipt.paymentIntentPlan.paymentUri,
        paymentKitMode: 'sui_pay_uri_metadata_only',
      });
      expect(receipt.receiptPlan.paymentDigest).toBeUndefined();
      expect(receipt.reputationSnapshot).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        anchoredRunCount: 0,
        walrusEvidenceCount: 0,
      });
      expect(receipt.hirerAgent).toMatchObject({
        role: 'hirer',
        displayName: 'Sui Hirer Agent',
        budgetSui: '0.050',
      });
      expect(receipt.workerAgent).toMatchObject({
        role: 'worker',
        displayName: 'Opportunity Scout Worker',
        priceSui: '0.035',
      });
      expect(receipt.agentHandoff).toMatchObject({
        hirerAgentId: receipt.hirerAgent.agentId,
        workerAgentId: receipt.workerAgent.agentId,
        selectedBidId: 'public_scout_standard',
        paymentIntentId: receipt.paymentIntentPlan.intentId,
        status: 'awaiting_payment',
      });
      expect(receiptText).toContain('trustDecision');
      expect(receiptText).toContain('verificationManifest');
      expect(receiptText).toContain('workerBidBoard');
      expect(receiptText).toContain('obligationObject');
      expect(receiptText).toContain('evidenceEnvelope');
      expect(receiptText).toContain('clearingDecision');
      expect(receiptText).toContain('settlementInstruction');
      expect(receiptText).toContain('public_sources');
    } finally {
      await close();
    }
  });

  it('makes safe worker bids available and blocks over-budget and unsafe-data bids', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Source Sui builder opportunities',
        instructions: 'Use public sources only.',
        requestedDataLabel: 'public',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      const bids = receipt.workerBidBoard.bids;

      expect(receipt.privacy).toMatchObject({
        requestedDataLabel: 'public',
        privateNotesProvided: false,
      });
      expect(receipt.workerBidBoard.selectedBidId).toBe('public_scout_standard');
      expect(receipt.obligationObject.selectedBid).toMatchObject({
        bidId: 'public_scout_standard',
        requestedDataLabel: 'public',
      });
      expect(receipt.obligationObject.acceptanceCriteria).toContain('Worker must only receive the sanitized task packet.');
      expect(receipt.evidenceEnvelope).toMatchObject({
        deliveryPresent: false,
        walrusReady: false,
        requestedDataLabel: 'public',
      });
      expect(receipt.clearingDecision).toMatchObject({
        verdict: 'pending_delivery',
        walrusReady: false,
      });
      expect(receipt.settlementInstruction).toMatchObject({
        action: 'hold_payment',
        selectedBidId: 'public_scout_standard',
      });
      expect(bids.find((bid: any) => bid.bidId === 'public_scout_standard')).toMatchObject({
        priceSui: '0.035',
        requestedDataLabel: 'public',
        verdict: 'available',
      });
      expect(bids.find((bid: any) => bid.bidId === 'public_scout_expedited')).toMatchObject({
        priceSui: '0.075',
        verdict: 'blocked',
      });
      expect(bids.find((bid: any) => bid.bidId === 'public_scout_expedited').riskFlags).toContain('over_budget');
      expect(bids.find((bid: any) => bid.bidId === 'context_scout_private')).toMatchObject({
        requestedDataLabel: 'buyer_private',
        verdict: 'blocked',
      });
      expect(bids.find((bid: any) => bid.bidId === 'context_scout_private').riskFlags).toContain('unsafe_data_request');
    } finally {
      await close();
    }
  });

  it('blocks worker sourcing when the buyer labels the task data unsafe for workers', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const response = await fetch(`${baseUrl}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Use private CRM notes',
          instructions: 'Summarize private buyer notes.',
          requestedDataLabel: 'buyer_private',
          maxPayment: { amount: '0.050', currency: 'SUI' },
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('No safe worker bid is available');
      expect(body.error).toContain('buyer-private');
    } finally {
      await close();
    }
  });

  it('verifies Sui dev x402 payment payloads and blocks mismatches and replay', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Pay worker through x402',
        instructions: 'Use public sources only.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });
      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      const payload = buildX402Payload(receipt, {
        transaction: makeSuiDevDigest('payment', created.runId),
      });

      const mismatchResponse = await fetch(`${baseUrl}/api/x402/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, paymentNonce: 'wrong_nonce' }),
      });
      const mismatch = await mismatchResponse.json();
      expect(mismatchResponse.status).toBe(402);
      expect(mismatch.error).toContain('payment nonce mismatch');

      const paidWorkerTaskResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-task`, {
        headers: { 'X-Payment': JSON.stringify(payload) },
      });
      const paidWorkerTask = await paidWorkerTaskResponse.json();
      const xPaymentResponse = JSON.parse(paidWorkerTaskResponse.headers.get('x-payment-response') ?? '{}');

      expect(paidWorkerTaskResponse.status).toBe(200);
      expect(paidWorkerTask.status).toBe('working');
      expect(paidWorkerTask.agentHandoff.status).toBe('working');
      expect(xPaymentResponse).toMatchObject({
        facilitator: 'suiproof-sui-x402',
        transaction: payload.transaction,
        paymentNonce: payload.paymentNonce,
      });

      const after = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      expect(after.suiPaymentDigest).toBe(payload.transaction);
      expect(after.receiptPlan.paymentDigest).toBe(payload.transaction);
      expect(JSON.stringify(after.events)).toContain('x402_payment_verified');
      expect(JSON.stringify(after.events)).toContain('sui_dev_x402_payment_settled');

      const replayResponse = await fetch(`${baseUrl}/api/x402/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const replay = await replayResponse.json();
      expect(replayResponse.status).toBe(409);
      expect(replay.error).toContain('already been verified');
    } finally {
      await close();
    }
  });

  it('verifies real Sui x402 payments through Sui JSON-RPC', async () => {
    const rpcCalls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    let currentPaymentMarker: Record<string, string> = {};
    const suiRpcFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      rpcCalls.push({ input, init });
      const request = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            digest: request.params[0],
            effects: {
              status: { status: 'success' },
            },
            balanceChanges: [
              {
                owner: { AddressOwner: '0xoperator' },
                coinType: '0x2::sui::SUI',
                amount: '35000000',
              },
            ],
            events: [
              {
                type: '0xpackage::receipts::PaymentIntentRecorded',
                parsedJson: currentPaymentMarker,
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };
    const { baseUrl, close } = await startTestServer(
      {
        TENDERBOARD_MODE: 'sui',
        TENDERBOARD_RECEIPTS_DIR: tempDir,
        SUI_NETWORK: 'testnet',
        SUI_RPC_URL: 'https://sui-rpc.test',
        SUI_OPERATOR_ADDRESS: '0xoperator',
        SUI_PACKAGE_ID: '0xpackage',
        SUI_RECEIPT_REGISTRY_ID: '0xregistry',
        WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
        WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      },
      { suiRpcFetch: async (input, init) => {
        const response = await suiRpcFetch(input, init);
        const request = JSON.parse(String(init?.body));
        const body = await response.json();
        body.result.digest = request.params[0];
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } },
    );

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Verify on Sui RPC',
        instructions: 'Use public sources only.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });
      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      const signingRequest = await (await fetch(`${baseUrl}/api/runs/${created.runId}/payment-transaction`)).json();
      expect(signingRequest).toMatchObject({
        objectType: 'walrusproof.payment_signing_request.v1',
        runId: created.runId,
        verifyEndpoint: '/api/x402/verify',
        walletTransactionRequest: {
          objectType: 'walrusproof.sui_wallet_transaction_request.v1',
          kind: 'x402_payment',
          walletStandard: 'sui:signAndExecuteTransaction',
        },
        paymentPayloadTemplate: {
          objectType: 'suiproof.x402_sui_payment_payload.v1',
          transaction: '<SIGNED_SUI_TRANSACTION_DIGEST>',
          runId: created.runId,
        },
      });

      const rawDigestResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiPaymentDigest: '0xunverified_digest' }),
      });
      const rawDigestBody = await rawDigestResponse.json();
      expect(rawDigestResponse.status).toBe(400);
      expect(rawDigestBody.error).toContain('no longer accepts raw suiPaymentDigest');

      currentPaymentMarker = {
        run_id: receipt.runId,
        resource: `/api/runs/${receipt.runId}/worker-task`,
        payment_intent_id: receipt.paymentIntentPlan.intentId,
        payment_nonce: receipt.paymentIntentPlan.paymentNonce,
        settlement_nonce: receipt.paymentIntentPlan.settlementNonce,
        amount_mist: receipt.paymentIntentPlan.amountMist,
        receiver: receipt.paymentIntentPlan.receiverAddress,
        worker_agent_id: receipt.workerAgentId,
      };
      const payload = buildX402Payload(receipt, { transaction: '0xsui_payment_digest' });

      const verified = await postJson(`${baseUrl}/api/x402/verify`, payload);

      expect(verified.verification).toMatchObject({
        facilitator: 'suiproof-sui-x402',
        ok: true,
        transaction: '0xsui_payment_digest',
        checks: {
          suiSettlementVerified: true,
          replayProtected: true,
        },
      });
      expect(verified.receipt.status).toBe('working');
      expect(verified.receipt.suiPaymentDigest).toBe('0xsui_payment_digest');
      expect(rpcCalls.length).toBe(1);
      expect(rpcCalls[0]!.input).toBe('https://sui-rpc.test');
      expect(String(rpcCalls[0]!.init?.body)).toContain('sui_getTransactionBlock');
      expect(String(rpcCalls[0]!.init?.body)).toContain('0xsui_payment_digest');
    } finally {
      await close();
    }
  });

  it('verifies real Sui receipt anchors through a signed anchor payload', async () => {
    let currentPaymentMarker: Record<string, string> = {};
    let currentAnchorMarker: Record<string, string> = {};
    let currentReputationMarker: Record<string, string> = {};
    const rpcCalls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const { baseUrl, close } = await startTestServer(
      {
        TENDERBOARD_MODE: 'sui',
        TENDERBOARD_RECEIPTS_DIR: tempDir,
        SUI_NETWORK: 'testnet',
        SUI_RPC_URL: 'https://sui-rpc.test',
        SUI_OPERATOR_ADDRESS: '0xoperator',
        SUI_PACKAGE_ID: '0xpackage',
        SUI_RECEIPT_REGISTRY_ID: '0xregistry',
        WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
        WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      },
      {
        suiRpcFetch: async (input, init) => {
          rpcCalls.push({ input, init });
          const request = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                digest: request.params[0],
                effects: { status: { status: 'success' } },
                balanceChanges: [
                  {
                    owner: { AddressOwner: '0xoperator' },
                    coinType: '0x2::sui::SUI',
                    amount: '35000000',
                  },
                ],
                events:
                  request.params[0] === '0xpayment_digest'
                    ? [
                        {
                          type: '0xpackage::receipts::PaymentIntentRecorded',
                          parsedJson: currentPaymentMarker,
                        },
                      ]
                    : [
                        {
                          type: '0xpackage::receipts::ReceiptAnchored',
                          parsedJson: currentAnchorMarker,
                        },
                        {
                          type: '0xpackage::receipts::WorkerReputationUpdated',
                          parsedJson: currentReputationMarker,
                        },
                      ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
        memoryStore: {
          backend: 'walrus' as const,
          async putEvidenceBundle(receipt) {
            return {
              blobId: `test_blob_${receipt.runId}`,
              blobObjectId: '0xwalrusblob',
              certifiedEpoch: 1,
              endEpoch: 53,
              readUrl: `https://aggregator.walrus.testnet.example/v1/blobs/test_blob_${receipt.runId}`,
            };
          },
        },
      },
    );

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Anchor through wallet payload',
        instructions: 'Use public sources only.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });
      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      currentPaymentMarker = {
        run_id: receipt.runId,
        resource: `/api/runs/${receipt.runId}/worker-task`,
        payment_intent_id: receipt.paymentIntentPlan.intentId,
        payment_nonce: receipt.paymentIntentPlan.paymentNonce,
        settlement_nonce: receipt.paymentIntentPlan.settlementNonce,
        amount_mist: receipt.paymentIntentPlan.amountMist,
        receiver: receipt.paymentIntentPlan.receiverAddress,
        worker_agent_id: receipt.workerAgentId,
      };
      const paid = await postJson(`${baseUrl}/api/x402/verify`, buildX402Payload(receipt, { transaction: '0xpayment_digest' }));
      const delivered = await postJson(`${baseUrl}/api/runs/${created.runId}/worker-delivery`, {
        objectType: 'walrusproof.external_worker_delivery.v1',
        version: 1,
        runId: created.runId,
        workerAgentId: paid.receipt.workerAgentId,
        deliveryText: 'Supported claim: WalrusProof can anchor signed receipt payloads.',
        sourceEvidence: buildSourceEvidence(created.runId),
      });
      const stored = await postJson(`${baseUrl}/api/runs/${created.runId}/store-evidence`, {});
      const signingRequest = await (await fetch(`${baseUrl}/api/runs/${created.runId}/anchor-transaction`)).json();
      expect(signingRequest).toMatchObject({
        objectType: 'walrusproof.anchor_signing_request.v1',
        runId: created.runId,
        verifyEndpoint: `/api/runs/${created.runId}/anchor-receipt`,
        walletTransactionRequest: {
          objectType: 'walrusproof.sui_wallet_transaction_request.v1',
          kind: 'receipt_anchor',
        },
        anchorPayloadTemplate: {
          objectType: 'walrusproof.sui_receipt_anchor_payload.v1',
          transaction: '<SIGNED_SUI_TRANSACTION_DIGEST>',
          runId: created.runId,
          walrusBlobId: stored.walrusBlobId,
        },
      });

      const rawDigestResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/anchor-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiAnchorDigest: '0xunverified_anchor' }),
      });
      const rawDigestBody = await rawDigestResponse.json();
      expect(rawDigestResponse.status).toBe(400);
      expect(rawDigestBody.error).toContain('no longer accepts raw suiAnchorDigest');

      const anchorPayload = {
        ...signingRequest.anchorPayloadTemplate,
        transaction: '0xanchor_digest',
      };
      currentAnchorMarker = {
        run_id: created.runId,
        payment_reference: '0xpayment_digest',
        walrus_blob_id: stored.walrusBlobId,
        duplicate_prevention_key: stored.receiptPlan.duplicatePreventionKey,
      };
      currentReputationMarker = {
        worker_agent_id: stored.workerAgentId,
        last_run_id: created.runId,
        last_walrus_blob_id: stored.walrusBlobId,
      };

      const anchored = await postJson(`${baseUrl}/api/runs/${created.runId}/anchor-receipt`, { anchorPayload });

      expect(delivered.status).toBe('delivered');
      expect(anchored.status).toBe('anchored');
      expect(anchored.suiAnchorDigest).toBe('0xanchor_digest');
      expect(anchored.receiptPlan.anchorDigest).toBe('0xanchor_digest');
      expect(JSON.stringify(anchored.events)).toContain('walrusproof.sui_anchor_verification.v1');
      expect(rpcCalls.some((call) => String(call.init?.body).includes('0xanchor_digest'))).toBe(true);
    } finally {
      await close();
    }
  });

  it('builds and verifies signer-controlled stake transactions', async () => {
    const rpcCalls: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
    const { baseUrl, close } = await startTestServer(
      {
        TENDERBOARD_MODE: 'sui',
        TENDERBOARD_RECEIPTS_DIR: tempDir,
        SUI_NETWORK: 'testnet',
        SUI_RPC_URL: 'https://sui-rpc.test',
        SUI_OPERATOR_ADDRESS: '0xoperator',
        SUI_PACKAGE_ID: '0x1234',
        SUI_RECEIPT_REGISTRY_ID: '0xregistry',
        WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
        WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      },
      {
        suiRpcFetch: async (input, init) => {
          rpcCalls.push({ input, init });
          const request = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                digest: request.params[0],
                effects: { status: { status: 'success' } },
                events: [
                  {
                    type: '0x1234::reputation_stake::StakeOpened',
                    parsedJson: {
                      worker_agent_id: 'sui_opportunity_scout',
                      amount_mist: '1000000000',
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
      },
    );

    try {
      const signingRequest = await postJson(`${baseUrl}/api/stake/open-transaction`, {
        workerAgentId: 'sui_opportunity_scout',
        amountMist: '1000000000',
      });

      expect(signingRequest).toMatchObject({
        objectType: 'walrusproof.stake_signing_request.v1',
        verifyEndpoint: '/api/stake/verify',
        walletTransactionRequest: {
          objectType: 'walrusproof.sui_stake_wallet_transaction_request.v1',
          kind: 'open_stake',
          function: 'open_position',
          expected: {
            events: ['StakeOpened'],
            digestRequired: true,
          },
        },
        executionPayloadTemplate: {
          objectType: 'walrusproof.sui_stake_execution_payload.v1',
          transaction: '<SIGNED_SUI_TRANSACTION_DIGEST>',
        },
      });

      const verification = await postJson(`${baseUrl}/api/stake/verify`, {
        ...signingRequest.executionPayloadTemplate,
        transaction: '0xstake_digest',
      });

      expect(verification).toMatchObject({
        objectType: 'walrusproof.sui_stake_execution_verification.v1',
        ok: true,
        kind: 'open_stake',
        transaction: '0xstake_digest',
        checks: {
          requestBound: true,
          transactionSuccessful: true,
          expectedEventsObserved: true,
        },
      });
      expect(rpcCalls.length).toBe(1);
      expect(String(rpcCalls[0]!.init?.body)).toContain('sui_getTransactionBlock');
      expect(String(rpcCalls[0]!.init?.body)).toContain('0xstake_digest');
    } finally {
      await close();
    }
  });

  it('requires approval, stores Walrus evidence, and anchors a Sui dev receipt', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      TENDERBOARD_WORKER_AGENT_ADDRESS: '0xworker_owner',
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Find Sui ecosystem opportunities',
        instructions: 'Make it useful.',
        privateNotes: 'private strategy note: do not send this field',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const before = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      expect(before.suiPaymentDigest).toBeUndefined();
      expect(before.deliveryText).toBeUndefined();
      expect(before.reputationSnapshot.anchoredRunCount).toBe(0);
      expect(before.paymentIntentPlan.paymentNonce).toMatch(/^pay_[0-9a-f]{32}$/);
      expect(before.paymentIntentPlan.paymentNonce.length).toBeLessThanOrEqual(36);
      expect(before.paymentIntentPlan.settlementNonce).toMatch(/^set_[0-9a-f]{32}$/);
      expect(before.paymentIntentPlan.settlementNonce.length).toBeLessThanOrEqual(36);
      expect(before.paymentIntentPlan.amountMist).toBe('35000000');
      expect(before.receiptPlan.paymentDigest).toBeUndefined();
      expect(before.agentHandoff.status).toBe('awaiting_payment');

      const unpaidWorkerTaskResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-task`);
      const unpaidWorkerTask = await unpaidWorkerTaskResponse.json();
      expect(unpaidWorkerTaskResponse.status).toBe(402);
      expect(unpaidWorkerTaskResponse.headers.get('x-payment-protocol')).toBe('x402');
      expect(unpaidWorkerTask).toMatchObject({
        objectType: 'suiproof.x402_sui_payment_challenge.v1',
        x402Version: 1,
        error: 'X402_PAYMENT_REQUIRED',
        settlement: 'sui-payment-kit',
        intentModel: 'sui-payment-intent',
      });
      expect(unpaidWorkerTask.accepts[0]).toMatchObject({
        scheme: 'sui-payment-kit',
        network: 'sui:testnet',
        maxAmountRequired: '35000000',
        resource: `/api/runs/${created.runId}/worker-task`,
        payTo: '<SUI_OPERATOR_ADDRESS>',
        asset: '0x2::sui::SUI',
        extra: {
          paymentUri: before.paymentIntentPlan.paymentUri,
          paymentIntentId: before.paymentIntentPlan.intentId,
          paymentNonce: before.paymentIntentPlan.paymentNonce,
          settlementNonce: before.paymentIntentPlan.settlementNonce,
          workerAgentId: 'sui_opportunity_scout',
          runId: created.runId,
        },
      });
      expect(JSON.stringify(unpaidWorkerTask)).not.toContain('private strategy note');

      const after = await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      expect(after.status).toBe('working');
      expect(after.agentHandoff.status).toBe('working');
      expect(after.reputationSnapshot.anchoredRunCount).toBe(0);
      expect(after.suiPaymentDigest).toContain('sui_dev_payment_');
      expect(after.receiptPlan.paymentDigest).toBe(after.suiPaymentDigest);
      expect(after.deliveryText).toBeUndefined();
      expect(JSON.stringify(after.events)).toContain('worker_task_available');

      const paidWorkerTaskResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-task`);
      const paidWorkerTask = await paidWorkerTaskResponse.json();
      const xPaymentResponse = JSON.parse(paidWorkerTaskResponse.headers.get('x-payment-response') ?? '{}');
      expect(paidWorkerTaskResponse.status).toBe(200);
      expect(paidWorkerTaskResponse.headers.get('x-payment-protocol')).toBe('x402');
      expect(xPaymentResponse).toMatchObject({
        objectType: 'suiproof.x402_sui_payment_response.v1',
        x402Version: 1,
        settlement: 'sui-payment-kit',
        network: 'sui:testnet',
        transaction: after.suiPaymentDigest,
        paymentIntentId: before.paymentIntentPlan.intentId,
        paymentNonce: before.paymentIntentPlan.paymentNonce,
      });
      expect(paidWorkerTask).toMatchObject({
        runId: created.runId,
        status: 'working',
        sanitizedTask: expect.stringContaining('Find Sui ecosystem opportunities'),
        agentHandoff: {
          status: 'working',
        },
      });
      expect(JSON.stringify(paidWorkerTask)).not.toContain('private strategy note');

      const handoff = await (await fetch(`${baseUrl}/api/runs/${created.runId}/agent-handoff`)).json();
      expect(handoff.agentHandoff).toMatchObject({
        hirerAgentId: after.hirerAgent.agentId,
        workerAgentId: after.workerAgent.agentId,
        status: 'working',
      });

      const delivered = await postJson(`${baseUrl}/api/runs/${created.runId}/worker-delivery`, { useDemoWorker: true });
      expect(delivered.status).toBe('delivered');
      expect(delivered.agentHandoff.status).toBe('ready_to_anchor');
      expect(delivered.deliveryText).toContain('Opportunity Scout Report');
      expect(delivered.workerEvidence).toMatchObject({
        schema: 'tenderboard.scout_evidence.v1',
        query: expect.any(String),
        sourceReceipt: {
          schema: 'tenderboard.source_receipt.v1',
        },
      });
      expect(delivered.workerEvidence.sourceReceipt.observations.length).toBeGreaterThan(0);
      expect(delivered.workerEvidence.claims.length).toBeGreaterThan(0);
      const observationIds = new Set(delivered.workerEvidence.sourceReceipt.observations.map((observation: any) => observation.observationId));
      expect(delivered.workerEvidence.claims.every((claim: any) => observationIds.has(claim.sourceObservationId))).toBe(true);
      expect(delivered.verificationManifest.claimResults.length).toBe(delivered.workerEvidence.claims.length);
      expect(delivered.verificationManifest.claimResults.every((result: any) => result.verdict === 'supported')).toBe(true);
      expect(JSON.stringify(delivered)).not.toContain('private strategy note');
      expect(delivered.evidenceEnvelope).toMatchObject({
        deliveryPresent: true,
        walrusReady: false,
      });
      expect(delivered.evidenceEnvelope.evidenceHash).toMatch(/^sha256:/);
      expect(delivered.clearingDecision).toMatchObject({
        verdict: 'pending_walrus',
        walrusReady: false,
      });
      expect(delivered.settlementInstruction.action).toBe('store_walrus_evidence');
      expect(delivered.memoryRecord).toMatchObject({
        objectType: 'suiproof.agent_memory_record.v1',
        workerAgentId: 'sui_opportunity_scout',
        runId: created.runId,
        workOrderId: before.workOrderId,
        paymentIntentId: before.paymentIntentPlan.intentId,
        selectedBidId: 'public_scout_standard',
        amountMist: '35000000',
        amountSui: '0.035',
        paymentDigest: after.suiPaymentDigest,
        evidenceStrength: 'source_receipt',
        settlementAction: 'store_walrus_evidence',
        marketplaceProof: {
          paymentBound: true,
          workerSelected: true,
          sourceVerified: true,
          walrusStored: false,
          suiAnchored: false,
        },
      });
      expect(JSON.stringify(delivered.events)).toContain('walrus_upload_pending');

      const withEvidence = await postJson(`${baseUrl}/api/runs/${created.runId}/store-evidence`, {});
      expect(withEvidence.status).toBe('anchoring');
      expect(withEvidence.agentHandoff.status).toBe('ready_to_anchor');
      expect(withEvidence.reputationSnapshot.anchoredRunCount).toBe(0);
      expect(withEvidence.walrusBlobId).toContain('walrus_dev_blob_');
      expect(withEvidence.walrusBlobObjectId).toMatch(/^0x/);
      expect(withEvidence.receiptPlan).toMatchObject({
        paymentNonce: before.paymentIntentPlan.paymentNonce,
        settlementNonce: before.paymentIntentPlan.settlementNonce,
        walrusBlobId: withEvidence.walrusBlobId,
        walrusBlobObjectId: withEvidence.walrusBlobObjectId,
      });
      expect(withEvidence.verificationManifest.evidenceHash).toMatch(/^sha256:/);
      expect(withEvidence.evidenceEnvelope).toMatchObject({
        evidenceHash: withEvidence.verificationManifest.evidenceHash,
        walrusReady: true,
        walrusBlobId: withEvidence.walrusBlobId,
      });
      expect(withEvidence.clearingDecision).toMatchObject({
        verdict: 'ready_to_anchor',
        walrusReady: true,
      });
      expect(withEvidence.settlementInstruction.action).toBe('anchor_sui_receipt');
      expect(withEvidence.memoryRecord).toMatchObject({
        workOrderId: before.workOrderId,
        paymentIntentId: before.paymentIntentPlan.intentId,
        selectedBidId: 'public_scout_standard',
        walrusBlobId: withEvidence.walrusBlobId,
        evidenceStrength: 'walrus_backed',
        settlementAction: 'anchor_sui_receipt',
        marketplaceProof: {
          paymentBound: true,
          workerSelected: true,
          sourceVerified: true,
          walrusStored: true,
          suiAnchored: false,
        },
      });
      expect(withEvidence.memoryRecord.memoryHash).toMatch(/^sha256:/);

      const anchored = await postJson(`${baseUrl}/api/runs/${created.runId}/anchor-receipt`, {});
      expect(anchored.status).toBe('anchored');
      expect(anchored.agentHandoff.status).toBe('anchored');
      expect(anchored.suiAnchorDigest).toContain('sui_dev_anchor_');
      expect(anchored.receiptPlan.anchorDigest).toBe(anchored.suiAnchorDigest);
      expect(anchored.reputationSnapshot).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        anchoredRunCount: 1,
        walrusEvidenceCount: 1,
        sourceEvidenceCount: expect.any(Number),
        totalMistEarned: '35000000',
        memoryCount: 1,
        averageClaimSupport: 100,
        lastAnchoredRunId: created.runId,
        lastWalrusBlobId: anchored.walrusBlobId,
        lastMemoryId: anchored.memoryRecord.memoryId,
        lastEvidenceHash: anchored.verificationManifest.evidenceHash,
      });
      expect(anchored.memoryRecord).toMatchObject({
        workOrderId: before.workOrderId,
        paymentIntentId: before.paymentIntentPlan.intentId,
        selectedBidId: 'public_scout_standard',
        suiAnchorDigest: anchored.suiAnchorDigest,
        evidenceStrength: 'sui_anchored',
        settlementAction: 'record_settlement',
        marketplaceProof: {
          paymentBound: true,
          workerSelected: true,
          sourceVerified: true,
          walrusStored: true,
          suiAnchored: true,
        },
      });
      expect(anchored.verificationManifest.requiredChecks.find((check: any) => check.id === 'reputation_signal')).toMatchObject({
        status: 'passed',
      });
      expect(anchored.clearingDecision.verdict).toBe('anchored');
      expect(anchored.settlementInstruction).toMatchObject({
        action: 'record_settlement',
        suiAnchorDigest: anchored.suiAnchorDigest,
      });
      expect(JSON.stringify(anchored.events)).toContain('sui_dev_receipt_anchored');
      expect(JSON.stringify(anchored.events)).toContain('worker_reputation_updated');

      const memoryPassport = await (await fetch(`${baseUrl}/api/agents/sui_opportunity_scout/memory`)).json();
      expect(memoryPassport).toMatchObject({
        objectType: 'suiproof.agent_memory_passport.v1',
        workerAgentId: 'sui_opportunity_scout',
        ownerAddress: '0xworker_owner',
        ownership: {
          chain: 'sui',
          address: '0xworker_owner',
          proof: 'owner_address_only',
        },
        chainOwnershipProof: {
          status: 'owner_address_only',
          ownerAddress: '0xworker_owner',
          proof: 'owner_address_only',
        },
        memoryCount: 1,
        walrusMemoryCount: 1,
        anchoredMemoryCount: 1,
        averageClaimSupport: 100,
        latestMemoryId: anchored.memoryRecord.memoryId,
      });
      expect(memoryPassport.records[0]).toMatchObject({
        runId: created.runId,
        ownerAddress: '0xworker_owner',
        walrusBlobId: anchored.walrusBlobId,
        suiAnchorDigest: anchored.suiAnchorDigest,
      });

      const walrusPassport = await (await fetch(`${baseUrl}/api/walrus/memory/sui_opportunity_scout`)).json();
      expect(walrusPassport).toMatchObject({
        objectType: 'suiproof.agent_memory_passport.v1',
        workerAgentId: 'sui_opportunity_scout',
        memoryCount: 1,
        latestMemoryId: anchored.memoryRecord.memoryId,
      });

      const runMemory = await (await fetch(`${baseUrl}/api/runs/${created.runId}/memory`)).json();
      expect(runMemory).toMatchObject({
        objectType: 'suiproof.agent_memory_record.v1',
        memoryId: anchored.memoryRecord.memoryId,
        runId: created.runId,
        workOrderId: before.workOrderId,
        paymentIntentId: before.paymentIntentPlan.intentId,
        selectedBidId: 'public_scout_standard',
        walrusBlobId: anchored.walrusBlobId,
        suiAnchorDigest: anchored.suiAnchorDigest,
        marketplaceProof: {
          paymentBound: true,
          workerSelected: true,
          sourceVerified: true,
          walrusStored: true,
          suiAnchored: true,
        },
      });

      const recordVerification = await (await fetch(`${baseUrl}/api/oracle/records/${created.runId}/verify`)).json();
      expect(recordVerification).toMatchObject({
        objectType: 'walrusproof.verified_memory_record.v1',
        runId: created.runId,
        workerAgentId: 'sui_opportunity_scout',
        memoryId: anchored.memoryRecord.memoryId,
        memoryHash: anchored.memoryRecord.memoryHash,
        verified: true,
      });
      expect(recordVerification.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'memory_hash', status: 'passed' }),
          expect.objectContaining({ id: 'source_receipt_hash', status: 'passed' }),
          expect.objectContaining({ id: 'worker_evidence_hash', status: 'passed' }),
          expect.objectContaining({ id: 'walrus_binding', status: 'passed' }),
          expect.objectContaining({ id: 'sui_anchor_binding', status: 'passed' }),
          expect.objectContaining({ id: 'walrus_readback', status: 'skipped' }),
        ]),
      );

      const passportVerification = await (await fetch(`${baseUrl}/api/oracle/passports/sui_opportunity_scout/verify`)).json();
      expect(passportVerification).toMatchObject({
        objectType: 'walrusproof.verified_passport.v1',
        workerAgentId: 'sui_opportunity_scout',
        verifiedRecordCount: 1,
        failedRecordCount: 0,
        verified: true,
        passport: {
          ownerAddress: '0xworker_owner',
          memoryCount: 1,
          latestMemoryId: anchored.memoryRecord.memoryId,
        },
      });

      const ownerPassportVerification = await (await fetch(`${baseUrl}/api/oracle/owners/0xworker_OWNER/passport/verify`)).json();
      expect(ownerPassportVerification).toMatchObject({
        objectType: 'walrusproof.verified_passport.v1',
        workerAgentId: 'sui_opportunity_scout',
        verified: true,
        passport: {
          ownerAddress: '0xworker_owner',
          memoryCount: 1,
        },
      });

      const memoryIndex = await (await fetch(`${baseUrl}/api/walrus/memory`)).json();
      expect(memoryIndex).toMatchObject({
        objectType: 'walrusproof.memory_index.v1',
        workerCount: 1,
        totalMemoryRecords: 1,
        walrusBackedRecords: 1,
        suiAnchoredRecords: 1,
        latestMemoryId: anchored.memoryRecord.memoryId,
        latestWalrusBlobId: anchored.walrusBlobId,
      });

      const marketCard = await (await fetch(`${baseUrl}/api/agents/sui_opportunity_scout/card`)).json();
      expect(marketCard).toMatchObject({
        objectType: 'walrusproof.agent_market_card.v1',
        agentId: 'sui_opportunity_scout',
        service: {
          category: 'research',
          priceSui: '0.035',
          sla: '24h',
          requestedDataLabel: 'public',
          checkerPacks: ['research'],
        },
        protocols: {
          a2aDiscovery: true,
          x402PaymentRequired: true,
          walrusMemoryRequired: true,
          suiFinalitySupported: true,
        },
        endpoints: {
          createRun: '/api/runs',
          workerTaskTemplate: '/api/runs/{runId}/worker-task',
          x402Verify: '/api/x402/verify',
          walrusMemoryIndex: '/api/walrus/memory',
          memoryPassport: '/api/walrus/memory/sui_opportunity_scout',
        },
        memoryPassport: {
          memoryCount: 1,
          walrusMemoryCount: 1,
          anchoredMemoryCount: 1,
          latestMemoryId: anchored.memoryRecord.memoryId,
        },
      });
      expect(marketCard.marketplaceProofGates).toEqual([
        'payment_bound',
        'worker_selected',
        'source_verified',
        'walrus_stored',
        'sui_anchored',
      ]);

      const wellKnownCard = await (await fetch(`${baseUrl}/.well-known/agent-card.json`)).json();
      expect(wellKnownCard).toMatchObject({
        objectType: 'walrusproof.agent_market_card.v1',
        agentId: 'sui_opportunity_scout',
        protocols: {
          a2aDiscovery: true,
          x402PaymentRequired: true,
        },
      });

      const second = await postJson(`${baseUrl}/api/runs`, {
        title: 'Find another Sui ecosystem opportunity',
        instructions: 'Use public sources only.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });
      const secondReceipt = await (await fetch(`${baseUrl}/api/runs/${second.runId}`)).json();
      expect(secondReceipt.reputationSnapshot).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        anchoredRunCount: 1,
        walrusEvidenceCount: 1,
        memoryCount: 1,
        averageClaimSupport: 100,
        lastAnchoredRunId: created.runId,
      });
      expect(secondReceipt.trustDecision.reasons).toContain(
        'Worker Walrus memory passport has 1 prior record(s), 1 Walrus-backed, and 1 Sui-anchored.',
      );
      expect(secondReceipt.verificationManifest.workerMemory).toMatchObject({
        workerAgentId: 'sui_opportunity_scout',
        memoryCount: 1,
        walrusMemoryCount: 1,
        anchoredMemoryCount: 1,
        averageClaimSupport: 100,
        latestMemoryId: anchored.memoryRecord.memoryId,
      });

      const runs = await (await fetch(`${baseUrl}/api/runs`)).json();
      expect(runs.find((run: any) => run.runId === created.runId).reputationSnapshot.anchoredRunCount).toBe(1);
    } finally {
      await close();
    }
  });

  it('rejects worker delivery without the external source-evidence contract', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Find Sui ecosystem opportunities without sources',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      await postJson(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {});
      const deliveryResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryText: 'I completed the work but did not include source receipts.',
        }),
      });
      const deliveryBody = await deliveryResponse.json();
      expect(deliveryResponse.status).toBe(400);
      expect(deliveryBody.error).toContain('Worker delivery requires walrusproof.external_worker_delivery.v1 payload');

      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      expect(receipt.status).toBe('working');
      expect(receipt.deliveryText).toBeUndefined();
    } finally {
      await close();
    }
  });

  it('keeps the built-in Opportunity Scout delivery as a sui-dev demo fallback only', async () => {
    let currentPaymentMarker: Record<string, string> = {};
    const { baseUrl, close } = await startTestServer(
      {
        TENDERBOARD_MODE: 'sui',
        TENDERBOARD_RECEIPTS_DIR: tempDir,
        SUI_NETWORK: 'testnet',
        SUI_RPC_URL: 'https://sui-rpc.test',
        SUI_OPERATOR_ADDRESS: '0xoperator',
        SUI_PACKAGE_ID: '0xpackage',
        SUI_RECEIPT_REGISTRY_ID: '0xregistry',
        WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
        WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
      },
      {
        suiRpcFetch: async (input, init) => {
          const request = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: request.id,
              result: {
                digest: request.params[0],
                effects: { status: { status: 'success' } },
                balanceChanges: [
                  {
                    owner: { AddressOwner: '0xoperator' },
                    coinType: '0x2::sui::SUI',
                    amount: '35000000',
                  },
                ],
                events: [
                  {
                    type: '0xpackage::receipts::PaymentIntentRecorded',
                    parsedJson: currentPaymentMarker,
                  },
                ],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        },
      },
    );

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Require external worker',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });
      const receipt = await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json();
      currentPaymentMarker = {
        run_id: receipt.runId,
        resource: `/api/runs/${receipt.runId}/worker-task`,
        payment_intent_id: receipt.paymentIntentPlan.intentId,
        payment_nonce: receipt.paymentIntentPlan.paymentNonce,
        settlement_nonce: receipt.paymentIntentPlan.settlementNonce,
        amount_mist: receipt.paymentIntentPlan.amountMist,
        receiver: receipt.paymentIntentPlan.receiverAddress,
        worker_agent_id: receipt.workerAgentId,
      };
      await postJson(`${baseUrl}/api/x402/verify`, buildX402Payload(receipt, { transaction: '0xpayment_digest' }));

      const response = await fetch(`${baseUrl}/api/runs/${created.runId}/worker-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useDemoWorker: true }),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('only available as an explicit sui-dev demo fallback');
    } finally {
      await close();
    }
  });

  it('requires a signed x402 payload before approval in Sui mode', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
      SUI_NETWORK: 'testnet',
      SUI_OPERATOR_ADDRESS: '0xoperator',
      SUI_PACKAGE_ID: '0xpackage',
      SUI_RECEIPT_REGISTRY_ID: '0xregistry',
      WALRUS_PUBLISHER_URL: 'https://publisher.walrus.testnet.example',
      WALRUS_AGGREGATOR_URL: 'https://aggregator.walrus.testnet.example',
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Require real digest',
        instructions: 'Make it useful.',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const response = await fetch(`${baseUrl}/api/runs/${created.runId}/approve-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('requires a signed x402 payload');
    } finally {
      await close();
    }
  });

  it('lists runs and serves downloadable Sui receipt JSON', async () => {
    const { baseUrl, close } = await startTestServer({
      TENDERBOARD_MODE: 'sui-dev',
      TENDERBOARD_RECEIPTS_DIR: tempDir,
    });

    try {
      const created = await postJson(`${baseUrl}/api/runs`, {
        title: 'Run history task',
        instructions: 'Make it useful.',
        privateNotes: 'do not send this field',
        maxPayment: { amount: '0.050', currency: 'SUI' },
      });

      const runs = await (await fetch(`${baseUrl}/api/runs`)).json();
      expect(runs[0]).toMatchObject({ runId: created.runId, taskTitle: 'Run history task' });
      expect(JSON.stringify(runs)).not.toContain('do not send this field');

      const receiptResponse = await fetch(`${baseUrl}/api/runs/${created.runId}/receipt`);
      const receiptText = await receiptResponse.text();
      expect(receiptResponse.headers.get('content-disposition')).toContain(`${created.runId}.json`);
      expect(receiptText).toContain(created.runId);
      expect(receiptText).toContain('suiNetwork');
      expect(receiptText).not.toContain('do not send this field');
    } finally {
      await close();
    }
  });
});

async function startTestServer(
  env: NodeJS.ProcessEnv,
  options: { suiRpcFetch?: typeof fetch; memoryStore?: MemoryStore } = {},
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const config = loadTenderBoardConfig(env);
  const store = new RunStore(config.receiptsDir);
  const server = createTenderBoardServer({
    config,
    store,
    scoutFetch: fakeScoutFetch as typeof fetch,
    ...(options.suiRpcFetch ? { suiRpcFetch: options.suiRpcFetch } : {}),
    ...(options.memoryStore ? { memoryStore: options.memoryStore } : {}),
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function buildX402Payload(receipt: LiveRunReceipt, overrides: Partial<X402SuiPaymentPayload> = {}): X402SuiPaymentPayload {
  if (!receipt.paymentIntentPlan) throw new Error('Missing payment intent plan.');
  return {
    objectType: 'suiproof.x402_sui_payment_payload.v1',
    x402Version: 1,
    scheme: 'sui-payment-kit',
    network: `sui:${receipt.paymentIntentPlan.expectedNetwork}`,
    transaction: receipt.suiPaymentDigest ?? makeSuiDevDigest('payment', receipt.runId),
    runId: receipt.runId,
    resource: `/api/runs/${receipt.runId}/worker-task`,
    paymentIntentId: receipt.paymentIntentPlan.intentId,
    paymentNonce: receipt.paymentIntentPlan.paymentNonce,
    settlementNonce: receipt.paymentIntentPlan.settlementNonce,
    amountMist: receipt.paymentIntentPlan.amountMist,
    receiverAddress: receipt.paymentIntentPlan.receiverAddress,
    coinType: receipt.paymentIntentPlan.coinType,
    workerAgentId: receipt.workerAgentId,
    ...overrides,
  };
}

function buildSourceEvidence(runId: string): ScoutEvidence {
  const record = { title: 'WalrusProof signed receipt payloads', runId };
  const observation = {
    observationId: 'obs_signed_anchor',
    source: 'github' as const,
    sourceLabel: 'GitHub',
    endpoint: 'https://api.github.com/repos/Adarsha-gg/tenderboard-croo-hackathon',
    query: 'WalrusProof signed receipt payload',
    observedAt: '2026-06-20T12:00:00.000Z',
    title: 'WalrusProof signed receipt payloads',
    url: 'https://example.com/walrusproof-anchor',
    score: 100,
    publishedAt: '2026-06-20T11:00:00.000Z',
    recordHash: stableHash(record),
    record,
  };
  const sourceReceiptBody = {
    schema: 'tenderboard.source_receipt.v1' as const,
    generatedAt: '2026-06-20T12:00:00.000Z',
    query: 'WalrusProof signed receipt payload',
    observations: [observation],
    warnings: [],
  };
  const sourceReceipt = {
    ...sourceReceiptBody,
    receiptId: `source_receipt_${runId}`,
    receiptHash: stableHash(sourceReceiptBody),
  };
  const body = {
    schema: 'tenderboard.scout_evidence.v1' as const,
    generatedAt: '2026-06-20T12:00:00.000Z',
    query: 'WalrusProof signed receipt payload',
    sourceReceipt,
    claims: [
      {
        claimId: 'claim_signed_anchor',
        resultIndex: 0,
        title: 'WalrusProof signed receipt payloads',
        url: 'https://example.com/walrusproof-anchor',
        sourceObservationId: 'obs_signed_anchor',
        statement: 'WalrusProof signed receipt payloads are supported by source observation obs_signed_anchor.',
      },
    ],
  };
  return {
    ...body,
    evidenceHash: stableHash(body),
  };
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(json));
  return json;
}
