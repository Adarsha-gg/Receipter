import type { CreateRunRequest, TaskDataLabel, ReceipterConfig, WorkerBid, WorkerBidBoard } from './types.js';

interface BidTemplate {
  bidId: string;
  workerAgentId: string;
  priceSui: string;
  sla: string;
  requestedDataLabel: TaskDataLabel;
  baseRiskFlags: string[];
}

const BID_TEMPLATES: BidTemplate[] = [
  {
    bidId: 'public_scout_standard',
    workerAgentId: 'opportunity_scout.public.standard',
    priceSui: '0.035',
    sla: '24h',
    requestedDataLabel: 'public',
    baseRiskFlags: [],
  },
  {
    bidId: 'public_scout_expedited',
    workerAgentId: 'opportunity_scout.public.expedited',
    priceSui: '0.075',
    sla: '4h',
    requestedDataLabel: 'public',
    baseRiskFlags: ['premium_price'],
  },
  {
    bidId: 'context_scout_private',
    workerAgentId: 'opportunity_scout.context.private',
    priceSui: '0.025',
    sla: '12h',
    requestedDataLabel: 'buyer_private',
    baseRiskFlags: ['requests_buyer_private_data'],
  },
  {
    bidId: 'public_scout_lite',
    workerAgentId: 'opportunity_scout.public.lite',
    priceSui: '0.020',
    sla: '36h',
    requestedDataLabel: 'public',
    baseRiskFlags: ['budget_tier'],
  },
  {
    bidId: 'public_scout_deep',
    workerAgentId: 'opportunity_scout.public.deep',
    priceSui: '0.045',
    sla: '48h',
    requestedDataLabel: 'public',
    baseRiskFlags: [],
  },
];

export function buildPrivacyLabeledTask(request: CreateRunRequest): {
  requestedDataLabel: TaskDataLabel;
  privateNotesProvided: boolean;
  workerDataBoundary: string;
} {
  const requestedDataLabel = normalizeTaskDataLabel(request.requestedDataLabel);
  return {
    requestedDataLabel,
    privateNotesProvided: Boolean(request.privateNotes?.trim()),
    workerDataBoundary:
      requestedDataLabel === 'public'
        ? 'Only public task instructions and acceptance criteria may be sent to worker bidders.'
        : 'Buyer-private or secret data labels are recorded for risk review and never released to worker bidders.',
  };
}

export function buildWorkerBidBoard(request: CreateRunRequest, config: ReceipterConfig): WorkerBidBoard {
  const requestedDataLabel = normalizeTaskDataLabel(request.requestedDataLabel);
  const maxPayment = Number(request.maxPayment.amount);
  const taskFitBlocker = publicSourceResearchBlocker(request);
  const bids = BID_TEMPLATES.map((template) => evaluateBid(template, requestedDataLabel, maxPayment, config, taskFitBlocker));
  const preferred = request.preferredBidId
    ? bids.find((bid) => bid.bidId === request.preferredBidId && bid.verdict === 'available')
    : undefined;
  const selectedBid = preferred ?? bids.find((bid) => bid.verdict === 'available');

  return {
    buyerMaxPayment: request.maxPayment,
    requestedDataLabel,
    selectedBidId: selectedBid?.bidId,
    bids,
  };
}

export function availableWorkerBids(board: WorkerBidBoard): WorkerBid[] {
  return board.bids.filter((bid) => bid.verdict === 'available');
}

function evaluateBid(
  template: BidTemplate,
  requestedDataLabel: TaskDataLabel,
  maxPayment: number,
  config: ReceipterConfig,
  taskFitBlocker: string | undefined,
): WorkerBid {
  const price = Number(template.priceSui);
  const riskFlags = [...template.baseRiskFlags];
  const blockers: string[] = [];

  if (!Number.isFinite(maxPayment) || maxPayment <= 0) {
    blockers.push('Buyer max payment is invalid.');
  } else if (Number.isFinite(price) && price > maxPayment) {
    riskFlags.push('over_budget');
    blockers.push(`Price ${template.priceSui} SUI exceeds buyer max ${formatSui(maxPayment)} SUI.`);
  }

  if (template.requestedDataLabel !== 'public') {
    riskFlags.push('unsafe_data_request');
    blockers.push(`Bid requests ${humanDataLabel(template.requestedDataLabel)} data, which is outside the worker boundary.`);
  }

  if (requestedDataLabel !== 'public') {
    riskFlags.push('buyer_labeled_sensitive');
    blockers.push(`Task is labeled ${humanDataLabel(requestedDataLabel)} and needs buyer review before worker sourcing.`);
  }

  if (taskFitBlocker) {
    riskFlags.push('unsupported_task_fit');
    blockers.push(taskFitBlocker);
  }

  const verdict = blockers.length > 0 ? 'blocked' : 'available';
  const workerAgentId =
    template.bidId === 'public_scout_standard' && config.workerAgentId ? config.workerAgentId : template.workerAgentId;

  return {
    bidId: template.bidId,
    workerAgentId,
    priceSui: template.priceSui,
    sla: template.sla,
    requestedDataLabel: template.requestedDataLabel,
    riskFlags,
    verdict,
    reason: verdict === 'available' ? 'Bid is within the SUI budget and only asks for public worker data.' : blockers.join(' '),
  };
}

function normalizeTaskDataLabel(value: TaskDataLabel | undefined): TaskDataLabel {
  if (value === 'buyer_private' || value === 'secret') return value;
  return 'public';
}

function humanDataLabel(value: TaskDataLabel): string {
  if (value === 'buyer_private') return 'buyer-private';
  if (value === 'secret') return 'secret';
  return 'public';
}

function formatSui(value: number): string {
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function publicSourceResearchBlocker(request: CreateRunRequest): string | undefined {
  const text = `${request.title}\n${request.instructions}\n${request.acceptanceCriteria?.join('\n') ?? ''}`.toLowerCase();
  if (/\b(restaurants?|restruants?|food places?|coffee shops?|cafes?|bars?|hotels?|apartments?)\b/.test(text)) {
    return 'Receipter workers only accept verifiable public-source research over developer, ecosystem, GitHub, Hacker News, protocol, funding, competitor, and market-intel sources.';
  }
  if (/\b(find me (a )?(wife|husband|girlfriend|boyfriend|date)|dating|matchmaking)\b/.test(text)) {
    return 'Receipter workers do not handle personal matchmaking requests; use public-source research tasks with externally verifiable links.';
  }
  return undefined;
}
