type CliOptions = {
  baseUrl: string;
  title: string;
  instructions: string;
  amount: string;
  criteria: string[];
  checkerPack: string;
  dataLabel: string;
};

const options = parseArgs(process.argv.slice(2));
const created = await postJson<{ runId: string }>(`${options.baseUrl}/api/runs`, {
  title: options.title,
  instructions: options.instructions,
  acceptanceCriteria: options.criteria,
  checkerPack: options.checkerPack,
  requestedDataLabel: options.dataLabel,
  maxPayment: { amount: options.amount, currency: 'SUI' },
});
const receipt = await getJson<any>(`${options.baseUrl}/api/runs/${encodeURIComponent(created.runId)}`);

const output = {
  objectType: 'receipter.agent_hire_created.v1',
  runId: created.runId,
  selectedWorker: receipt.workerBidBoard?.selectedBidId
    ? receipt.workerBidBoard.bids?.find((bid: any) => bid.bidId === receipt.workerBidBoard.selectedBidId)?.workerAgentId
    : receipt.workerAgentId,
  selectedBidId: receipt.workerBidBoard?.selectedBidId,
  status: receipt.status,
  paymentTransaction: `${options.baseUrl}/api/runs/${encodeURIComponent(created.runId)}/payment-transaction`,
  workerTask: `${options.baseUrl}/api/runs/${encodeURIComponent(created.runId)}/worker-task`,
  receipt: `${options.baseUrl}/api/runs/${encodeURIComponent(created.runId)}`,
  memoryPassport: receipt.workerAgentId
    ? `${options.baseUrl}/api/walrus/memory/${encodeURIComponent(receipt.workerAgentId)}`
    : `${options.baseUrl}/api/walrus/memory`,
  nextStep: 'Have the hirer wallet sign paymentTransaction, then submit the signed x402 payload to its verifyEndpoint.',
};

console.log(JSON.stringify(output, null, 2));

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const title = values.get('title');
  const instructions = values.get('instructions');
  if (!title || !instructions) {
    throw new Error('Usage: npm run hire:agent -- --title "..." --instructions "..." [--amount 0.05] [--base-url http://127.0.0.1:4174]');
  }

  return {
    baseUrl: values.get('base-url') || process.env.RECEIPTER_BASE_URL || 'http://127.0.0.1:4174',
    title,
    instructions,
    amount: values.get('amount') || '0.05',
    criteria: splitCriteria(values.get('criteria') || 'At least 4 public sources;Include dates and links;Summarize why each result fits'),
    checkerPack: values.get('checker-pack') || 'research',
    dataLabel: values.get('data-label') || 'public',
  };
}

function splitCriteria(value: string): string[] {
  return value
    .split(/[;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return readResponse<T>(response);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse<T>(response);
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return body as T;
}
