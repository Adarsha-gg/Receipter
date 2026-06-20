import { buildAgentMemoryPassport } from './agentMemory.js';
import type { AgentMarketCard, LiveRunReceipt, TenderBoardConfig } from './types.js';

export function buildAgentMarketCard(
  workerAgentId: string,
  config: TenderBoardConfig,
  receipts: LiveRunReceipt[],
  generatedAt = new Date().toISOString(),
): AgentMarketCard {
  const memoryPassport = buildAgentMemoryPassport(workerAgentId, receipts, generatedAt);

  return {
    objectType: 'walrusproof.agent_market_card.v1',
    agentId: workerAgentId,
    displayName: 'Opportunity Scout Worker',
    generatedAt,
    service: {
      category: 'research',
      skillIds: ['public_source_research', 'opportunity_scouting', 'source_receipt_generation'],
      priceSui: '0.035',
      sla: '24h',
      requestedDataLabel: 'public',
      checkerPacks: ['research'],
      requiredEvidence: [
        'sanitized_task_packet',
        'source_receipt',
        'claim_verification_results',
        'walrus_memory_record',
        'sui_payment_or_anchor_digest',
      ],
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
      memoryPassport: `/api/walrus/memory/${encodeURIComponent(workerAgentId)}`,
    },
    marketplaceProofGates: ['payment_bound', 'worker_selected', 'source_verified', 'walrus_stored', 'sui_anchored'],
    memoryPassport: {
      memoryCount: memoryPassport.memoryCount,
      walrusMemoryCount: memoryPassport.walrusMemoryCount,
      anchoredMemoryCount: memoryPassport.anchoredMemoryCount,
      averageClaimSupport: memoryPassport.averageClaimSupport,
      latestMemoryId: memoryPassport.latestMemoryId,
      latestWalrusBlobId: memoryPassport.latestWalrusBlobId,
      latestSuiAnchorDigest: memoryPassport.latestSuiAnchorDigest,
    },
  };
}
