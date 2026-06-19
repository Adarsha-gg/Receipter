import { loadTenderBoardConfig } from '../live/config.js';
import { RunStore } from '../live/runStore.js';
import { executeSuiX402Payment } from '../sui/paymentExecutor.js';

async function main(): Promise<void> {
  const runId = process.argv[2];
  if (!runId || runId === '--help' || runId === '-h') {
    throw new Error('Usage: npm run sui:x402-pay -- <runId> [--verify-url http://localhost:4174]');
  }

  const verifyUrl = readOption('--verify-url');
  const config = loadTenderBoardConfig();
  const store = new RunStore(config.receiptsDir);
  const receipt = await store.require(runId);
  const result = await executeSuiX402Payment(receipt, config);

  let verification: unknown = undefined;
  if (verifyUrl) {
    const response = await fetch(`${verifyUrl.replace(/\/$/, '')}/api/x402/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.payload),
    });
    verification = await response.json();
    if (!response.ok) {
      throw new Error(`x402 verification failed with HTTP ${response.status}: ${JSON.stringify(verification)}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        objectType: 'suiproof.sui_x402_payment_execution.v1',
        runId,
        transaction: result.digest,
        payload: result.payload,
        verification,
      },
      null,
      2,
    ),
  );
}

function readOption(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
