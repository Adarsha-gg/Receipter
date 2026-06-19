import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertStakeChallengeAdmissible, type StakeChallengeAssessment } from '../live/challengeOracle.js';
import type { TenderBoardConfig } from '../live/types.js';
import { textToHexBytes } from './anchorExecutor.js';

const execFileAsync = promisify(execFile);

export interface OpenStakePositionInput {
  workerAgentId: string;
  amountMist: string;
}

export interface SlashStakeInput {
  positionId: string;
  evidenceHash: string;
  reason: string;
  slashAmountMist: string;
}

export interface OpenStakePositionResult {
  digest: string;
  stakePositionId: string;
  stdout: string;
  stderr: string;
  args: string[];
}

export interface SlashStakeResult {
  digest: string;
  stdout: string;
  stderr: string;
  args: string[];
}

export async function executeOpenStakePosition(
  input: OpenStakePositionInput,
  config: TenderBoardConfig,
): Promise<OpenStakePositionResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui stake execution.');
  }

  const args = buildOpenStakePositionCliArgs(input, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout, 'Sui stake open transaction failed');
  return {
    digest: parsed.digest,
    stakePositionId: parseStakePositionObjectId(parsed.raw, config),
    stdout,
    stderr,
    args,
  };
}

export async function executeSlashStake(input: SlashStakeInput, config: TenderBoardConfig): Promise<SlashStakeResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui stake execution.');
  }

  const args = buildSlashStakeCliArgs(input, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout, 'Sui stake slash transaction failed');
  return { digest: parsed.digest, stdout, stderr, args };
}

export async function executeAdmissibleSlashStake(
  assessment: StakeChallengeAssessment,
  config: TenderBoardConfig,
): Promise<SlashStakeResult> {
  return executeSlashStake(buildSlashStakeInputFromAssessment(assessment), config);
}

export function buildSlashStakeInputFromAssessment(assessment: StakeChallengeAssessment): SlashStakeInput {
  assertStakeChallengeAdmissible(assessment);
  if (!assessment.requestedSlashAmountMist) {
    throw new Error('Stake challenge assessment is missing requestedSlashAmountMist.');
  }
  return {
    positionId: assessment.stakePositionId,
    evidenceHash: assessment.evidenceHash,
    reason: `oracle-admissible:${assessment.runId}:${assessment.reason}`,
    slashAmountMist: assessment.requestedSlashAmountMist,
  };
}

export function buildOpenStakePositionCliArgs(input: OpenStakePositionInput, config: TenderBoardConfig): string[] {
  assertPackage(config);
  assertPositiveMist(input.amountMist, 'amountMist');

  const args = ['client'];
  if (config.suiClientConfig) {
    args.push('--client.config', config.suiClientConfig);
  }
  args.push(
    'ptb',
    ...makeByteVectorArgs('workerAgentId', input.workerAgentId),
    '--split-coins',
    'gas',
    `[${input.amountMist}]`,
    '--assign',
    'stake',
    '--move-call',
    `${config.suiPackageId}::reputation_stake::open_position`,
    'workerAgentId',
    'stake.0',
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function buildSlashStakeCliArgs(input: SlashStakeInput, config: TenderBoardConfig): string[] {
  assertPackage(config);
  assertPositiveMist(input.slashAmountMist, 'slashAmountMist');

  const args = ['client'];
  if (config.suiClientConfig) {
    args.push('--client.config', config.suiClientConfig);
  }
  args.push(
    'call',
    '--package',
    config.suiPackageId!,
    '--module',
    'reputation_stake',
    '--function',
    'challenge_and_slash',
    '--args',
    input.positionId,
    textToHexBytes(input.evidenceHash),
    textToHexBytes(input.reason),
    input.slashAmountMist,
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function parseStakePositionObjectId(parsed: unknown, config: TenderBoardConfig): string {
  const objectChanges = (parsed as { objectChanges?: Array<{ type?: string; objectType?: string; objectId?: string }> }).objectChanges ?? [];
  const packagePrefix = `${config.suiPackageId}::reputation_stake::StakePosition`;
  const created = objectChanges.find((change) => change.type === 'created' && change.objectType === packagePrefix && change.objectId);
  if (!created?.objectId) {
    throw new Error('Sui stake open command did not return a StakePosition object id.');
  }
  return created.objectId;
}

function assertPackage(config: TenderBoardConfig): void {
  if (!config.suiPackageId) {
    throw new Error('SUI_PACKAGE_ID is required for automatic Sui stake execution.');
  }
}

function assertPositiveMist(value: string, label: string): void {
  if (!/^[0-9]+$/.test(value) || BigInt(value) <= 0n) {
    throw new Error(`${label} must be a positive integer MIST amount.`);
  }
}

function makeByteVectorArgs(name: string, value: string): string[] {
  const bytes = Buffer.from(value, 'utf8');
  return ['--make-move-vec', '<u8>', `[${Array.from(bytes).join(',')}]`, '--assign', name];
}

function parseSuiTransactionOutput(stdout: string, failurePrefix: string): { digest: string; raw: unknown } {
  const raw = parseJsonFromOutput(stdout) as {
    digest?: string;
    effects?: {
      transactionDigest?: string;
      status?: {
        status?: string;
        error?: string;
      };
    };
  };
  if (raw.effects?.status?.status && raw.effects.status.status !== 'success') {
    throw new Error(`${failurePrefix}: ${raw.effects.status.error ?? raw.effects.status.status}`);
  }
  const digest = raw.digest ?? raw.effects?.transactionDigest;
  if (!digest) {
    throw new Error('Sui stake command did not return a transaction digest.');
  }
  return { digest, raw };
}

function parseJsonFromOutput(stdout: string): unknown {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Sui stake command did not return JSON output.');
  }
  return JSON.parse(stdout.slice(start, end + 1));
}
