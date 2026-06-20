import type { TenderBoardConfig } from '../live/types.js';
import { textToHexBytes } from './anchorExecutor.js';
import type {
  AttachStakeInput,
  IssueChallengeDecisionInput,
  OpenStakePositionInput,
  SlashStakeInput,
  SlashStakeWithDecisionInput,
} from './stakeExecutor.js';
import {
  assertPositiveMist,
  assertSuiObjectId,
  assertUtf8MoveText,
  assertWorkerAgentId,
  configuredStakePackageId,
} from './stakeValidation.js';

const STAKE_MODULE = 'reputation_stake' as const;
const STAKE_GAS_BUDGET_MIST = '100000000';

export type SuiStakeWalletTransactionKind =
  | 'open_stake'
  | 'attach_stake'
  | 'raise_challenge'
  | 'resolve_challenge'
  | 'slash_stake'
  | 'record_oracle_registry';

export type ReputationStakeFunction =
  | 'open_position'
  | 'add_stake'
  | 'issue_challenge_decision'
  | 'slash_with_decision'
  | 'challenge_and_slash'
  | 'create_oracle_registry';

export type StakeObjectType = 'StakePosition' | 'OracleRegistry' | 'ChallengeDecision';

export type SuiStakeWalletArgument =
  | {
      kind: 'pure';
      valueType: 'vector<u8>';
      value: string;
      hex: string;
    }
  | {
      kind: 'pure';
      valueType: 'u64';
      value: string;
    }
  | {
      kind: 'object';
      objectId: string;
      usage: 'immutable' | 'mutable' | 'owned';
    }
  | {
      kind: 'result';
      from: 'splitCoins';
      assign: string;
      index: 0;
    };

export type SuiStakeWalletCommand =
  | {
      kind: 'splitCoins';
      coin: 'gas';
      amounts: [string];
      assign: string;
    }
  | {
      kind: 'moveCall';
      target: `${string}::${typeof STAKE_MODULE}::${ReputationStakeFunction}`;
      arguments: SuiStakeWalletArgument[];
      assignResult: string | undefined;
    };

export interface SuiStakeWalletTransactionRequest {
  objectType: 'walrusproof.sui_stake_wallet_transaction_request.v1';
  version: 1;
  kind: SuiStakeWalletTransactionKind;
  network: string;
  senderAddress: string | undefined;
  packageId: string;
  module: typeof STAKE_MODULE;
  function: ReputationStakeFunction;
  gasBudgetMist: string;
  summary: string;
  moveCall: {
    target: `${string}::${typeof STAKE_MODULE}::${ReputationStakeFunction}`;
    arguments: SuiStakeWalletArgument[];
  };
  commands: SuiStakeWalletCommand[];
  expected: {
    createdObjectType: StakeObjectType | undefined;
    events: string[];
    digestRequired: true;
  };
  cliFallback: {
    available: true;
    requires: string[];
  };
}

export function buildOpenStakePositionWalletRequest(
  input: OpenStakePositionInput,
  config: TenderBoardConfig,
): SuiStakeWalletTransactionRequest {
  validateOpenStakePositionInput(input);
  const packageId = configuredStakePackageId(config);
  const stakeCoin = resultArgument('stake');
  return request({
    kind: 'open_stake',
    config,
    packageId,
    functionName: 'open_position',
    summary: `Open Sui stake for ${input.workerAgentId}.`,
    arguments: [bytesArgument(input.workerAgentId), stakeCoin],
    commands: [splitCoinsCommand(input.amountMist, 'stake'), moveCallCommand(packageId, 'open_position', [bytesArgument(input.workerAgentId), stakeCoin])],
    createdObjectType: 'StakePosition',
    events: ['StakeOpened'],
  });
}

export function buildAttachStakeWalletRequest(
  input: AttachStakeInput,
  config: TenderBoardConfig,
): SuiStakeWalletTransactionRequest {
  validateAttachStakeInput(input);
  const packageId = configuredStakePackageId(config);
  const stakeCoin = resultArgument('stake');
  return request({
    kind: 'attach_stake',
    config,
    packageId,
    functionName: 'add_stake',
    summary: `Attach SUI stake to ${input.positionId}.`,
    arguments: [objectArgument(input.positionId, 'mutable'), stakeCoin],
    commands: [
      splitCoinsCommand(input.amountMist, 'stake'),
      moveCallCommand(packageId, 'add_stake', [objectArgument(input.positionId, 'mutable'), stakeCoin]),
    ],
    createdObjectType: undefined,
    events: ['StakeAdded'],
  });
}

export function buildRaiseChallengeWalletRequest(
  input: IssueChallengeDecisionInput,
  config: TenderBoardConfig,
): SuiStakeWalletTransactionRequest {
  validateIssueChallengeDecisionInput(input);
  const packageId = configuredStakePackageId(config);
  const args = [
    objectArgument(input.oracleRegistryId, 'mutable'),
    objectArgument(input.positionId, 'immutable'),
    bytesArgument(input.evidenceHash),
    bytesArgument(input.reason),
    u64Argument(input.slashAmountMist),
  ];
  return request({
    kind: 'raise_challenge',
    config,
    packageId,
    functionName: 'issue_challenge_decision',
    summary: `Record a slash challenge decision for ${input.positionId}.`,
    arguments: args,
    commands: [moveCallCommand(packageId, 'issue_challenge_decision', args, 'challengeDecision')],
    createdObjectType: 'ChallengeDecision',
    events: ['ChallengeDecisionIssued'],
  });
}

