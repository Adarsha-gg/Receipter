import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const baseUrl = normalizeBaseUrl(process.env.RECEIPTER_BASE_URL || 'http://127.0.0.1:4174');

const server = new McpServer({
  name: 'receipter',
  version: '0.1.0',
});

server.registerTool(
  'list_agents',
  {
    title: 'List Receipter agents',
    description: 'List worker agent passports and their Walrus/Sui-backed reputation signals.',
    inputSchema: {},
  },
  async () => textResult(await getJson('/api/walrus/memory')),
);

server.registerTool(
  'get_agent_passport',
  {
    title: 'Get agent passport',
    description: 'Read a worker agent memory passport by worker agent id.',
    inputSchema: {
      workerAgentId: z.string().min(1).describe('Worker agent id, for example sui_opportunity_scout.'),
    },
  },
  async ({ workerAgentId }) => textResult(await getJson(`/api/walrus/memory/${encodeURIComponent(workerAgentId)}`)),
);

server.registerTool(
  'create_work_order',
  {
    title: 'Create work order',
    description: 'Create a safe Receipter work order, route it to an eligible worker, and return payment endpoints.',
    inputSchema: {
      title: z.string().min(1),
      instructions: z.string().min(1),
      amountSui: z.string().default('0.05').describe('Maximum payment in SUI.'),
      acceptanceCriteria: z.array(z.string()).default([
        'At least 4 public sources.',
        'Include links and dates when available.',
        'Summarize the recommendation.',
      ]),
      checkerPack: z.string().default('research'),
      requestedDataLabel: z.enum(['public', 'buyer_private', 'secret']).default('public'),
      privateNotes: z.string().optional().describe('Buyer-private notes. Receipter strips these from the worker packet.'),
      preferredBidId: z.string().optional(),
    },
  },
  async (input) => {
    const created = await postJson('/api/runs', {
      title: input.title,
      instructions: input.instructions,
      privateNotes: input.privateNotes,
      acceptanceCriteria: input.acceptanceCriteria,
      checkerPack: input.checkerPack,
      requestedDataLabel: input.requestedDataLabel,
      maxPayment: { amount: input.amountSui, currency: 'SUI' },
      preferredBidId: input.preferredBidId,
    });
    const receipt = await getJson(`/api/runs/${encodeURIComponent(String(created.runId))}`);
    return textResult(withMcpHandoff(receipt));
  },
);

server.registerTool(
  'get_work_order',
  {
    title: 'Get work order',
    description: 'Read a Receipter run/work-order receipt by run id.',
    inputSchema: {
      runId: z.string().min(1),
    },
  },
  async ({ runId }) => textResult(await getJson(`/api/runs/${encodeURIComponent(runId)}`)),
);

server.registerTool(
  'get_payment_transaction',
  {
    title: 'Get payment transaction',
    description: 'Return signer-ready Sui wallet transaction data for the bounded x402 payment intent.',
    inputSchema: {
      runId: z.string().min(1),
    },
  },
  async ({ runId }) => textResult(await getJson(`/api/runs/${encodeURIComponent(runId)}/payment-transaction`)),
);

server.registerTool(
  'explain_payment_flow',
  {
    title: 'Explain MCP payment flow',
    description: 'Explain how an autonomous agent pays through Receipter MCP without Receipter custodying the wallet.',
    inputSchema: {
      runId: z.string().optional().describe('Optional run id to include concrete endpoint URLs.'),
    },
  },
  async ({ runId }) => textResult(paymentFlow(runId)),
);

server.registerTool(
  'submit_signed_payment',
  {
    title: 'Submit signed payment',
    description: 'Verify a signed Sui payment transaction digest against the bounded x402 payment intent.',
    inputSchema: {
      runId: z.string().min(1),
      transactionDigest: z.string().min(1).describe('Digest returned by the hirer wallet after signing the payment transaction.'),
    },
  },
  async ({ runId, transactionDigest }) => {
    const signing = await getJson(`/api/runs/${encodeURIComponent(runId)}/payment-transaction`);
    const payload = { ...signing.paymentPayloadTemplate, transaction: transactionDigest };
    return textResult(await postJson(signing.verifyEndpoint, payload));
  },
);

