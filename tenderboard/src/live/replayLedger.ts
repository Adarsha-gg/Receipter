import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { X402SuiPaymentPayload } from './types.js';

export class ReplayLedgerError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ReplayLedgerError';
  }
}

export interface ReplayLedgerRecord {
  key: string;
  transaction: string;
  runId: string;
  resource: string;
  paymentIntentId: string;
  paymentNonce: string;
  settlementNonce: string;
  amountMist: string;
  receiverAddress: string;
  workerAgentId: string;
  recordedAt: string;
}

interface ReplayLedgerFile {
  objectType: 'walrusproof.x402_replay_ledger.v1';
  version: 1;
  records: ReplayLedgerRecord[];
}

export class PaymentReplayLedger {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly receiptsDir: string) {}

  recordPayment(payload: X402SuiPaymentPayload, recordedAt = new Date().toISOString()): Promise<ReplayLedgerRecord> {
    return this.enqueue(async () => {
      const ledger = await this.read();
      const key = replayKey(payload);
      const existingKey = ledger.records.find((record) => record.key === key);
      if (existingKey) {
        throw new ReplayLedgerError(409, `X402 payment nonce was already recorded for run ${existingKey.runId}.`);
      }
      const existingDigest = ledger.records.find((record) => record.transaction === payload.transaction);
      if (existingDigest) {
        throw new ReplayLedgerError(409, `Sui payment transaction was already recorded for run ${existingDigest.runId}.`);
      }

      const record: ReplayLedgerRecord = {
        key,
        transaction: payload.transaction,
        runId: payload.runId,
        resource: payload.resource,
        paymentIntentId: payload.paymentIntentId,
        paymentNonce: payload.paymentNonce,
        settlementNonce: payload.settlementNonce,
        amountMist: payload.amountMist,
        receiverAddress: payload.receiverAddress,
        workerAgentId: payload.workerAgentId,
        recordedAt,
      };
      ledger.records.push(record);
      await this.write(ledger);
      return record;
    });
  }

  async list(): Promise<ReplayLedgerRecord[]> {
    return (await this.read()).records;
  }

  private async read(): Promise<ReplayLedgerFile> {
    try {
      const text = await readFile(this.pathForLedger(), 'utf8');
      const parsed = JSON.parse(text) as ReplayLedgerFile;
      return {
        objectType: 'walrusproof.x402_replay_ledger.v1',
        version: 1,
        records: Array.isArray(parsed.records) ? parsed.records : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { objectType: 'walrusproof.x402_replay_ledger.v1', version: 1, records: [] };
      }
      throw error;
    }
  }

  private async write(ledger: ReplayLedgerFile): Promise<void> {
    await mkdir(this.receiptsDir, { recursive: true });
    const filePath = this.pathForLedger();
    const tempPath = `${filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
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

  private pathForLedger(): string {
    return path.join(this.receiptsDir, 'x402-replay-ledger.json');
  }
}

function replayKey(payload: X402SuiPaymentPayload): string {
  return [
    payload.network,
    payload.paymentIntentId,
    payload.paymentNonce,
    payload.settlementNonce,
    payload.resource,
    payload.amountMist,
    payload.receiverAddress.toLowerCase(),
    payload.workerAgentId,
  ].join(':');
}
