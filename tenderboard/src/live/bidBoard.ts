import type { CreateRunRequest, TaskDataLabel, TenderBoardConfig, WorkerBid, WorkerBidBoard } from './types.js';

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

export function buildWorkerBidBoard(request: CreateRunRequest, config: TenderBoardConfig): WorkerBidBoard {
  const requestedDataLabel = normalizeTaskDataLabel(request.requestedDataLabel);
  const maxPayment = Number(request.maxPayment.amount);
  const bids = BID_TEMPLATES.map((template) => evaluateBid(template, requestedDataLabel, maxPayment, config));
  const selectedBid = bids.find((bid) => bid.verdict === 'available');

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
  config: TenderBoardConfig,
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
