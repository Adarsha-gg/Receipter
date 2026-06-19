const SECRET_PATTERNS: RegExp[] = [
  /\.env/i,
  /\b[a-z0-9_]*(api[_-]?key|access[_-]?token|auth[_-]?token|secret|password)[a-z0-9_]*\s*=/i,
  /private\s*key/i,
  /wallet\s*key/i,
  /seed\s*phrase/i,
  /mnemonic/i,
  /api[_\s-]*key/i,
  /api\s*key/i,
  /access[_\s-]*token/i,
  /auth[_\s-]*token/i,
  /bearer\s+token/i,
  /password/i,
  /ssh\s*key/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /gmail/i,
  /database\s*dump/i,
];

export function findSecretPatternMatches(values: string[]): string[] {
  const matches = new Set<string>();

  for (const value of values) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(value)) {
        matches.add(value);
        break;
      }
    }
  }

  return [...matches];
}
