import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadTenderBoardConfig } from '../live/config.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import { renderReceiptProof } from '../live/proof.js';
import { RunStore } from '../live/runStore.js';

loadDotEnvFile();

const config = loadTenderBoardConfig();
const store = new RunStore(config.receiptsDir);
const runIdArg = process.argv[2];
const proofDir = path.resolve('proof');

const receipt = runIdArg ? await store.require(runIdArg) : await latestReceipt();
await mkdir(proofDir, { recursive: true });
const outPath = path.join(proofDir, `${receipt.runId}-proof.md`);
await writeFile(outPath, renderReceiptProof(receipt), 'utf8');

console.log(`Proof written: ${path.relative(process.cwd(), outPath)}`);

async function latestReceipt() {
  const runs = await store.list();
  if (runs.length === 0 || !runs[0]) {
    throw new Error(`No receipts found in ${config.receiptsDir}. Run the app and create a task first.`);
  }
  return store.require(runs[0].runId);
}
