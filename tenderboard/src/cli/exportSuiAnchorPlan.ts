import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadTenderBoardConfig } from '../live/config.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import { RunStore } from '../live/runStore.js';
import { buildSuiAnchorPlan, renderSuiAnchorPlan } from '../sui/anchorPlan.js';

loadDotEnvFile();

const config = loadTenderBoardConfig();
const store = new RunStore(config.receiptsDir);
const runIdArg = process.argv[2];
const walrusBlobId = process.argv[3];
const proofDir = path.resolve('proof');

const receipt = runIdArg ? await store.require(runIdArg) : await latestReceipt();
const plan = buildSuiAnchorPlan(receipt, config, walrusBlobId);

await mkdir(proofDir, { recursive: true });
const outPath = path.join(proofDir, `${receipt.runId}-sui-anchor.md`);
await writeFile(outPath, renderSuiAnchorPlan(plan), 'utf8');

console.log(`Sui anchor plan written: ${path.relative(process.cwd(), outPath)}`);
if (!plan.ready) {
  console.log(`Not ready to anchor yet. Missing: ${plan.missing.join(', ')}`);
}

async function latestReceipt() {
  const runs = await store.list();
  if (runs.length === 0 || !runs[0]) {
    throw new Error(`No receipts found in ${config.receiptsDir}. Run the app and create a task first.`);
  }
  return store.require(runs[0].runId);
}
