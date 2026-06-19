import type { AddressInfo } from 'node:net';
import { loadTenderBoardConfig } from '../live/config.js';
import { loadDotEnvFile } from '../live/dotenv.js';
import type { LiveRunReceipt } from '../live/types.js';
import { createTenderBoardServer } from '../server/httpServer.js';
import { executeSuiX402Payment } from '../sui/paymentExecutor.js';

async function main(): Promise<void> {
  loadDotEnvFile();
  const config = loadTenderBoardConfig();
  if (config.mode !== 'sui') {
    throw new Error('Live x402 smoke requires TENDERBOARD_MODE=sui.');
  }

  const server = createTenderBoardServer({ config });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const created = await postJson(`${baseUrl}/api/runs`, {
      title: 'Live nonce-bound Sui x402 smoke',
      instructions: 'Use public sources only and return three concrete Sui ecosystem opportunities.',
      acceptanceCriteria: ['Every claim must be supported by source receipts.', 'No private buyer notes may be used.'],
      requestedDataLabel: 'public',
      checkerPack: 'research',
      maxPayment: { amount: '0.050', currency: 'SUI' },
    });

    const receipt = (await (await fetch(`${baseUrl}/api/runs/${created.runId}`)).json()) as LiveRunReceipt;
    const payment = await executeSuiX402Payment(receipt, config);
    const verified = await postJson(`${baseUrl}/api/x402/verify`, payment.payload);

    console.log(
      JSON.stringify(
        {
          objectType: 'suiproof.live_x402_smoke.v1',
          ok: true,
          runId: receipt.runId,
          paymentDigest: payment.digest,
          packageId: config.suiPackageId,
          verifier: verified.verification,
          status: verified.receipt?.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
  }
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
