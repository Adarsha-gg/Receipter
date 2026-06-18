export interface ScoutResult {
  title: string;
  url: string;
  source: string;
  points: number | undefined;
  createdAt: string | undefined;
  reason: string;
}

export interface ScoutReport {
  query: string;
  generatedAt: string;
  results: ScoutResult[];
  warnings: string[];
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

export async function scoutOpportunities(
  taskText: string,
  options: { fetchImpl?: FetchLike; now?: Date; limit?: number } = {},
): Promise<ScoutReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const limit = options.limit ?? 6;
  const query = extractScoutQuery(taskText);
  const warnings: string[] = [];
  const results: ScoutResult[] = [];

  const hnResults = await fetchHackerNews(query, fetchImpl).catch((error) => {
    warnings.push(`Hacker News search failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  });
  results.push(...hnResults);

  const githubResults = await fetchGitHubRepos(query, fetchImpl).catch((error) => {
    warnings.push(`GitHub search failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  });
  results.push(...githubResults);

  const deduped = dedupeResults(results).slice(0, limit);
  if (deduped.length === 0) {
    warnings.push('No public results found. Try a broader task like "find AI agent hackathons".');
  }

  return {
    query,
    generatedAt: now.toISOString(),
    results: deduped,
    warnings,
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
      const score = result.points === undefined ? '' : ` — score ${result.points}`;
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
    .replace(/Task:/gi, ' ')
    .replace(/Instructions:/gi, ' ')
    .replace(/Max payment:.*/gi, ' ')
    .replace(/Do not ask for.*/gi, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = normalized
    .split(' ')
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word.toLowerCase()));

  const query = words.slice(0, 8).join(' ').trim();
  return query || 'AI agent hackathon opportunities';
}

async function fetchHackerNews(query: string, fetchImpl: FetchLike): Promise<ScoutResult[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as HnResponse;

  return (data.hits ?? [])
    .map((hit): ScoutResult | undefined => {
      const title = hit.title ?? hit.story_title;
      const link = hit.url ?? hit.story_url;
      if (!title || !link) return undefined;
      return {
        title,
        url: link,
        source: 'Hacker News',
        points: hit.points,
        createdAt: hit.created_at,
        reason: 'Public discussion result related to the task query.',
      };
    })
    .filter((result): result is ScoutResult => Boolean(result));
}

async function fetchGitHubRepos(query: string, fetchImpl: FetchLike): Promise<ScoutResult[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=5`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = (await response.json()) as GitHubSearchResponse;

  return (data.items ?? [])
    .map((repo): ScoutResult | undefined => {
      if (!repo.full_name || !repo.html_url) return undefined;
      return {
        title: repo.full_name,
        url: repo.html_url,
        source: 'GitHub',
        points: repo.stargazers_count,
        createdAt: repo.updated_at,
        reason: repo.description ?? 'Recently updated public repository related to the task query.',
      };
    })
    .filter((result): result is ScoutResult => Boolean(result));
}

function dedupeResults(results: ScoutResult[]): ScoutResult[] {
  const seen = new Set<string>();
  const deduped: ScoutResult[] = [];
  for (const result of results) {
    const key = result.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
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
  'from',
  'into',
  'make',
  'find',
  'search',
  'bring',
  'back',
  'short',
  'useful',
  'practical',
  'payment',
  'usdc',
]);
