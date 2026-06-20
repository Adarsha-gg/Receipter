import { stableHash } from '../live/hash.js';
import type { ScoutClaim, ScoutEvidence, SourceObservation, SourceReceipt } from '../live/types.js';

export interface ScoutResult {
  title: string;
  url: string;
  source: string;
  sourceObservationId: string;
  points: number | undefined;
  createdAt: string | undefined;
  reason: string;
}

export interface ScoutReport {
  query: string;
  generatedAt: string;
  results: ScoutResult[];
  warnings: string[];
  sourceReceipt: SourceReceipt;
  claims: ScoutClaim[];
  evidence: ScoutEvidence;
}

type FetchLike = typeof fetch;

interface HnHit {
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  points?: number;
  created_at?: string;
}

interface HnResponse {
  hits?: HnHit[];
}

interface GitHubRepoItem {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  updated_at?: string;
}

interface GitHubSearchResponse {
  items?: GitHubRepoItem[];
}

interface ScoutCandidate {
  result: ScoutResult;
  observation: SourceObservation;
}

export async function scoutOpportunities(
  taskText: string,
  options: { fetchImpl?: FetchLike; now?: Date; limit?: number } = {},
): Promise<ScoutReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const limit = options.limit ?? 6;
  const query = extractScoutQuery(taskText);
  const generatedAt = now.toISOString();
  const warnings: string[] = [];
  const candidates: ScoutCandidate[] = [];

  const hnResults = await fetchHackerNews(query, generatedAt, fetchImpl).catch((error) => {
    warnings.push(`Hacker News search failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  });
  candidates.push(...hnResults);

  const githubResults = await fetchGitHubRepos(query, generatedAt, fetchImpl).catch((error) => {
    warnings.push(`GitHub search failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  });
  candidates.push(...githubResults);

  const deduped = dedupeResults(candidates).slice(0, limit);
  if (deduped.length === 0) {
    warnings.push('No public results found. Try a broader task like "find AI agent hackathons".');
  }

  const results = deduped.map((candidate) => candidate.result);
  const observations = deduped.map((candidate) => candidate.observation);
  const sourceReceipt = buildSourceReceipt(query, generatedAt, observations, warnings);
  const claims = buildScoutClaims(results);
  const evidence = buildScoutEvidence(query, generatedAt, sourceReceipt, claims);

  return {
    query,
    generatedAt,
    results,
    warnings,
    sourceReceipt,
    claims,
    evidence,
  };
}

