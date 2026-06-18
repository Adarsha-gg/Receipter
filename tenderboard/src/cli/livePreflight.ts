import { AgentClient, isInsufficientBalance, isUnauthorized } from '@croo-network/sdk';
import { loadTenderBoardConfig } from '../live/config.js';
import { loadDotEnvFile } from '../live/dotenv.js';

loadDotEnvFile();
process.env.TENDERBOARD_MODE = process.env.TENDERBOARD_MODE ?? 'live';

const config = loadTenderBoardConfig();
const failures: string[] = [];

console.log('TenderBoard live preflight');
console.log(`Mode: ${config.mode}`);
console.log(`Embedded worker: ${String(config.embeddedWorker)}`);
console.log(`Payment cap: ${config.maxPaymentUsdc} USDC`);
console.log('');

check('TENDERBOARD_MODE=live', config.mode === 'live');
check('CROO_API_URL configured', Boolean(config.crooApiUrl));
check('CROO_WS_URL configured', Boolean(config.crooWsUrl));
check('CROO_REQUESTER_SDK_KEY configured', Boolean(config.requesterSdkKey));
check('CROO_WORKER_SDK_KEY configured', Boolean(config.workerSdkKey));
check('CROO_WORKER_SERVICE_ID configured', Boolean(config.workerServiceId));
check('payment cap configured', Number(config.maxPaymentUsdc) > 0);

if (failures.length === 0) {
  await checkSdkConnectivity();
}

if (failures.length > 0) {
  console.log('');
  console.log('Preflight failed:');
  for (const failure of failures) console.log(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Preflight passed. Ready to start live server/worker. This command did not send payment.');
}

function check(label: string, ok: boolean): void {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures.push(label);
}

async function checkSdkConnectivity(): Promise<void> {
  const sdkConfig = config.baseRpcUrl
    ? { baseURL: config.crooApiUrl!, wsURL: config.crooWsUrl!, rpcURL: config.baseRpcUrl }
    : { baseURL: config.crooApiUrl!, wsURL: config.crooWsUrl! };
  const requester = new AgentClient(sdkConfig, config.requesterSdkKey!);
  const worker = new AgentClient(sdkConfig, config.workerSdkKey!);

  await checkRequester(requester);
  await checkWorker(worker);
}

async function checkRequester(client: AgentClient): Promise<void> {
  try {
    await client.listOrders({ page: 1, pageSize: 1, role: 'requester' });
    check('requester SDK key can query CROO orders', true);
  } catch (error) {
    check('requester SDK key can query CROO orders', false);
    explainSdkError('requester', error);
  }
}

async function checkWorker(client: AgentClient): Promise<void> {
  try {
    await client.listNegotiations({ page: 1, pageSize: 1, role: 'provider' });
    check('worker SDK key can query CROO negotiations', true);
  } catch (error) {
    check('worker SDK key can query CROO negotiations', false);
    explainSdkError('worker', error);
  }
}

function explainSdkError(role: string, error: unknown): void {
  if (isUnauthorized(error)) {
    failures.push(`${role} SDK key unauthorized`);
    return;
  }
  if (isInsufficientBalance(error)) {
    failures.push(`${role} has insufficient balance`);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  failures.push(`${role} CROO query failed: ${message}`);
}
