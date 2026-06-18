import { AgentClient, DeliverableType, EventType } from '@croo-network/sdk';
import type { Event } from '@croo-network/sdk';
import { renderScoutReport, scoutOpportunities } from './opportunityScout.js';
import { findSecretPatternMatches } from '../policy/secretPatterns.js';
import { loadTenderBoardConfig } from '../live/config.js';
import { ensureAmountWithinCap, parseTenderBoardRequirements } from '../live/crooRuntime.js';
import { loadDotEnvFile } from '../live/dotenv.js';

const acceptedNegotiations = new Set<string>();
const deliveredOrders = new Set<string>();
const orderToTask = new Map<string, { runId: string; title: string; sanitizedTask: string }>();

loadDotEnvFile();
const config = loadTenderBoardConfig();

if (config.mode !== 'live') {
  throw new Error('Worker agent requires TENDERBOARD_MODE=live.');
}
if (config.missingLiveSettings.length > 0) {
  throw new Error(`Worker agent missing live settings: ${config.missingLiveSettings.join(', ')}`);
}

const sdkConfig = config.baseRpcUrl
  ? { baseURL: config.crooApiUrl!, wsURL: config.crooWsUrl!, rpcURL: config.baseRpcUrl }
  : { baseURL: config.crooApiUrl!, wsURL: config.crooWsUrl! };
const client = new AgentClient(sdkConfig, config.workerSdkKey!);

const stream = await client.connectWebSocket();
console.log('TenderBoard worker agent listening for CROO jobs.');
console.log(`Service id: ${config.workerServiceId}`);

stream.on(EventType.NegotiationCreated, async (event: Event) => {
  const negotiationId = event.negotiation_id;
  if (!negotiationId || acceptedNegotiations.has(negotiationId)) return;

  try {
    const negotiation = await client.getNegotiation(negotiationId);
    const parsed = parseTenderBoardRequirements(negotiation.requirements);
    if (!parsed) {
      await client.rejectNegotiation(negotiationId, 'TenderBoard worker only accepts TenderBoard live tasks.');
      console.log(`Rejected non-TenderBoard negotiation: ${negotiationId}`);
      return;
    }

    const unsafe = findSecretPatternMatches([parsed.title, parsed.sanitizedTask]);
    if (unsafe.length > 0) {
      await client.rejectNegotiation(negotiationId, 'Task contains forbidden secret-looking data.');
      console.log(`Rejected unsafe negotiation: ${negotiationId}`);
      return;
    }

    ensureAmountWithinCap(parsed.maxPayment.amount, config.maxPaymentUsdc);
    acceptedNegotiations.add(negotiationId);
    const accepted = await client.acceptNegotiation(negotiationId);
    orderToTask.set(accepted.order.orderId, {
      runId: parsed.runId,
      title: parsed.title,
      sanitizedTask: parsed.sanitizedTask,
    });
    console.log(`Accepted negotiation ${negotiationId}; order ${accepted.order.orderId}`);
  } catch (error) {
    console.error(`Failed to handle negotiation ${negotiationId}:`, error);
  }
});

stream.on(EventType.OrderPaid, async (event: Event) => {
  const orderId = event.order_id;
  if (!orderId || deliveredOrders.has(orderId)) return;

  try {
    const task = orderToTask.get(orderId) ?? {
      runId: 'unknown',
      title: 'TenderBoard task',
      sanitizedTask: 'No cached task text found.',
    };
    deliveredOrders.add(orderId);
    const report = await scoutOpportunities(`${task.title}\n${task.sanitizedTask}`);
    const deliverableText = [
      `TenderBoard worker completed: ${task.title}`,
      '',
      'What I did:',
      '- Accepted the paid CROO order.',
      '- Worked only from the safe task text.',
      '- Searched public sources for real links related to the task.',
      '- Delivered this result after payment.',
      '',
      renderScoutReport(report),
      '',
      `Run id: ${task.runId}`,
    ].join('\n');

    const delivered = await client.deliverOrder(orderId, {
      deliverableType: DeliverableType.Text,
      deliverableText,
    });
    console.log(`Delivered order ${orderId}; delivery tx ${delivered.txHash}`);
  } catch (error) {
    console.error(`Failed to deliver order ${orderId}:`, error);
  }
});

process.on('SIGINT', () => {
  console.log('Stopping TenderBoard worker agent.');
  stream.close();
  process.exit(0);
});
