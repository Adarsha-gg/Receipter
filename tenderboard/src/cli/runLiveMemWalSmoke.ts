import { loadTenderBoardConfig } from '../live/config.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import { buildLiveMemorySmokeReceipt, verifyWalrusSmokeReadback } from '../live/memorySmoke.js';
import { createMemoryStore } from '../live/memoryStore.js';

async function main(): Promise<void> {
  loadDotEnvFile();
  const config = loadTenderBoardConfig();
  if (config.mode !== 'sui') {
    throw new Error('Live MemWal smoke requires TENDERBOARD_MODE=sui.');
  }
  if (config.memoryBackend !== 'memwal') {
    throw new Error('Live MemWal smoke requires MEMORY_BACKEND=memwal.');
  }
  if (!config.safe.memory.memwalConfigured) {
    throw new Error('Live MemWal smoke requires MEMWAL_DELEGATE_KEY, MEMWAL_ACCOUNT_ID, and MEMWAL_SERVER_URL.');
  }

  const receipt = buildLiveMemorySmokeReceipt(config);
  const memoryStore = createMemoryStore(config);
  const walrus = await memoryStore.putEvidenceBundle(receipt);
  const readback = await verifyWalrusSmokeReadback(walrus, receipt.runId);
  if (!readback.ok) {
    throw new Error(`Walrus readback failed for ${walrus.readUrl ?? 'missing read URL'}: ${JSON.stringify(readback)}`);
  }

  console.log(
    JSON.stringify(
      {
        objectType: 'walrusproof.memwal_live_smoke.v1',
        ok: true,
        backend: memoryStore.backend,
        namespace: config.memwalNamespace,
        runId: receipt.runId,
        workerAgentId: receipt.workerAgentId,
        walrus,
        readback,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