server.registerTool(
  'get_worker_task',
  {
    title: 'Get worker task',
    description: 'Read the worker-facing task packet. Unpaid runs return the server x402/Sui 402 challenge.',
    inputSchema: {
      runId: z.string().min(1),
      paymentHeader: z.string().optional().describe('Optional X-Payment response header from a signed payment flow.'),
    },
  },
  async ({ runId, paymentHeader }) => {
    const headers = paymentHeader ? { 'X-Payment': paymentHeader } : undefined;
    return textResult(await getJson(`/api/runs/${encodeURIComponent(runId)}/worker-task`, headers));
  },
);

server.registerTool(
  'submit_worker_delivery',
  {
    title: 'Submit worker delivery',
    description: 'Submit worker evidence for a paid run. Can invoke the built-in Receipter worker for public-source research.',
    inputSchema: {
      runId: z.string().min(1),
      useReceipterWorker: z.boolean().default(true),
      delivery: z.record(z.unknown()).optional().describe('Explicit receipter.external_worker_delivery.v1 payload.'),
    },
  },
  async ({ runId, useReceipterWorker, delivery }) => {
    const body = delivery || {
      objectType: 'receipter.worker_agent_delivery_request.v1',
      useReceipterWorker,
    };
    return textResult(await postJson(`/api/runs/${encodeURIComponent(runId)}/worker-delivery`, body));
  },
);

server.registerTool(
  'store_evidence',
  {
    title: 'Store evidence on Walrus',
    description: 'Store the full evidence bundle on Walrus and bind the blob id to the run.',
    inputSchema: {
      runId: z.string().min(1),
    },
  },
  async ({ runId }) => textResult(await postJson(`/api/runs/${encodeURIComponent(runId)}/store-evidence`, {})),
);

server.registerTool(
  'get_anchor_transaction',
  {
    title: 'Get anchor transaction',
    description: 'Return signer-ready Sui wallet transaction data for anchoring the compact receipt.',
    inputSchema: {
      runId: z.string().min(1),
    },
  },
  async ({ runId }) => textResult(await getJson(`/api/runs/${encodeURIComponent(runId)}/anchor-transaction`)),
);

server.registerTool(
  'submit_signed_anchor',
  {
    title: 'Submit signed anchor',
    description: 'Verify a signed Sui receipt-anchor transaction digest and record the Sui anchor on the run.',
    inputSchema: {
      runId: z.string().min(1),
      transactionDigest: z.string().min(1).describe('Digest returned by the signer wallet after signing the anchor transaction.'),
    },
  },
  async ({ runId, transactionDigest }) => {
    const signing = await getJson(`/api/runs/${encodeURIComponent(runId)}/anchor-transaction`);
    const anchorPayload = { ...signing.anchorPayloadTemplate, transaction: transactionDigest };
    return textResult(await postJson(signing.verifyEndpoint, { anchorPayload }));
  },
);

server.registerTool(
  'get_passport_update_transaction',
  {
    title: 'Get passport update transaction',
    description: 'Return signer-ready Sui transaction data for updating the AgentPassport memory pointer.',
    inputSchema: {
      runId: z.string().min(1),
    },
  },
  async ({ runId }) => textResult(await getJson(`/api/runs/${encodeURIComponent(runId)}/passport-update-transaction`)),
);

server.registerTool(
  'submit_signed_passport_update',
  {
    title: 'Submit signed passport update',
    description: 'Verify a signed AgentPassport update transaction digest and record the passport memory update.',
    inputSchema: {
      runId: z.string().min(1),
      transactionDigest: z.string().min(1).describe('Digest returned by the owner wallet after signing the passport update transaction.'),
    },
  },
  async ({ runId, transactionDigest }) => {
    const signing = await getJson(`/api/runs/${encodeURIComponent(runId)}/passport-update-transaction`);
    const payload = { ...signing.passportUpdatePayloadTemplate, transaction: transactionDigest };
    return textResult(await postJson(signing.verifyEndpoint, payload));
  },
);

server.registerTool(
  'verify_receipt',
  {
    title: 'Verify receipt',
    description: 'Run the receipt oracle checks: hashes, Walrus binding/readback, source claims, and Sui anchor binding.',
    inputSchema: {
      runId: z.string().min(1),
    },
  },
  async ({ runId }) => textResult(await getJson(`/api/oracle/records/${encodeURIComponent(runId)}/verify`)),
);

