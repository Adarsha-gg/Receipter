import { describe, expect, it } from 'vitest';
import { findSecretPatternMatches } from '../src/policy/secretPatterns.js';

describe('secret pattern policy', () => {
  it('flags env-style secret assignments inside task text', () => {
    const matches = findSecretPatternMatches([
      'Return one item. API_KEY=secret should be removed.',
      'OPENAI_API_KEY=sk-test',
      'AUTH_TOKEN=abc123',
      'This line is normal public work.',
    ]);

    expect(matches).toEqual([
      'Return one item. API_KEY=secret should be removed.',
      'OPENAI_API_KEY=sk-test',
      'AUTH_TOKEN=abc123',
    ]);
  });
});
