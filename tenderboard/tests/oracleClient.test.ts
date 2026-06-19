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
});
