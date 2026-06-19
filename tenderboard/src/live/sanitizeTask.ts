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
  const keptCriteria: string[] = [];
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
  for (const criterion of input.acceptanceCriteria ?? []) {
    const criteriaRemoval = removeUnsafeLines(criterion);
    keptCriteria.push(...criteriaRemoval.kept);
    removedLines.push(...criteriaRemoval.removed);
  }

  const sanitizedTask = [
    `Task: ${safeTitle}`,
    `Max payment: ${input.maxPayment.amount} ${input.maxPayment.currency}`,
    `Checker pack: ${input.checkerPack ?? 'research'}`,
    '',
    'Instructions:',
    kept.length > 0 ? kept.join('\n') : 'No public instructions were provided.',
    '',
    'Acceptance criteria:',
    keptCriteria.length > 0 ? keptCriteria.map((criterion) => `- ${criterion}`).join('\n') : '- Worker output should directly satisfy the task.',
    '',
    'Do not request buyer-private material.',
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
