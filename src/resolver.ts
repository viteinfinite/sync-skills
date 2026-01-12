import inquirer from 'inquirer';
import type { Conflict, ConflictResolution } from './types.js';

type InquirerImpl = typeof inquirer;

export async function resolveConflict(
  conflict: Conflict,
  inquirerImpl: InquirerImpl = inquirer
): Promise<ConflictResolution> {
  const { action } = await inquirerImpl.prompt([
    {
      type: 'list',
      name: 'action',
      message: `Conflict detected: ${conflict.skillName}`,
      choices: [
        { name: 'Use .claude version (overwrite .codex)', value: 'use-claude' },
        { name: 'Use .codex version (overwrite .claude)', value: 'use-codex' },
        { name: 'Keep both unchanged', value: 'keep-both' },
        { name: 'Show diff', value: 'show-diff' },
        { name: 'Abort', value: 'abort' }
      ]
    }
  ]);

  return { action, conflict };
}
