export type TenderBoardMode = 'mock' | 'dry-run' | 'live';

export type LiveRunStatus =
  | 'draft'
  | 'sanitized'
  | 'negotiating'
  | 'accepted'
  | 'awaiting_payment_approval'
  | 'paying'
  | 'paid'
  | 'working'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface LiveRunEvent {
  at: string;
  source: 'app' | 'task-giver' | 'worker' | 'croo';
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MoneyInput {
  amount: string;
  currency: 'USDC';
}

export interface CreateRunRequest {
  title: string;
  instructions: string;
  privateNotes?: string;
  maxPayment: MoneyInput;
}

export interface LiveRunSummary {
  runId: string;
  mode: TenderBoardMode;
  status: LiveRunStatus;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  orderId: string | undefined;
  paymentTxHash: string | undefined;
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
  crooServiceId: string | undefined;
  negotiationId: string | undefined;
  orderId: string | undefined;
  paymentTxHash: string | undefined;
  deliveryText: string | undefined;
  events: LiveRunEvent[];
  error: string | undefined;
}

export interface SafeConfig {
  mode: TenderBoardMode;
  port: number;
  maxPaymentUsdc: string;
  receiptsDir: string;
  embeddedWorker: boolean;
  croo: {
    apiUrlConfigured: boolean;
    wsUrlConfigured: boolean;
    requesterSdkKeyConfigured: boolean;
    workerSdkKeyConfigured: boolean;
    workerServiceIdConfigured: boolean;
    baseRpcUrlConfigured: boolean;
  };
  readyForLive: boolean;
  missingLiveSettings: string[];
}

export interface TenderBoardConfig {
  mode: TenderBoardMode;
  port: number;
  maxPaymentUsdc: string;
  receiptsDir: string;
  crooApiUrl: string | undefined;
  crooWsUrl: string | undefined;
  baseRpcUrl: string | undefined;
  requesterSdkKey: string | undefined;
  workerSdkKey: string | undefined;
  workerServiceId: string | undefined;
  embeddedWorker: boolean;
  missingLiveSettings: string[];
  safe: SafeConfig;
}
