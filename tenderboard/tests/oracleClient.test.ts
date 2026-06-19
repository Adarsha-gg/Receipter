import { describe, expect, it } from 'vitest';
import { createWalrusProofOracleClient } from '../src/oracle/index.js';

describe('WalrusProof oracle client', () => {
  it('calls the owner-address passport verification endpoint', async () => {
    const calls: string[] = [];
    const client = createWalrusProofOracleClient({
      baseUrl: 'https://oracle.example/',
      fetchImpl: async (input) => {
        calls.push(String(input));
        return new Response(
          JSON.stringify({
            objectType: 'walrusproof.verified_passport.v1',
            workerAgentId: 'sui_opportunity_scout',
            verified: true,
            passport: {
              workerAgentId: 'sui_opportunity_scout',
              ownerAddress: '0xworker',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    const verified = await client.verifyPassportByOwner('0xworker');

    expect(calls).toEqual(['https://oracle.example/api/oracle/owners/0xworker/passport/verify']);
    expect(verified).toMatchObject({
      objectType: 'walrusproof.verified_passport.v1',
      verified: true,
      passport: {
        ownerAddress: '0xworker',
      },
    });
  });

  it('surfaces oracle errors from JSON responses', async () => {
    const client = createWalrusProofOracleClient({
      baseUrl: 'https://oracle.example',
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'No worker passport is bound to that Sui owner address.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(client.verifyPassportByOwner('0xmissing')).rejects.toThrow(
      'No worker passport is bound to that Sui owner address.',
    );
  });

  it('posts stake challenge assessments to the oracle endpoint', async () => {
    const calls: Array<{ input: string; init: RequestInit | undefined }> = [];
    const client = createWalrusProofOracleClient({
      baseUrl: 'https://oracle.example',
      fetchImpl: async (input, init) => {
        calls.push({ input: String(input), init });
        return new Response(
          JSON.stringify({
            objectType: 'walrusproof.stake_challenge_assessment.v1',
            runId: 'run_bad',
            workerAgentId: 'sui_worker',
            stakePositionId: '0xstake',
            evidenceHash: 'sha256:evidence',
            reason: 'Walrus readback failed',
            admissible: true,
            checks: [],
            verifierFailures: [{ id: 'walrus_readback', status: 'failed', detail: 'HTTP 404.' }],
            weakClaims: [],
            slashableCheckIds: ['walrus_readback'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });

    const assessment = await client.assessStakeChallenge('run_bad', {
      stakePositionId: '0xstake',
      reason: 'Walrus readback failed',
      slashAmountMist: '100000',
    });

    expect(calls[0]?.input).toBe('https://oracle.example/api/oracle/records/run_bad/challenges/assess');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      stakePositionId: '0xstake',
      reason: 'Walrus readback failed',
      slashAmountMist: '100000',
    });
    expect(assessment).toMatchObject({
      admissible: true,
      slashableCheckIds: ['walrus_readback'],
    });
  });

  it('surfaces challenge assessment errors from JSON responses', async () => {
    const client = createWalrusProofOracleClient({
      baseUrl: 'https://oracle.example',
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'reason must explain the challenge.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(client.assessStakeChallenge('run_bad', { stakePositionId: '0xstake', reason: 'bad' })).rejects.toThrow(
      'reason must explain the challenge.',
    );
  });
});
