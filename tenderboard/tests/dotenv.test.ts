import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDotEnvFile } from '../src/live/dotenv.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'tenderboard-env-'));
});

afterEach(async () => {
  delete process.env.TENDERBOARD_TEST_KEY;
  delete process.env.TENDERBOARD_EXISTING_KEY;
  await rm(tempDir, { recursive: true, force: true });
});

describe('loadDotEnvFile', () => {
  it('loads simple local env files without overriding existing env vars', async () => {
    const envPath = path.join(tempDir, '.env');
    process.env.TENDERBOARD_EXISTING_KEY = 'keep_me';
    await writeFile(
      envPath,
      [
        '# comment',
        'TENDERBOARD_TEST_KEY="loaded"',
        'TENDERBOARD_EXISTING_KEY=replace_me',
      ].join('\n'),
      'utf8',
    );

    loadDotEnvFile(envPath);

    expect(process.env.TENDERBOARD_TEST_KEY).toBe('loaded');
    expect(process.env.TENDERBOARD_EXISTING_KEY).toBe('keep_me');
  });
});
