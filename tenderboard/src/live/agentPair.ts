import type { AgentHandoff, CreateRunRequest, MarketAgentProfile, SelectedBidReference, TaskDataLabel } from './types.js';
import { stableHash } from './hash.js';

export interface BuildAgentPairInput {
  request: CreateRunRequest;
  sanitizedTask: string;
  selectedBid: SelectedBidReference | undefined;
  specHash: string;
  paymentIntentId: string | undefined;
  hirerOwnerAddress?: string | undefined;
  workerOwnerAddress?: string | undefined;
  workerAgentPassportObjectId?: string | undefined;
}

export function buildAgentPair(input: BuildAgentPairInput): {
  hirerAgent: MarketAgentProfile;
  workerAgent: MarketAgentProfile;
  agentHandoff: AgentHandoff;
} {
  const requestedDataLabel = normalizeTaskDataLabel(input.request.requestedDataLabel);
  const hirerAgent: MarketAgentProfile = {
    objectType: 'suiproof.market_agent.v1',
    agentId: 'sui_hirer.governed.buyer',
    role: 'hirer',
    ownerAddress: input.hirerOwnerAddress,
    displayName: 'Sui Hirer Agent',
    responsibilities: [
      'Define the job, acceptance criteria, private notes, and SUI payment cap.',
      'Publish only the sanitized worker-facing packet.',
      'Approve payment and receipt anchoring only after proof gates pass.',
    ],
    controls: [
      'Private notes never enter the worker packet.',
      'Worker bids must fit the SUI cap and public data boundary.',
      'Reputation updates only after Walrus evidence and Sui receipt anchoring.',
    ],
    budgetSui: input.request.maxPayment.amount,
    priceSui: undefined,
    requestedDataLabel,
  };

  const workerAgent: MarketAgentProfile = {
    objectType: 'suiproof.market_agent.v1',
    agentId: input.selectedBid?.workerAgentId ?? 'unassigned_worker',
    role: 'worker',
    ownerAddress: input.workerOwnerAddress,
    agentPassportObjectId: input.workerAgentPassportObjectId,
    displayName: 'Opportunity Scout Worker',
    responsibilities: [
      'Bid on the sanitized task packet.',
      'Use public sources to produce delivery evidence.',
      'Return source receipts that can be stored on Walrus and anchored to Sui.',
    ],
    controls: [
      'Receives only the sanitized task packet.',
      'Cannot request buyer-private or secret data.',
      'Payment and reputation are bound to the selected bid and receipt plan.',
    ],
    budgetSui: undefined,
    priceSui: input.selectedBid?.priceSui,
    requestedDataLabel: input.selectedBid?.requestedDataLabel ?? 'public',
  };

  const safePacketHash = stableHash({
    title: input.request.title,
    sanitizedTask: input.sanitizedTask,
    acceptanceCriteria: input.request.acceptanceCriteria ?? [],
    maxPayment: input.request.maxPayment,
    requestedDataLabel,
  });

  return {
    hirerAgent,
    workerAgent,
    agentHandoff: {
      objectType: 'suiproof.agent_handoff.v1',
      handoffId: `handoff_${safePacketHash.slice('sha256:'.length, 'sha256:'.length + 16)}`,
      hirerAgentId: hirerAgent.agentId,
      workerAgentId: workerAgent.agentId,
      selectedBidId: input.selectedBid?.bidId,
      safePacketHash,
      specHash: input.specHash,
      paymentIntentId: input.paymentIntentId,
      status: 'awaiting_payment',
    },
  };
}

export function handoffStatusForRun(status: string): AgentHandoff['status'] {
  if (status === 'anchored') return 'anchored';
  if (status === 'anchoring' || status === 'delivered') return 'ready_to_anchor';
  if (status === 'awaiting_payment_approval') return 'awaiting_payment';
  return 'working';
}

function normalizeTaskDataLabel(value: TaskDataLabel | undefined): TaskDataLabel {
  if (value === 'buyer_private' || value === 'secret') return value;
  return 'public';
}