export function renderScoutReport(report: ScoutReport): string {
  const lines = [
    `Opportunity Scout Report`,
    `Generated: ${report.generatedAt}`,
    `Search: ${report.query}`,
    '',
  ];

  if (report.results.length > 0) {
    lines.push('Found links:');
    report.results.forEach((result, index) => {
      const score = result.points === undefined ? '' : ` - score ${result.points}`;
      lines.push(`${index + 1}. ${result.title}`);
      lines.push(`   Source: ${result.source}${score}`);
      lines.push(`   Link: ${result.url}`);
      lines.push(`   Why it matters: ${result.reason}`);
    });
  } else {
    lines.push('No links found.');
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Warnings:');
    report.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  return lines.join('\n');
}

export function extractScoutQuery(taskText: string): string {
  const normalized = taskText
    .replace(/^\s*Max payment:.*$/gim, ' ')
    .replace(/^\s*Checker pack:.*$/gim, ' ')
    .replace(/^\s*Acceptance criteria:.*$/gim, ' ')
    .replace(/^\s*Do not (ask for|request).*$/gim, ' ')
    .replace(/Task:/gi, ' ')
    .replace(/Instructions:/gi, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const seen = new Set<string>();
  const words = normalized
    .split(' ')
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => {
      if (seen.has(word)) return false;
      seen.add(word);
      return true;
    });

  const query = words.slice(0, 4).join(' ').trim();
  return query || 'AI agent hackathon opportunities';
}

async function fetchHackerNews(query: string, observedAt: string, fetchImpl: FetchLike): Promise<ScoutCandidate[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as HnResponse;

  return (data.hits ?? [])
    .map((hit): ScoutCandidate | undefined => {
      const title = hit.title ?? hit.story_title;
      const link = hit.url ?? hit.story_url;
      if (!title || !link) return undefined;
      const observation = buildSourceObservation({
        source: 'hacker_news',
        sourceLabel: 'Hacker News',
        endpoint: url,
        query,
        observedAt,
        title,
        url: link,
        score: hit.points,
        publishedAt: hit.created_at,
        record: toRecord(hit),
      });
      return {
        observation,
        result: {
          title,
          url: link,
          source: 'Hacker News',
          sourceObservationId: observation.observationId,
          points: hit.points,
          createdAt: hit.created_at,
          reason: 'Public discussion result related to the task query.',
        },
      };
    })
    .filter((candidate): candidate is ScoutCandidate => Boolean(candidate));
}

async function fetchGitHubRepos(query: string, observedAt: string, fetchImpl: FetchLike): Promise<ScoutCandidate[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=5`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as GitHubSearchResponse;

  return (data.items ?? [])
    .map((repo): ScoutCandidate | undefined => {
      if (!repo.full_name || !repo.html_url) return undefined;
      const observation = buildSourceObservation({
        source: 'github',
        sourceLabel: 'GitHub',
        endpoint: url,
        query,
        observedAt,
        title: repo.full_name,
        url: repo.html_url,
        score: repo.stargazers_count,
        publishedAt: repo.updated_at,
        record: toRecord(repo),
      });
      return {
        observation,
        result: {
          title: repo.full_name,
          url: repo.html_url,
          source: 'GitHub',
          sourceObservationId: observation.observationId,
          points: repo.stargazers_count,
          createdAt: repo.updated_at,
          reason: repo.description ?? 'Recently updated public repository related to the task query.',
        },
      };
    })
    .filter((candidate): candidate is ScoutCandidate => Boolean(candidate));
}

function buildSourceObservation(input: Omit<SourceObservation, 'observationId' | 'recordHash'>): SourceObservation {
  const recordHash = stableHash(input.record);
  const observationHash = stableHash({
    source: input.source,
    endpoint: input.endpoint,
    query: input.query,
    title: input.title,
    url: input.url,
    recordHash,
  });
  const observation: SourceObservation = {
    ...input,
    observationId: `source_${observationHash.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    recordHash,
  };
  return observation;
}

function buildSourceReceipt(query: string, generatedAt: string, observations: SourceObservation[], warnings: string[]): SourceReceipt {
  const body = {
    schema: 'receipter.source_receipt.v1' as const,
    generatedAt,
    query,
    observations,
    warnings,
  };
  const receiptHash = stableHash(body);
  return {
    ...body,
    receiptId: `source_receipt_${receiptHash.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    receiptHash,
  };
}

function buildScoutClaims(results: ScoutResult[]): ScoutClaim[] {
  return results.map((result, index) => ({
    claimId: `claim_${index + 1}_${result.sourceObservationId}`,
    resultIndex: index + 1,
    title: result.title,
    url: result.url,
    sourceObservationId: result.sourceObservationId,
    statement: `${result.source} result "${result.title}" was used in the rendered Opportunity Scout report.`,
  }));
}

function buildScoutEvidence(query: string, generatedAt: string, sourceReceipt: SourceReceipt, claims: ScoutClaim[]): ScoutEvidence {
  const body = {
    schema: 'receipter.scout_evidence.v1' as const,
    generatedAt,
    query,
    sourceReceipt,
    claims,
  };
  return {
    ...body,
    evidenceHash: stableHash(body),
  };
}

function toRecord(value: object): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) record[key] = item;
  }
  return record;
}

function dedupeResults(candidates: ScoutCandidate[]): ScoutCandidate[] {
  const seen = new Set<string>();
  const deduped: ScoutCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.result.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'only',
  'from',
  'into',
  'make',
  'use',
  'find',
  'search',
  'bring',
  'back',
  'short',
  'useful',
  'practical',
  'public',
  'active',
  'payment',
  'sui',
  'usdc',
  'checker',
  'pack',
  'research',
  'code',
  'commerce',
  'acceptance',
  'criteria',
  'return',
  'links',
  'link',
  'include',
  'sources',
  'source',
  'real',
  'material',
  'request',
  'worker',
  'private',
  'buyer-private',
]);
