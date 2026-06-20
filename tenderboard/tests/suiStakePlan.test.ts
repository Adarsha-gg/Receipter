import { describe, expect, it } from 'vitest';
import type { TenderBoardConfig } from '../src/live/types.js';
import { textToHexBytes } from '../src/sui/anchorExecutor.js';
import {
  buildAttachStakeWalletRequest,
  buildCreateOracleRegistryWalletRequest,
  buildOpenStakePositionWalletRequest,
  buildRaiseChallengeWalletRequest,
  buildResolveChallengeWalletRequest,
  buildSlashStakeWalletRequest,
  validateAttachStakeInput,
  validateSlashStakeInput,
} from '../src/sui/stakePlan.js';

describe('Sui reputation stake wallet transaction plans', () => {
  it('builds a signer request for opening stake with split gas coin input', () => {
    const request = buildOpenStakePositionWalletRequest(
      { workerAgentId: 'sui_opportunity_scout', amountMist: '1000000' },
      sampleConfig(),
    );

    expect(request).toMatchObject({
      objectType: 'walrusproof.sui_stake_wallet_transaction_request.v1',
      kind: 'open_stake',
      network: 'testnet',
      senderAddress: '0x9999',
      packageId: '0x1234',
      module: 'reputation_stake',
      function: 'open_position',
      gasBudgetMist: '100000000',
      expected: {
        createdObjectType: 'StakePosition',
        events: ['StakeOpened'],
        digestRequired: true,
      },
    });
    expect(request.commands).toEqual([
      { kind: 'splitCoins', coin: 'gas', amounts: ['1000000'], assign: 'stake' },
      {
        kind: 'moveCall',
        target: '0x1234::reputation_stake::open_position',
        arguments: [
          {
            kind: 'pure',
            valueType: 'vector<u8>',
            value: 'sui_opportunity_scout',
            hex: textToHexBytes('sui_opportunity_scout'),
          },
          { kind: 'result', from: 'splitCoins', assign: 'stake', index: 0 },
        ],
        assignResult: undefined,
      },
    ]);
  });

  it('builds signer requests for attaching stake, direct slash, and decision-backed slash', () => {
    const attach = buildAttachStakeWalletRequest({ positionId: '0xabcd', amountMist: '250000' }, sampleConfig());
    expect(attach.kind).toBe('attach_stake');
    expect(attach.function).toBe('add_stake');
    expect(attach.moveCall.arguments).toEqual([
      { kind: 'object', objectId: '0xabcd', usage: 'mutable' },
      { kind: 'result', from: 'splitCoins', assign: 'stake', index: 0 },
    ]);
    expect(attach.expected.events).toEqual(['StakeAdded']);

    const slash = buildSlashStakeWalletRequest(
      {
        positionId: '0xabcd',
        evidenceHash: 'sha256:evidence',
        reason: 'forged Walrus record',
        slashAmountMist: '100000',
      },
      sampleConfig(),
    );
    expect(slash.kind).toBe('slash_stake');
    expect(slash.function).toBe('challenge_and_slash');
    expect(slash.moveCall.arguments).toEqual([
      { kind: 'object', objectId: '0xabcd', usage: 'mutable' },
      { kind: 'pure', valueType: 'vector<u8>', value: 'sha256:evidence', hex: textToHexBytes('sha256:evidence') },
      { kind: 'pure', valueType: 'vector<u8>', value: 'forged Walrus record', hex: textToHexBytes('forged Walrus record') },
      { kind: 'pure', valueType: 'u64', value: '100000' },
    ]);

    const resolved = buildResolveChallengeWalletRequest(
      { positionId: '0xabcd', challengeDecisionId: '0xdcba' },
      sampleConfig(),
    );
    expect(resolved.kind).toBe('resolve_challenge');
    expect(resolved.function).toBe('slash_with_decision');
    expect(resolved.moveCall.arguments).toEqual([
      { kind: 'object', objectId: '0xabcd', usage: 'mutable' },
      { kind: 'object', objectId: '0xdcba', usage: 'owned' },
    ]);
  });

  it('builds signer requests for challenge decision and oracle registry record paths', () => {
    const challenge = buildRaiseChallengeWalletRequest(
      {
        oracleRegistryId: '0xaaaa',
        positionId: '0xbbbb',
        evidenceHash: 'sha256:evidence',
        reason: 'verifier failure',
        slashAmountMist: '100000',
      },
      sampleConfig(),
    );

    expect(challenge.kind).toBe('raise_challenge');
    expect(challenge.function).toBe('issue_challenge_decision');
    expect(challenge.expected.createdObjectType).toBe('ChallengeDecision');
    expect(challenge.commands[0]).toMatchObject({
      kind: 'moveCall',
      target: '0x1234::reputation_stake::issue_challenge_decision',
      assignResult: 'challengeDecision',
    });
    expect(challenge.moveCall.arguments).toEqual([
      { kind: 'object', objectId: '0xaaaa', usage: 'mutable' },
      { kind: 'object', objectId: '0xbbbb', usage: 'immutable' },
      { kind: 'pure', valueType: 'vector<u8>', value: 'sha256:evidence', hex: textToHexBytes('sha256:evidence') },
      { kind: 'pure', valueType: 'vector<u8>', value: 'verifier failure', hex: textToHexBytes('verifier failure') },
      { kind: 'pure', valueType: 'u64', value: '100000' },
    ]);

    const registry = buildCreateOracleRegistryWalletRequest(sampleConfig());
    expect(registry.kind).toBe('record_oracle_registry');
    expect(registry.function).toBe('create_oracle_registry');
    expect(registry.expected).toMatchObject({
      createdObjectType: 'OracleRegistry',
      events: ['OracleRegistryCreated'],
    });
  });

  it('validates object ids and u64 stake amounts before producing wallet requests', () => {
    expect(() => validateAttachStakeInput({ positionId: 'stake', amountMist: '1' })).toThrow('positionId must be a Sui object id');
    expect(() => validateSlashStakeInput({ positionId: '0xabcd', evidenceHash: 'sha256:evidence', reason: 'bad', slashAmountMist: '0' })).toThrow(
      'slashAmountMist must be a positive u64 MIST amount',
    );
    expect(() => buildOpenStakePositionWalletRequest({ workerAgentId: 'worker', amountMist: '18446744073709551616' }, sampleConfig())).toThrow(
      'amountMist must be a positive u64 MIST amount',
    );
  });
});

function sampleConfig(): TenderBoardConfig {
  return {
    suiNetwork: 'testnet',
    suiPackageId: '0x1234',
    suiOperatorAddress: '0x9999',
  } as TenderBoardConfig;
}

