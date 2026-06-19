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

export type MarketAgentRole = 'hirer' | 'worker';

export interface MarketAgentProfile {
  objectType: 'suiproof.market_agent.v1';
  agentId: string;
  role: MarketAgentRole;
  displayName: string;
  responsibilities: string[];
  controls: string[];
  budgetSui: string | undefined;
  priceSui: string | undefined;
  requestedDataLabel: TaskDataLabel;
}

export interface AgentHandoff {
  objectType: 'suiproof.agent_handoff.v1';
  handoffId: string;
  hirerAgentId: string;
  workerAgentId: string;
  selectedBidId: string | undefined;
  safePacketHash: string;
  specHash: string;
  paymentIntentId: string | undefined;
  status: 'awaiting_payment' | 'working' | 'requires_review' | 'ready_to_anchor' | 'anchored';
}

export type VerificationCheckStatus = 'passed' | 'pending' | 'requires_review';
export type VerificationEvidenceStrength = 'none' | 'delivery_only' | 'source_receipt' | 'walrus_backed' | 'sui_anchored';
export type VerificationAdmissibility = 'pending' | 'insufficient' | 'admissible';

export interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationCheckStatus;
  detail: string;
}

export interface VerificationSummary {
  objectType: 'suiproof.verification_summary.v1';
  admissibility: VerificationAdmissibility;
  evidenceStrength: VerificationEvidenceStrength;
  passed: number;
  pending: number;
  requiresReview: number;
  blockerIds: string[];
  settlementEligible: boolean;
  reputationEligible: boolean;
}

export interface VerificationWorkerMemoryContext {
  workerAgentId: string;
  memoryCount: number;
  walrusMemoryCount: number;
  anchoredMemoryCount: number;
  averageClaimSupport: number | undefined;
  latestMemoryId: string | undefined;
}

export type ClaimSupportVerdict = 'supported' | 'weak' | 'stale' | 'unbound' | 'contradicted';

export interface ClaimVerificationResult {
  objectType: 'suiproof.claim_verification.v1';
  claimId: string;
  sourceObservationId: string;
  verdict: ClaimSupportVerdict;
  supportScore: number;
  reasons: string[];
  sourceUrl: string | undefined;
  sourceTitle: string | undefined;
  observedAt: string | undefined;
  publishedAt: string | undefined;
}