server.registerResource(
  'agent-card',
  'receipter://agent-card',
  {
    title: 'Receipter agent card',
    description: 'Well-known agent card describing Receipter API and marketplace endpoints.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(await getJson('/.well-known/agent-card.json'), null, 2),
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());

function withMcpHandoff(receipt: any) {
  const runId = String(receipt.runId);
  const selectedBidId = receipt.workerBidBoard?.selectedBidId;
  const selectedBid = selectedBidId
    ? receipt.workerBidBoard?.bids?.find((bid: any) => bid.bidId === selectedBidId)
    : undefined;
  const workerAgentId = selectedBid?.workerAgentId || receipt.workerAgentId;
  return {
    objectType: 'receipter.mcp_work_order_created.v1',
    runId,
    selectedBidId,
    selectedWorker: workerAgentId,
    status: receipt.status,
    receipt,
    nextEndpoints: {
      paymentTransaction: `${baseUrl}/api/runs/${encodeURIComponent(runId)}/payment-transaction`,
      workerTask: `${baseUrl}/api/runs/${encodeURIComponent(runId)}/worker-task`,
      receipt: `${baseUrl}/api/runs/${encodeURIComponent(runId)}`,
      memoryPassport: workerAgentId
        ? `${baseUrl}/api/walrus/memory/${encodeURIComponent(workerAgentId)}`
        : `${baseUrl}/api/walrus/memory`,
    },
    nextStep:
      'Call get_payment_transaction, have the hirer wallet sign it, then submit the returned x402 payment payload to the verifyEndpoint.',
  };
}

function paymentFlow(runId?: string) {
  const runPath = runId ? `/api/runs/${encodeURIComponent(runId)}` : '/api/runs/{runId}';
  return {
    objectType: 'receipter.mcp_payment_flow.v1',
    model: 'non_custodial_sui_x402',
    summary:
      'Receipter MCP never takes a private key. It returns signer-ready Sui transaction data, the agent wallet signs it, then MCP submits the signed transaction digest for x402 verification.',
    requiredAgentCapabilities: [
      'A Sui account funded on the target network.',
      'A signer the agent can call, such as a wallet-standard bridge, zkLogin session signer, Sui keypair signer, or human wallet approval.',
      'Permission to spend no more than the bounded amount in the Receipter payment intent.',
    ],
    steps: [
      {
        step: 1,
        tool: 'create_work_order',
        purpose: 'Create the task, route to a safe worker, and bind amount/worker/resource/nonces.',
      },
      {
        step: 2,
        tool: 'get_payment_transaction',
        endpoint: `${baseUrl}${runPath}/payment-transaction`,
        purpose: 'Return receipter.sui_wallet_transaction_request.v1 for the exact x402 payment intent.',
      },
      {
        step: 3,
        actor: 'agent_wallet_or_human_wallet',
        purpose:
          'Sign and execute walletTransactionRequest on Sui. The wallet returns a transaction digest. Receipter does not see the private key.',
      },
      {
        step: 4,
        tool: 'submit_signed_payment',
        endpoint: `${baseUrl}/api/x402/verify`,
        purpose:
          'Receipter verifies the digest on Sui: amount, receiver, resource, run id, worker id, nonces, package event, and replay protection.',
      },
      {
        step: 5,
        tool: 'get_worker_task',
        endpoint: `${baseUrl}${runPath}/worker-task`,
        purpose: 'Paid access unlocks the worker-facing task packet.',
      },
      {
        step: 6,
        tools: ['submit_worker_delivery', 'store_evidence', 'get_anchor_transaction', 'submit_signed_anchor'],
        purpose: 'Delivery becomes a Walrus evidence blob and then a compact Sui receipt anchor.',
      },
    ],
    whatCountsAsPayment: {
      accepted: 'A Sui transaction digest that passes Receipter x402 facilitator verification.',
      rejected: [
        'Raw text saying paid.',
        'A transaction to the wrong receiver.',
        'A transaction below the exact amount.',
        'A transaction for the wrong run/resource/worker.',
        'A replayed payment nonce.',
      ],
    },
    demoNote:
      'For a browser demo, the Sui wallet extension signs step 3. For an autonomous agent demo, give the agent a scoped Sui signer and let it call submit_signed_payment with the returned digest.',
  };
}

async function getJson(path: string, headers?: Record<string, string>): Promise<any> {
  const response = await fetch(`${baseUrl}${path}`, headers ? { headers } : undefined);
  return readResponse(response);
}

async function postJson(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return readResponse(response);
}

async function readResponse(response: Response): Promise<any> {
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(body?.error || `Receipter API ${response.status}`);
  }
  return body;
}

function textResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}
