import { describe, expect, it } from 'vitest';
import { extractScoutQuery, renderScoutReport, scoutOpportunities } from '../src/agents/opportunityScout.js';
import { stableHash } from '../src/live/hash.js';

describe('opportunity scout', () => {
  it('extracts a useful query from task text', () => {
    expect(extractScoutQuery('Task: Find AI agent hackathons and grants for web3 builders')).toContain('agent');
  });

  it('keeps receipt metadata out of the live scout query', () => {
    const receiptShapedTask = `Task: Find AI agent hackathons
Max payment: 0.04 SUI
Checker pack: research

Instructions:
Find AI agent hackathons and builder opportunities

Acceptance criteria:
- Return real links
- Include sources

Do not request buyer-private material.`;

    expect(extractScoutQuery(receiptShapedTask)).toBe('agent hackathons builder opportunities');
  });

  it('fetches real-source shaped results and renders links', async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const text = String(url);
      if (text.includes('hn.algolia.com')) {
        return jsonResponse({ hits: [{ objectID: 'hn_1', title: 'AI agent hackathon', url: 'https://example.com/hackathon', points: 42, created_at: '2026-06-18T00:00:00.000Z' }] });
      }
      return jsonResponse({ items: [{ id: 99, full_name: 'agent/project', html_url: 'https://github.com/agent/project', description: 'agent tooling', stargazers_count: 7, updated_at: '2026-06-18T00:00:00.000Z' }] });
    };

    const report = await scoutOpportunities('Find AI agent hackathons', {
      fetchImpl: fetchImpl as typeof fetch,
      now: new Date('2026-06-18T20:30:00.000Z'),
    });
    const rendered = renderScoutReport(report);

    expect(report.results).toHaveLength(2);
    expect(report.evidence).toMatchObject({
      schema: 'receipter.scout_evidence.v1',
      sourceReceipt: {
        schema: 'receipter.source_receipt.v1',
      },
    });
    expect(report.sourceReceipt.observations).toHaveLength(2);
    expect(report.sourceReceipt.observations[0]?.record).toMatchObject({ objectID: 'hn_1' });
    expect(report.sourceReceipt.observations[1]?.record).toMatchObject({ id: 99 });
    const observationIds = new Set(report.sourceReceipt.observations.map((observation) => observation.observationId));
    expect(report.claims.every((claim) => observationIds.has(claim.sourceObservationId))).toBe(true);
    expect(report.sourceReceipt.receiptHash).toBe(
      stableHash({
        schema: report.sourceReceipt.schema,
        generatedAt: report.sourceReceipt.generatedAt,
        query: report.sourceReceipt.query,
        observations: report.sourceReceipt.observations,
        warnings: report.sourceReceipt.warnings,
      }),
    );
    expect(report.evidence.evidenceHash).toBe(
      stableHash({
        schema: report.evidence.schema,
        generatedAt: report.evidence.generatedAt,
        query: report.evidence.query,
        sourceReceipt: report.evidence.sourceReceipt,
        claims: report.evidence.claims,
      }),
    );
    expect(rendered).toContain('https://example.com/hackathon');
    expect(rendered).toContain('https://github.com/agent/project');
  });

  it('hashes canonical JSON independent of object key order', () => {
    expect(stableHash({ b: 2, a: { d: 4, c: 3 } })).toBe(stableHash({ a: { c: 3, d: 4 }, b: 2 }));
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
