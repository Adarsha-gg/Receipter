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

export interface CreateRunRequest {
  title: string;
  instructions: string;
  privateNotes?: string;
  acceptanceCriteria?: string[];
  checkerPack?: CheckerPackId;
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
}

export interface LiveRunReceipt {
  runId: string;
  mode: TenderBoardMode;
  status: LiveRunStatus;
  createdAt: string;
  updatedAt: string;
  taskTitle: string;
  sanitizedTask: string;
  maxPayment: MoneyInput;
  trustDecision: TrustDecision;
  verificationManifest: VerificationManifest;
  workerAgentId: string;
  workOrderId: string | undefined;
  suiNetwork: string;
  suiPackageId: string | undefined;
  suiReceiptRegistryId: string | undefined;
  suiPaymentDigest: string | undefined;
  suiAnchorDigest: string | undefined;
  walrusBlobId: string | undefined;
  deliveryText: string | undefined;
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
