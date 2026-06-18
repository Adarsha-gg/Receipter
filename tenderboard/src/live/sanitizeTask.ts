import { findSecretPatternMatches } from '../policy/secretPatterns.js';
import type { CreateRunRequest } from './types.js';

export interface SanitizedTaskResult {
  sanitizedTask: string;
  removedLines: string[];
  privateNotesProvided: boolean;
}

export function sanitizeTaskForWorker(input: CreateRunRequest): SanitizedTaskResult {
  const safeTitle = removeUnsafeLines(input.title).kept.join(' ').trim() || 'Untitled task';
  const instructionLines = input.instructions.split(/\r?\n/);
  const kept: string[] = [];
  const removedLines: string[] = [];

  for (const line of instructionLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (findSecretPatternMatches([trimmed]).length > 0) {
      removedLines.push(trimmed);
    } else {
      kept.push(trimmed);
    }
  }

  const titleRemoval = removeUnsafeLines(input.title);
  removedLines.push(...titleRemoval.removed);

  const sanitizedTask = [
    `Task: ${safeTitle}`,
    `Max payment: ${input.maxPayment.amount} ${input.maxPayment.currency}`,
    '',
    'Instructions:',
    kept.length > 0 ? kept.join('\n') : 'No public instructions were provided.',
    '',
    'Do not ask for wallet keys, seed phrases, API keys, passwords, .env files, or private notes.',
  ].join('\n');

  return {
    sanitizedTask,
    removedLines,
    privateNotesProvided: Boolean(input.privateNotes?.trim()),
  };
}

function removeUnsafeLines(value: string): { kept: string[]; removed: string[] } {
  const kept: string[] = [];
  const removed: string[] = [];

  for (const line of value.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (findSecretPatternMatches([trimmed]).length > 0) {
      removed.push(trimmed);
    } else {
      kept.push(trimmed);
    }
  }

  return { kept, removed };
}
