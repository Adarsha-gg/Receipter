import { describe, expect, it } from 'vitest';
import { extractScoutQuery, renderScoutReport, scoutOpportunities } from '../src/agents/opportunityScout.js';

describe('opportunity scout', () => {
  it('extracts a useful query from task text', () => {
    expect(extractScoutQuery('Task: Find AI agent hackathons and grants for web3 builders')).toContain('agent');
  });

  it('fetches real-source shaped results and renders links', async () => {
    const fetchImpl = async (url: string | URL | Request) => {
      const text = String(url);
      if (text.includes('hn.algolia.com')) {
        return jsonResponse({ hits: [{ title: 'AI agent hackathon', url: 'https://example.com/hackathon', points: 42, created_at: '2026-06-18T00:00:00.000Z' }] });
      }
      return jsonResponse({ items: [{ full_name: 'agent/project', html_url: 'https://github.com/agent/project', description: 'agent tooling', stargazers_count: 7, updated_at: '2026-06-18T00:00:00.000Z' }] });
    };

    const report = await scoutOpportunities('Find AI agent hackathons', {
      fetchImpl: fetchImpl as typeof fetch,
      now: new Date('2026-06-18T20:30:00.000Z'),
    });
    const rendered = renderScoutReport(report);

    expect(report.results).toHaveLength(2);
    expect(rendered).toContain('https://example.com/hackathon');
    expect(rendered).toContain('https://github.com/agent/project');
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
