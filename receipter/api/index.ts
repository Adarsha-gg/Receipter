import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReceipterServer } from '../src/server/httpServer.js';

const VERCEL_TMP_RECEIPTS_DIR = '/tmp/receipter-runs';

process.env.RECEIPTER_RECEIPTS_DIR ??= VERCEL_TMP_RECEIPTS_DIR;
process.env.RECEIPTER_MODE ??= 'sui';
process.env.MEMORY_BACKEND ??= 'walrus';
process.env.WALRUS_UPLOAD_STRATEGY ??= 'raw-walrus';

const server = createReceipterServer();
let seedPromise: Promise<void> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await seedBundledReceiptsOnce();

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    res.once('finish', done);
    res.once('close', done);
    server.emit('request', req, res);
  });
}

function seedBundledReceiptsOnce(): Promise<void> {
  seedPromise ??= seedBundledReceipts();
  return seedPromise;
}

async function seedBundledReceipts(): Promise<void> {
  const targetDir = process.env.RECEIPTER_RECEIPTS_DIR ?? VERCEL_TMP_RECEIPTS_DIR;
  const sourceDir = path.join(process.cwd(), 'data', 'runs');

  if (path.resolve(targetDir) === path.resolve(sourceDir)) return;

  await mkdir(targetDir, { recursive: true });
  const existing = await readdir(targetDir).catch(() => [] as string[]);
  if (existing.some((file) => file.endsWith('.json') && file !== 'x402-replay-ledger.json')) return;

  await cp(sourceDir, targetDir, {
    recursive: true,
    force: false,
    errorOnExist: false,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return;
    throw error;
  });
}
