export type TenderBoardMode = 'sui-dev' | 'sui';

export type LiveRunStatus =
  | 'draft'
  | 'sanitized'
  | 'awaiting_payment_approval'
  | 'paying'
  | 'paid'
  | 'working'
  | 'delivered'
  | 'anchoring'
  | 'anchored'
  | 'failed'
  | 'cancelled';

export interface LiveRunEvent {
  at: string;
  source: 'app' | 'task-giver' | 'worker' | 'sui' | 'walrus';
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MoneyInput {
  amount: string;
  currency: 'SUI';
}

export type CheckerPackId = 'research' | 'code' | 'commerce';
export type TaskDataLabel = 'public' | 'buyer_private' | 'secret';

export interface PrivacyLabeledTask {
  requestedDataLabel: TaskDataLabel;
  privateNotesProvided: boolean;
  workerDataBoundary: string;
}

export interface CreateRunRequest {
  title: string;
  instructions: string;
  privateNotes?: string;
  acceptanceCriteria?: string[];
  checkerPack?: CheckerPackId;
  requestedDataLabel?: TaskDataLabel;
  maxPayment: MoneyInput;
}

export type TrustTier = 'AAA' | 'AA' | 'A' | 'B' | 'C';
export type TrustVerdict = 'allow' | 'review' | 'block';

export interface TrustDecision {
  workerAgentId: string;
  score: number;
  tier: TrustTier;
  verdict: TrustVerdict;
  pricedMultiplier: number;
  reasons: string[];
  controls: string[];
}

export type WorkerBidVerdict = 'available' | 'blocked';

export interface WorkerBid {
  bidId: string;
  workerAgentId: string;
  priceSui: string;
  sla: string;
  requestedDataLabel: TaskDataLabel;
  riskFlags: string[];
  verdict: WorkerBidVerdict;
  reason: string;
}

export interface WorkerBidBoard {
  buyerMaxPayment: MoneyInput;
  requestedDataLabel: TaskDataLabel;
  selectedBidId: string | undefined;
  bids: WorkerBid[];
}

export type VerificationCheckStatus = 'passed' | 'pending' | 'requires_review';

export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationCheckStatus;
  detail: string;
}

export interface VerificationManifest {
  specHash: string;
  evidenceHash: string | undefined;
  checkerPack: CheckerPackId;
  acceptanceCriteria: string[];
  requiredChecks: VerificationCheck[];
  settlementRule: string;
  reputationWriteback: string;
}

export type ScoutSourceKind = 'hacker_news' | 'github';

export interface SourceObservation {
  observationId: string;
  source: ScoutSourceKind;
  sourceLabel: string;
  endpoint: string;
  query: string;
  observedAt: string;
  title: string;
  url: string;
  score: number | undefined;
  publishedAt: string | undefined;
  recordHash: string;
  record: Record<string, unknown>;
}

export interface SourceReceipt {
  schema: 'tenderboard.source_receipt.v1';
  receiptId: string;
  generatedAt: string;
  query: string;
  observations: SourceObservation[];
  warnings: string[];
  receiptHash: string;
}

export interface ScoutClaim {
  claimId: string;
  resultIndex: number;
  title: string;
  url: string;
  sourceObservationId: string;
  statement: string;
}

export interface ScoutEvidence {
  schema: 'tenderboard.scout_evidence.v1';
  generatedAt: string;
  query: string;
  sourceReceipt: SourceReceipt;
  claims: ScoutClaim[];
  evidenceHash: string;
}

export interface SelectedBidReference {
  bidId: string;
  workerAgentId: string;
  priceSui: string;
  sla: string;
  requestedDataLabel: TaskDataLabel;
}

export interface PaymentIntentPlan {
  objectType: 'tenderboard.payment_intent_plan.v1';
  intentId: string;
  paymentNonce: string;
  settlementNonce: string;
  amountMist: string;
  amountSui: string;
  coinType: '0x2::sui::SUI';
  receiverAddress: string;
  operatorAddress: string;
  selectedBid: SelectedBidReference | undefined;
  specHash: string;
  expectedNetwork: string;
  expiresAt: string;
  createdAt: string;
}

export interface ReceiptPlan {
  objectType: 'tenderboard.receipt_plan.v1';
  intentId: string;
  paymentNonce: string;
  settlementNonce: string;
  duplicatePreventionKey: string;
  amountMist: string;
  amountSui: string;
  coinType: '0x2::sui::SUI';
  receiverAddress: string;
  operatorAddress: string;
  selectedBidId: string | undefined;
  workerAgentId: string;
  specHash: string;
  expectedNetwork: string;
  paymentDigest: string | undefined;
  walrusBlobId: string | undefined;
  walrusBlobObjectId: string | undefined;
  walrusCertifiedEpoch: number | undefined;
  walrusEndEpoch: number | undefined;
  walrusReadUrl: string | undefined;
  anchorDigest: string | undefined;
  updatedAt: string;
}

