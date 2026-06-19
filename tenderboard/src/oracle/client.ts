import type { AgentMemoryPassport, WalrusMemoryIndex } from '../live/types.js';
import type { StakeChallengeAssessment, StakeChallengeRequest } from '../live/challengeOracle.js';
import type { VerifiedMemoryRecord, VerifiedPassport } from '../live/memoryVerifier.js';

export interface WalrusProofOracleClient {
  getMemoryIndex(): Promise<WalrusMemoryIndex>;
  getPassport(workerAgentId: string): Promise<AgentMemoryPassport>;
  verifyRecord(runId: string): Promise<VerifiedMemoryRecord>;
  verifyPassport(workerAgentId: string): Promise<VerifiedPassport>;
  verifyPassportByOwner(ownerAddress: string): Promise<VerifiedPassport>;
  assessStakeChallenge(runId: string, request: StakeChallengeRequest): Promise<StakeChallengeAssessment>;
}

export function createWalrusProofOracleClient(input: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): WalrusProofOracleClient {
  const baseUrl = input.baseUrl.replace(/\/+$/, '');
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    getMemoryIndex: () => getJson<WalrusMemoryIndex>(fetchImpl, `${baseUrl}/api/walrus/memory`),
    getPassport: (workerAgentId) =>
      getJson<AgentMemoryPassport>(fetchImpl, `${baseUrl}/api/walrus/memory/${encodeURIComponent(workerAgentId)}`),
    verifyRecord: (runId) =>
      getJson<VerifiedMemoryRecord>(fetchImpl, `${baseUrl}/api/oracle/records/${encodeURIComponent(runId)}/verify`),
    verifyPassport: (workerAgentId) =>
      getJson<VerifiedPassport>(fetchImpl, `${baseUrl}/api/oracle/passports/${encodeURIComponent(workerAgentId)}/verify`),
    verifyPassportByOwner: (ownerAddress) =>
      getJson<VerifiedPassport>(
        fetchImpl,
        `${baseUrl}/api/oracle/owners/${encodeURIComponent(ownerAddress)}/passport/verify`,
      ),
    assessStakeChallenge: (runId, request) =>
      postJson<StakeChallengeAssessment>(
        fetchImpl,
        `${baseUrl}/api/oracle/records/${encodeURIComponent(runId)}/challenges/assess`,
        request,
      ),
  };
}

async function getJson<T>(fetchImpl: typeof fetch, url: string): Promise<T> {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

async function postJson<T>(fetchImpl: typeof fetch, url: string, body: unknown): Promise<T> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const responseBody = (await response.json()) as unknown;
  if (!response.ok) {
    const message = isRecord(responseBody) && typeof responseBody.error === 'string' ? responseBody.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return responseBody as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
