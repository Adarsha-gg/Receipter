import { describe, expect, it } from 'vitest';
import { buildSeedDeliveryText, buildSeedEvidence, type SeedTask, validateSeedMemoryIndex } from '../src/cli/seedMemory.js';
import { stableHash } from '../src/live/hash.js';

describe('seed memory helpers', () => {
  it('builds deterministic source receipts and evidence hashes', () => {
    const evidence = buildSeedEvidence(sampleTask(), 0);

    expect(evidence.sourceReceipt.receiptHash).toBe(
      stableHash({
        schema: evidence.sourceReceipt.schema,
        generatedAt: evidence.sourceReceipt.generatedAt,
        query: evidence.sourceReceipt.query,
        observations: evidence.sourceReceipt.observations,
        warnings: evidence.sourceReceipt.warnings,
      }),
    );
    expect(evidence.evidenceHash).toBe(
      stableHash({
        schema: evidence.schema,
        generatedAt: evidence.generatedAt,
        query: evidence.query,
        sourceReceipt: evidence.sourceReceipt,
        claims: evidence.claims,
      }),
    );
    expect(evidence.claims.every((claim) => evidence.sourceReceipt.observations.some((obs) => obs.observationId === claim.sourceObservationId))).toBe(true);
    expect(buildSeedDeliveryText(sampleTask(), evidence)).toContain(evidence.claims[0]!.url);
  });

  it('fails loudly when seeded records are not fully anchored', () => {
    expect(() =>
      validateSeedMemoryIndex(
        {
          workerCount: 1,
          totalMemoryRecords: 6,
          walrusBackedRecords: 6,
          suiAnchoredRecords: 5,
          passports: [{ workerAgentId: 'worker', memoryCount: 6, averageClaimSupport: 100, anchoredMemoryCount: 5 }],
        },
        6,
      ),
    ).toThrow('Sui-anchored records');
  });

  it('accepts a complete deterministic seed index', () => {
    expect(() =>
      validateSeedMemoryIndex(
        {
          workerCount: 3,
          totalMemoryRecords: 6,
          walrusBackedRecords: 6,
          suiAnchoredRecords: 6,
          passports: [
            { workerAgentId: 'worker_a', memoryCount: 2, averageClaimSupport: 100, anchoredMemoryCount: 2 },
            { workerAgentId: 'worker_b', memoryCount: 2, averageClaimSupport: 100, anchoredMemoryCount: 2 },
          ],
        },
        6,
      ),
    ).not.toThrow();
  });
});

function sampleTask(): SeedTask {
  return {
    title: 'Find Walrus memory examples',
    instructions: 'Use public sources.',
    acceptanceCriteria: ['Return links.'],
    checkerPack: 'research',
    requestedDataLabel: 'public',
    amount: '0.050',
    preferredBidId: 'public_scout_standard',
    sources: [
      {
        title: 'Walrus Memory',
        url: 'https://github.com/MystenLabs/memwal',
        source: 'github',
        sourceLabel: 'GitHub',
        note: 'MemWal provides Walrus-backed semantic memory.',
      },
      {
        title: 'Walrus Docs',
        url: 'https://docs.wal.app',
        source: 'github',
        sourceLabel: 'Walrus Docs',
        note: 'Walrus stores durable blobs.',
      },
    ],
  };
}