export interface VerificationManifest {
  specHash: string;
  evidenceHash: string | undefined;
  checkerPack: CheckerPackId;
  acceptanceCriteria: string[];
  requiredChecks: VerificationCheck[];
  summary?: VerificationSummary;
  claimResults?: ClaimVerificationResult[];
  workerMemory?: VerificationWorkerMemoryContext | undefined;
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

export type PaymentKitMode = 'sui_pay_uri_metadata_only';

export interface WorkerReputationCard {
  objectType: 'tenderboard.worker_reputation_passport.v1';
  workerAgentId: string;
  generatedAt: string;
  anchoredRunCount: number;
  walrusEvidenceCount: number;
  sourceEvidenceCount: number;
  memoryCount: number;
  averageClaimSupport: number | undefined;
  averageTrustScore: number | undefined;
  tierCounts: Record<TrustTier, number>;
  totalMistEarned: string;
  totalSuiEarned: string;
  lastAnchoredRunId: string | undefined;
  lastAnchoredAt: string | undefined;
  lastWalrusBlobId: string | undefined;
  lastMemoryId: string | undefined;
  lastEvidenceHash: string | undefined;
  lastAnchorDigest: string | undefined;
}

export interface AgentMemoryRecord {
  objectType: 'suiproof.agent_memory_record.v1';
  memoryId: string;
  workerAgentId: string;
  runId: string;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  status: LiveRunStatus;
  summary: string;
  tags: string[];
  sourceObservationCount: number;
  claimCount: number;
  supportedClaimCount: number;
  failedClaimCount: number;
  averageClaimSupport: number | undefined;
  verificationAdmissibility: VerificationAdmissibility;
  evidenceStrength: VerificationEvidenceStrength;
  settlementAction: SettlementAction | undefined;
  walrusBlobId: string | undefined;
  walrusReadUrl: string | undefined;
  suiAnchorDigest: string | undefined;
  evidenceHash: string | undefined;
  memoryHash: string;
}

export interface AgentMemoryPassport {
  objectType: 'suiproof.agent_memory_passport.v1';
  workerAgentId: string;
  generatedAt: string;
  memoryCount: number;
  walrusMemoryCount: number;
  anchoredMemoryCount: number;
  averageClaimSupport: number | undefined;
  latestMemoryId: string | undefined;
  latestWalrusBlobId: string | undefined;
  records: AgentMemoryRecord[];
}

export interface WalrusMemoryIndex {
  objectType: 'walrusproof.memory_index.v1';
  generatedAt: string;
  workerCount: number;
  totalMemoryRecords: number;
  walrusBackedRecords: number;
  suiAnchoredRecords: number;
  averageClaimSupport: number | undefined;
  latestMemoryId: string | undefined;
  latestWalrusBlobId: string | undefined;
  passports: AgentMemoryPassport[];
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
  paymentUri: string;
  paymentKitMode: PaymentKitMode;
  paymentKitCompatibility: 'sui:pay-uri-v1';
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
  paymentUri: string;
  paymentKitMode: PaymentKitMode;
  paymentKitCompatibility: 'sui:pay-uri-v1';
  paymentDigest: string | undefined;
  walrusBlobId: string | undefined;
  walrusBlobObjectId: string | undefined;
  walrusCertifiedEpoch: number | undefined;
  walrusEndEpoch: number | undefined;
  walrusReadUrl: string | undefined;
  anchorDigest: string | undefined;
  updatedAt: string;
}

export interface X402SuiPaymentRequirement {
  scheme: 'sui-payment-kit';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: 'application/json';
  payTo: string;
  asset: '0x2::sui::SUI';
  outputSchema: Record<string, unknown>;
  extra: {
    settlement: 'sui_payment_kit_metadata_only';
    paymentUri: string;
    paymentIntentId: string;
    paymentNonce: string;
    settlementNonce: string;
    selectedBidId: string | undefined;
    workerAgentId: string;
    runId: string;
    registry: string | undefined;
    packageId: string | undefined;
  };
}

export interface X402PaymentChallenge {
  objectType: 'suiproof.x402_sui_payment_challenge.v1';
  x402Version: 1;
  error: 'X402_PAYMENT_REQUIRED';
  accepts: X402SuiPaymentRequirement[];
  payerHint: 'hirer-agent';
  settlement: 'sui-payment-kit';
  intentModel: 'sui-payment-intent';
  caveat: string;
}

export interface X402PaymentResponse {
  objectType: 'suiproof.x402_sui_payment_response.v1';
  x402Version: 1;
  settlement: 'sui-payment-kit';
  facilitator: 'suiproof-sui-x402';
  network: string;
  transaction: string;
  paymentIntentId: string;
  paymentNonce: string;
  settlementNonce: string;
}

export interface X402SuiPaymentPayload {
  objectType: 'suiproof.x402_sui_payment_payload.v1';
  x402Version: 1;
  scheme: 'sui-payment-kit';
  network: string;
  transaction: string;
  runId: string;
  resource: string;
  paymentIntentId: string;
  paymentNonce: string;
  settlementNonce: string;
  amountMist: string;
  receiverAddress: string;
  coinType: '0x2::sui::SUI';
  workerAgentId: string;
}

export interface X402SuiFacilitatorVerification {
  objectType: 'suiproof.sui_x402_facilitator_verification.v1';
  facilitator: 'suiproof-sui-x402';
  ok: true;
  runId: string;
  resource: string;
  transaction: string;
  network: string;
  verifiedAt: string;
  checks: {
    requestBound: true;
    nonceBound: true;
    amountBound: true;
    receiverBound: true;
    workerBound: true;
    suiSettlementVerified: true;
    replayProtected: true;
  };
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
  verificationAdmissibility: VerificationAdmissibility;
  evidenceStrength: VerificationEvidenceStrength;
  blockerIds: string[];
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
  reputationSnapshot?: WorkerReputationCard | undefined;
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
  hirerAgent?: MarketAgentProfile;
  workerAgent?: MarketAgentProfile;
  agentHandoff?: AgentHandoff;
  trustDecision: TrustDecision;
  verificationManifest: VerificationManifest;
  paymentIntentPlan?: PaymentIntentPlan;
  receiptPlan?: ReceiptPlan;
  reputationSnapshot?: WorkerReputationCard | undefined;
  memoryRecord?: AgentMemoryRecord | undefined;
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
    rpcUrlConfigured: boolean;
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
  suiRpcUrl: string | undefined;
  suiPackageId: string | undefined;
  suiReceiptRegistryId: string | undefined;
  suiOperatorAddress: string | undefined;
  walrusPublisherUrl: string | undefined;
  walrusAggregatorUrl: string | undefined;
  missingSuiSettings: string[];
  safe: SafeConfig;
}
