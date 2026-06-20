import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LiveRunEvent, LiveRunReceipt, LiveRunStatus, LiveRunSummary } from './types.js';

export class RunStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly receiptsDir: string) {}

  async create(receipt: LiveRunReceipt): Promise<LiveRunReceipt> {
    return this.enqueue(async () => {
      await this.write(receipt);
      return receipt;
    });
  }

  async get(runId: string): Promise<LiveRunReceipt | undefined> {
    try {
      const text = await readFile(this.pathFor(runId), 'utf8');
      return JSON.parse(text) as LiveRunReceipt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  async require(runId: string): Promise<LiveRunReceipt> {
    const receipt = await this.get(runId);
    if (!receipt) throw new Error(`Unknown run id: ${runId}`);
    return receipt;
  }

  async list(): Promise<LiveRunSummary[]> {
    let files: string[];
    try {
      files = await readdir(this.receiptsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }

    const receipts = await Promise.all(
      files
        .filter((file) => file.endsWith('.json') && file !== 'x402-replay-ledger.json')
        .map(async (file) => JSON.parse(await readFile(path.join(this.receiptsDir, file), 'utf8')) as LiveRunReceipt),
    );

    return receipts
      .map((receipt) => ({
        runId: receipt.runId,
        mode: receipt.mode,
        status: receipt.status,
        taskTitle: receipt.taskTitle,
        createdAt: receipt.createdAt,
        updatedAt: receipt.updatedAt,
        workOrderId: receipt.workOrderId,
        suiPaymentDigest: receipt.suiPaymentDigest,
        suiAnchorDigest: receipt.suiAnchorDigest,
        walrusBlobId: receipt.walrusBlobId,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async appendEvent(runId: string, event: LiveRunEvent): Promise<LiveRunReceipt> {
    return this.enqueue(async () => {
      const receipt = await this.require(runId);
      receipt.events.push(event);
      receipt.updatedAt = event.at;
      await this.write(receipt);
      return receipt;
    });
  }

  async update(runId: string, patch: Partial<Omit<LiveRunReceipt, 'runId' | 'events' | 'createdAt'>>): Promise<LiveRunReceipt> {
    return this.enqueue(async () => {
      const receipt = await this.require(runId);
      const updated: LiveRunReceipt = {
        ...receipt,
        ...patch,
        runId: receipt.runId,
        createdAt: receipt.createdAt,
        events: receipt.events,
        updatedAt: patch.updatedAt ?? new Date().toISOString(),
      };
      await this.write(updated);
      return updated;
    });
  }

  async setStatus(runId: string, status: LiveRunStatus, at = new Date().toISOString()): Promise<LiveRunReceipt> {
    return this.update(runId, { status, updatedAt: at });
  }

  async write(receipt: LiveRunReceipt): Promise<void> {
    await mkdir(this.receiptsDir, { recursive: true });
    const filePath = this.pathFor(receipt.runId);
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    await rename(tempPath, filePath);
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  pathFor(runId: string): string {
    const safeRunId = runId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.receiptsDir, `${safeRunId}.json`);
  }
}

export function makeRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `run_${stamp}_${suffix}`;
}

export function makeEvent(input: Omit<LiveRunEvent, 'at'> & { at?: string }): LiveRunEvent {
  const base = {
    at: input.at ?? new Date().toISOString(),
    source: input.source,
    type: input.type,
    message: input.message,
  } satisfies Omit<LiveRunEvent, 'data'>;

  return input.data === undefined ? base : { ...base, data: input.data };
}
