import { readFileSync } from 'node:fs';
import path from 'node:path';

export function loadDotEnvFile(filePath = path.resolve('.env')): void {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = stripQuotes(line.slice(equalsIndex + 1).trim());
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