export function buildResolveChallengeWalletRequest(
  input: SlashStakeWithDecisionInput,
  config: TenderBoardConfig,
): SuiStakeWalletTransactionRequest {
  validateSlashStakeWithDecisionInput(input);
  const packageId = configuredStakePackageId(config);
  const args = [objectArgument(input.positionId, 'mutable'), objectArgument(input.challengeDecisionId, 'owned')];
  return request({
    kind: 'resolve_challenge',
    config,
    packageId,
    functionName: 'slash_with_decision',
    summary: `Resolve challenge decision ${input.challengeDecisionId} against ${input.positionId}.`,
    arguments: args,
    commands: [moveCallCommand(packageId, 'slash_with_decision', args)],
    createdObjectType: undefined,
    events: ['StakeSlashed'],
  });
}

export function buildSlashStakeWalletRequest(
  input: SlashStakeInput,
  config: TenderBoardConfig,
): SuiStakeWalletTransactionRequest {
  validateSlashStakeInput(input);
  const packageId = configuredStakePackageId(config);
  const args = [
    objectArgument(input.positionId, 'mutable'),
    bytesArgument(input.evidenceHash),
    bytesArgument(input.reason),
    u64Argument(input.slashAmountMist),
  ];
  return request({
    kind: 'slash_stake',
    config,
    packageId,
    functionName: 'challenge_and_slash',
    summary: `Challenge and slash ${input.positionId}.`,
    arguments: args,
    commands: [moveCallCommand(packageId, 'challenge_and_slash', args)],
    createdObjectType: undefined,
    events: ['StakeSlashed'],
  });
}

export function buildCreateOracleRegistryWalletRequest(config: TenderBoardConfig): SuiStakeWalletTransactionRequest {
  const packageId = configuredStakePackageId(config);
  return request({
    kind: 'record_oracle_registry',
    config,
    packageId,
    functionName: 'create_oracle_registry',
    summary: 'Create the Sui stake oracle registry.',
    arguments: [],
    commands: [moveCallCommand(packageId, 'create_oracle_registry', [], 'oracleRegistry')],
    createdObjectType: 'OracleRegistry',
    events: ['OracleRegistryCreated'],
  });
}

export function validateOpenStakePositionInput(input: OpenStakePositionInput): void {
  assertWorkerAgentId(input.workerAgentId);
  assertPositiveMist(input.amountMist, 'amountMist');
}

export function validateAttachStakeInput(input: AttachStakeInput): void {
  assertSuiObjectId(input.positionId, 'positionId');
  assertPositiveMist(input.amountMist, 'amountMist');
}

export function validateSlashStakeInput(input: SlashStakeInput): void {
  assertSuiObjectId(input.positionId, 'positionId');
  assertUtf8MoveText(input.evidenceHash, 'evidenceHash');
  assertUtf8MoveText(input.reason, 'reason');
  assertPositiveMist(input.slashAmountMist, 'slashAmountMist');
}

export function validateIssueChallengeDecisionInput(input: IssueChallengeDecisionInput): void {
  assertSuiObjectId(input.oracleRegistryId, 'oracleRegistryId');
  validateSlashStakeInput(input);
}

export function validateSlashStakeWithDecisionInput(input: SlashStakeWithDecisionInput): void {
  assertSuiObjectId(input.positionId, 'positionId');
  assertSuiObjectId(input.challengeDecisionId, 'challengeDecisionId');
}

function request(input: {
  kind: SuiStakeWalletTransactionKind;
  config: TenderBoardConfig;
  packageId: string;
  functionName: ReputationStakeFunction;
  summary: string;
  arguments: SuiStakeWalletArgument[];
  commands: SuiStakeWalletCommand[];
  createdObjectType: StakeObjectType | undefined;
  events: string[];
}): SuiStakeWalletTransactionRequest {
  const target = `${input.packageId}::${STAKE_MODULE}::${input.functionName}` as const;
  return {
    objectType: 'walrusproof.sui_stake_wallet_transaction_request.v1',
    version: 1,
    kind: input.kind,
    network: input.config.suiNetwork,
    senderAddress: input.config.workerAgentAddress ?? input.config.suiOperatorAddress,
    packageId: input.packageId,
    module: STAKE_MODULE,
    function: input.functionName,
    gasBudgetMist: STAKE_GAS_BUDGET_MIST,
    summary: input.summary,
    moveCall: {
      target,
      arguments: input.arguments,
    },
    commands: input.commands,
    expected: {
      createdObjectType: input.createdObjectType,
      events: input.events,
      digestRequired: true,
    },
    cliFallback: {
      available: true,
      requires: ['SUI_CLI_PATH'],
    },
  };
}

function splitCoinsCommand(amountMist: string, assign: string): SuiStakeWalletCommand {
  return {
    kind: 'splitCoins',
    coin: 'gas',
    amounts: [amountMist],
    assign,
  };
}

function moveCallCommand(
  packageId: string,
  functionName: ReputationStakeFunction,
  args: SuiStakeWalletArgument[],
  assignResult?: string,
): SuiStakeWalletCommand {
  return {
    kind: 'moveCall',
    target: `${packageId}::${STAKE_MODULE}::${functionName}`,
    arguments: args,
    assignResult,
  };
}

function bytesArgument(value: string): SuiStakeWalletArgument {
  return {
    kind: 'pure',
    valueType: 'vector<u8>',
    value,
    hex: textToHexBytes(value),
  };
}

function u64Argument(value: string): SuiStakeWalletArgument {
  return {
    kind: 'pure',
    valueType: 'u64',
    value,
  };
}

function objectArgument(objectId: string, usage: 'immutable' | 'mutable' | 'owned'): SuiStakeWalletArgument {
  return {
    kind: 'object',
    objectId,
    usage,
  };
}

function resultArgument(assign: string): SuiStakeWalletArgument {
  return {
    kind: 'result',
    from: 'splitCoins',
    assign,
    index: 0,
  };
}