export interface ObligationObject {
  objectType: 'tenderboard.obligation.v1';
  obligationId: string;
  taskTitle: string;
  sanitizedTaskHash: string;
  specHash: string;
  selectedBid: SelectedBidReference | undefined;
  acceptanceCriteria: string[];
  requestedDataLabel: TaskDataLabel;
  maxPayment: MoneyInput;
  workerDataBoundary: string | undefined;
  workOrderId: string | undefined;
  suiWorkOrderObjectId: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceEnvelope {
  objectType: 'tenderboard.evidence_envelope.v1';
  envelopeId: string;
  obligationId: string;
  evidenceHash: string | undefined;
  deliveryPresent: boolean;
  requestedDataLabel: TaskDataLabel;
  walrusReady: boolean;
  walrusBlobId: string | undefined;
  walrusBlobObjectId: string | undefined;
  walrusCertifiedEpoch: number | undefined;
  walrusEndEpoch: number | undefined;
  walrusReadUrl: string | undefined;
  updatedAt: string;
}

export type ClearingVerdict = 'pending_delivery' | 'pending_walrus' | 'ready_to_anchor' | 'anchored' | 'requires_review';

export interface ClearingDecision {
  objectType: 'tenderboard.clearing_decision.v1';
  decisionId: string;
  obligationId: string;
  verdict: ClearingVerdict;
  reasons: string[];
  trustVerdict: TrustVerdict;
  evidenceHash: string | undefined;
  walrusReady: boolean;
  verificationStatus: {
    passed: number;
    pending: number;
    requiresReview: number;
  };
  decidedAt: string;
}

export type SettlementAction = 'hold_payment' | 'store_walrus_evidence' | 'anchor_sui_receipt' | 'record_settlement' | 'manual_review';

export interface SettlementInstruction {
  objectType: 'tenderboard.settlement_instruction.v1';
  instructionId: string;
  obligationId: string;
  action: SettlementAction;
  workerAgentId: string;
  selectedBidId: string | undefined;
  amount: MoneyInput;
  preconditions: string[];
  suiEscrowObjectId: string | undefined;
  suiPaymentDigest: string | undefined;
  suiAnchorDigest: string | undefined;
  walrusBlobId: string | undefined;
  updatedAt: string;
}

export interface LiveRunSummary {
  runId: string;
  mode: TenderBoardMode;
  status: LiveRunStatus;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  workOrderId: string | undefined;
  suiPaymentDigest: string | undefined;
  suiAnchorDigest: string | undefined;
  walrusBlobId: string | undefined;
}

export interface LiveRunReceipt {
  runId: string;
  mode: TenderBoardMode;
  status: LiveRunStatus;
  createdAt: string;
  updatedAt: string;
  taskTitle: string;
  sanitizedTask: string;
  privacy?: PrivacyLabeledTask;
  maxPayment: MoneyInput;
  workerBidBoard?: WorkerBidBoard;
  trustDecision: TrustDecision;
  verificationManifest: VerificationManifest;
  paymentIntentPlan?: PaymentIntentPlan;
  receiptPlan?: ReceiptPlan;
  obligationObject?: ObligationObject;
  evidenceEnvelope?: EvidenceEnvelope;
  clearingDecision?: ClearingDecision;
  settlementInstruction?: SettlementInstruction;
  workerAgentId: string;
  workOrderId: string | undefined;
  suiNetwork: string;
  suiPackageId: string | undefined;
  suiReceiptRegistryId: string | undefined;
  suiWorkOrderObjectId: string | undefined;
  suiEscrowObjectId: string | undefined;
  suiPaymentDigest: string | undefined;
  suiAnchorDigest: string | undefined;
  walrusBlobId: string | undefined;
  walrusBlobObjectId: string | undefined;
  walrusCertifiedEpoch: number | undefined;
  walrusEndEpoch: number | undefined;
  walrusReadUrl: string | undefined;
  deliveryText: string | undefined;
  workerEvidence?: ScoutEvidence | undefined;
  events: LiveRunEvent[];
  error: string | undefined;
}

export interface SafeConfig {
  mode: TenderBoardMode;
  port: number;
  maxPaymentSui: string;
  receiptsDir: string;
  workerAgentId: string;
  sui: {
    network: string;
    packageIdConfigured: boolean;
    receiptRegistryIdConfigured: boolean;
    operatorAddressConfigured: boolean;
    walrusPublisherConfigured: boolean;
    walrusAggregatorConfigured: boolean;
    readyForSui: boolean;
    missingSuiSettings: string[];
  };
}

export interface TenderBoardConfig {
  mode: TenderBoardMode;
  port: number;
  maxPaymentSui: string;
  receiptsDir: string;
  workerAgentId: string;
  suiNetwork: string;
  suiPackageId: string | undefined;
  suiReceiptRegistryId: string | undefined;
  suiOperatorAddress: string | undefined;
  walrusPublisherUrl: string | undefined;
  walrusAggregatorUrl: string | undefined;
  missingSuiSettings: string[];
  safe: SafeConfig;
}
