import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertStakeChallengeAdmissible, type StakeChallengeAssessment } from '../live/challengeOracle.js';
import type { TenderBoardConfig } from '../live/types.js';
import { textToHexBytes } from './anchorExecutor.js';
import { assertPositiveMist } from './stakeValidation.js';

export {
  buildAttachStakeWalletRequest,
  buildCreateOracleRegistryWalletRequest,
  buildOpenStakePositionWalletRequest,
  buildRaiseChallengeWalletRequest,
  buildResolveChallengeWalletRequest,
  buildSlashStakeWalletRequest,
  validateAttachStakeInput,
  validateIssueChallengeDecisionInput,
  validateOpenStakePositionInput,
  validateSlashStakeInput,
  validateSlashStakeWithDecisionInput,
  type SuiStakeWalletTransactionRequest,
} from './stakePlan.js';

const execFileAsync = promisify(execFile);

export interface OpenStakePositionInput {
  workerAgentId: string;
  amountMist: string;
}

export interface AttachStakeInput {
  positionId: string;
  amountMist: string;
}

export interface SlashStakeInput {
  positionId: string;
  evidenceHash: string;
  reason: string;
  slashAmountMist: string;
}

export interface IssueChallengeDecisionInput extends SlashStakeInput {
  oracleRegistryId: string;
}

export interface SlashStakeWithDecisionInput {
  positionId: string;
  challengeDecisionId: string;
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

export interface AttachStakeResult {
  digest: string;
  stdout: string;
  stderr: string;
  args: string[];
}

export interface CreateOracleRegistryResult {
  digest: string;
  oracleRegistryId: string;
  stdout: string;
  stderr: string;
  args: string[];
}

export interface IssueChallengeDecisionResult {
  digest: string;
  challengeDecisionId: string;
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

export async function executeAttachStake(input: AttachStakeInput, config: TenderBoardConfig): Promise<AttachStakeResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui stake execution.');
  }

  const args = buildAttachStakeCliArgs(input, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout, 'Sui stake attach transaction failed');
  return { digest: parsed.digest, stdout, stderr, args };
}

export async function executeCreateOracleRegistry(config: TenderBoardConfig): Promise<CreateOracleRegistryResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui stake execution.');
  }

  const args = buildCreateOracleRegistryCliArgs(config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout, 'Sui oracle registry create transaction failed');
  return {
    digest: parsed.digest,
    oracleRegistryId: parseCreatedObjectId(parsed.raw, config, 'OracleRegistry'),
    stdout,
    stderr,
    args,
  };
}

export async function executeIssueChallengeDecision(
  input: IssueChallengeDecisionInput,
  config: TenderBoardConfig,
): Promise<IssueChallengeDecisionResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui stake execution.');
  }

  const args = buildIssueChallengeDecisionCliArgs(input, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout, 'Sui challenge decision issue transaction failed');
  return {
    digest: parsed.digest,
    challengeDecisionId: parseCreatedObjectId(parsed.raw, config, 'ChallengeDecision'),
    stdout,
    stderr,
    args,
  };
}

export async function executeSlashStakeWithDecision(
  input: SlashStakeWithDecisionInput,
  config: TenderBoardConfig,
): Promise<SlashStakeResult> {
  if (!config.suiCliPath) {
    throw new Error('SUI_CLI_PATH is required for automatic Sui stake execution.');
  }

  const args = buildSlashStakeWithDecisionCliArgs(input, config);
  const { stdout, stderr } = await execFileAsync(config.suiCliPath, args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  });
  const parsed = parseSuiTransactionOutput(stdout, 'Sui oracle decision slash transaction failed');
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

export function buildAttachStakeCliArgs(input: AttachStakeInput, config: TenderBoardConfig): string[] {
  assertPackage(config);
  assertPositiveMist(input.amountMist, 'amountMist');

  const args = ['client'];
  if (config.suiClientConfig) {
    args.push('--client.config', config.suiClientConfig);
  }
  args.push(
    'ptb',
    '--split-coins',
    'gas',
    `[${input.amountMist}]`,
    '--assign',
    'stake',
    '--move-call',
    `${config.suiPackageId}::reputation_stake::add_stake`,
    `@${input.positionId}`,
    'stake.0',
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function buildCreateOracleRegistryCliArgs(config: TenderBoardConfig): string[] {
  assertPackage(config);

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
    'create_oracle_registry',
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function buildIssueChallengeDecisionCliArgs(input: IssueChallengeDecisionInput, config: TenderBoardConfig): string[] {
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
    'issue_challenge_decision',
    '--args',
    input.oracleRegistryId,
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

export function buildSlashStakeWithDecisionCliArgs(input: SlashStakeWithDecisionInput, config: TenderBoardConfig): string[] {
  assertPackage(config);

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
    'slash_with_decision',
    '--args',
    input.positionId,
    input.challengeDecisionId,
    '--gas-budget',
    '100000000',
    '--json',
  );
  return args;
}

export function parseStakePositionObjectId(parsed: unknown, config: TenderBoardConfig): string {
  return parseCreatedObjectId(parsed, config, 'StakePosition');
}

export function parseCreatedObjectId(parsed: unknown, config: TenderBoardConfig, typeName: string): string {
  const objectChanges = (parsed as { objectChanges?: Array<{ type?: string; objectType?: string; objectId?: string }> }).objectChanges ?? [];
  const packagePrefix = `${config.suiPackageId}::reputation_stake::${typeName}`;
  const typeSuffix = `::reputation_stake::${typeName}`;
  const created = objectChanges.find(
    (change) => change.type === 'created' && change.objectId && (change.objectType === packagePrefix || change.objectType?.endsWith(typeSuffix)),
  );
  if (!created?.objectId) {
    throw new Error(`Sui command did not return a ${typeName} object id.`);
  }
  return created.objectId;
}

function assertPackage(config: TenderBoardConfig): void {
  if (!config.suiPackageId) {
    throw new Error('SUI_PACKAGE_ID is required for automatic Sui stake execution.');
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
