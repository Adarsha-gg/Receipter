import { describe, expect, it } from 'vitest';
import type { TenderBoardConfig } from '../src/live/types.js';
import {
  buildAttachStakeCliArgs,
  buildCreateOracleRegistryCliArgs,
  buildIssueChallengeDecisionCliArgs,
  buildOpenStakePositionCliArgs,
  buildSlashStakeInputFromAssessment,
  buildSlashStakeCliArgs,
  buildSlashStakeWithDecisionCliArgs,
  parseCreatedObjectId,
  parseStakePositionObjectId,
} from '../src/sui/stakeExecutor.js';
import { textToHexBytes } from '../src/sui/anchorExecutor.js';

describe('Sui reputation stake executor', () => {
  it('builds a PTB that opens a worker stake position with SUI', () => {
    const args = buildOpenStakePositionCliArgs(
      { workerAgentId: 'sui_opportunity_scout', amountMist: '1000000' },
      sampleConfig(),
    );

    expect(args.slice(0, 6)).toEqual(['client', '--client.config', 'client.yaml', 'ptb', '--make-move-vec', '<u8>']);
    expect(args).toContain('[115,117,105,95,111,112,112,111,114,116,117,110,105,116,121,95,115,99,111,117,116]');
    expect(args).toContain('--split-coins');
    expect(args).toContain('[1000000]');
    expect(args).toContain('--move-call');
    expect(args).toContain('0xpackage::reputation_stake::open_position');
    expect(args.at(-1)).toBe('--json');
  });

  it('builds a challenge slash call with evidence hash and reason encoded as bytes', () => {
    const args = buildSlashStakeCliArgs(
      {
        positionId: '0xstake',
        evidenceHash: 'sha256:evidence',
        reason: 'forged Walrus record',
        slashAmountMist: '100000',
      },
      sampleConfig(),
    );
    const moveArgs = args.slice(args.indexOf('--args') + 1, args.indexOf('--gas-budget'));

    expect(args).toContain('challenge_and_slash');
    expect(moveArgs).toEqual([
      '0xstake',
      textToHexBytes('sha256:evidence'),
      textToHexBytes('forged Walrus record'),
      '100000',
    ]);
  });

  it('builds a PTB that attaches more SUI to an existing stake position', () => {
    const args = buildAttachStakeCliArgs({ positionId: '0xstake', amountMist: '250000' }, sampleConfig());

    expect(args.slice(0, 4)).toEqual(['client', '--client.config', 'client.yaml', 'ptb']);
    expect(args).toContain('--split-coins');
    expect(args).toContain('[250000]');
    expect(args).toContain('--move-call');
    expect(args).toContain('0xpackage::reputation_stake::add_stake');
    expect(args).toContain('@0xstake');
    expect(args).toContain('stake.0');
    expect(args.at(-1)).toBe('--json');
  });

  it('builds oracle registry, decision, and decision-slash calls', () => {
    expect(buildCreateOracleRegistryCliArgs(sampleConfig())).toEqual([
      'client',
      '--client.config',
      'client.yaml',
      'call',
      '--package',
      '0xpackage',
      '--module',
      'reputation_stake',
      '--function',
      'create_oracle_registry',
      '--gas-budget',
      '100000000',
      '--json',
    ]);

    const decisionArgs = buildIssueChallengeDecisionCliArgs(
      {
        oracleRegistryId: '0xoracle',
        positionId: '0xstake',
        evidenceHash: 'sha256:evidence',
        reason: 'verifier failure',
        slashAmountMist: '100000',
      },
      sampleConfig(),
    );
    expect(decisionArgs).toContain('issue_challenge_decision');
    expect(decisionArgs.slice(decisionArgs.indexOf('--args') + 1, decisionArgs.indexOf('--gas-budget'))).toEqual([
      '0xoracle',
      '0xstake',
      textToHexBytes('sha256:evidence'),
      textToHexBytes('verifier failure'),
      '100000',
    ]);

    const slashArgs = buildSlashStakeWithDecisionCliArgs(
      { positionId: '0xstake', challengeDecisionId: '0xdecision' },
      sampleConfig(),
    );
    expect(slashArgs).toContain('slash_with_decision');
    expect(slashArgs.slice(slashArgs.indexOf('--args') + 1, slashArgs.indexOf('--gas-budget'))).toEqual([
      '0xstake',
      '0xdecision',
    ]);
  });

  it('extracts the created StakePosition id from Sui JSON output', () => {
    const objectId = parseStakePositionObjectId(
      {
        objectChanges: [
          { type: 'created', objectType: '0xpackage::other::Thing', objectId: '0xnope' },
          { type: 'created', objectType: '0xpackage::reputation_stake::StakePosition', objectId: '0xstake' },
        ],
      },
      sampleConfig(),
    );

    expect(objectId).toBe('0xstake');
  });

  it('extracts oracle registry and challenge decision ids from Sui JSON output', () => {
    const parsed = {
      objectChanges: [
        { type: 'created', objectType: '0xpackage::reputation_stake::OracleRegistry', objectId: '0xoracle' },
        { type: 'created', objectType: '0xpackage::reputation_stake::ChallengeDecision', objectId: '0xdecision' },
      ],
    };

    expect(parseCreatedObjectId(parsed, sampleConfig(), 'OracleRegistry')).toBe('0xoracle');
    expect(parseCreatedObjectId(parsed, sampleConfig(), 'ChallengeDecision')).toBe('0xdecision');
  });

  it('extracts created object ids when upgraded packages emit original package object types', () => {
    const parsed = {
      objectChanges: [
        { type: 'created', objectType: '0xoriginal::reputation_stake::StakePosition', objectId: '0xstake' },
      ],
    };

    expect(parseCreatedObjectId(parsed, sampleConfig(), 'StakePosition')).toBe('0xstake');
  });

  it('refuses to build a slash input from a non-admissible challenge assessment', () => {
    expect(() =>
      buildSlashStakeInputFromAssessment({
        objectType: 'walrusproof.stake_challenge_assessment.v1',
        runId: 'run_clean',
        workerAgentId: 'sui_worker',
        stakePositionId: '0xstake',
        challengerAddress: undefined,
        evidenceHash: 'sha256:evidence',
        reason: 'clean record',
        requestedSlashAmountMist: '100000',
        admissible: false,
        checks: [{ id: 'verifier_failures', status: 'skipped', detail: 'No failures.' }],
        verifierFailures: [],
        weakClaims: [],
        slashableCheckIds: [],
      }),
    ).toThrow('not slash-admissible');
  });

  it('derives slash Move input from an admissible challenge assessment', () => {
    const input = buildSlashStakeInputFromAssessment({
      objectType: 'walrusproof.stake_challenge_assessment.v1',
      runId: 'run_bad',
      workerAgentId: 'sui_worker',
      stakePositionId: '0xstake',
      challengerAddress: undefined,
      evidenceHash: 'sha256:evidence',
      reason: 'Walrus readback failed',
      requestedSlashAmountMist: '100000',
      admissible: true,
      checks: [{ id: 'verifier_failures', status: 'passed', detail: 'walrus_readback failed.' }],
      verifierFailures: [{ id: 'walrus_readback', status: 'failed', detail: 'HTTP 404.' }],
      weakClaims: [],
      slashableCheckIds: ['walrus_readback'],
    });

    expect(input).toMatchObject({
      positionId: '0xstake',
      evidenceHash: 'sha256:evidence',
      slashAmountMist: '100000',
    });
    expect(input.reason).toContain('oracle-admissible:run_bad');
  });
});

function sampleConfig(): TenderBoardConfig {
  return {
    suiPackageId: '0xpackage',
    suiClientConfig: 'client.yaml',
  } as TenderBoardConfig;
}
