import inquirer from 'inquirer';
import chalk from 'chalk';
import matter from 'gray-matter';
import { formatDiff } from './detector.js';
import { diffLines } from 'diff';
import type { Conflict, ConflictResolution, DependentConflict, DependentConflictResolution } from './types.js';

type InquirerImpl = typeof inquirer;

function formatConflictDetails(conflict: Conflict): string {
  const lines: string[] = [];

  lines.push(chalk.bold.red(`\n⚠️  Conflict detected: ${conflict.skillName}`));

  if (conflict.conflictType === 'frontmatter') {
    lines.push(chalk.yellow(`\nConflict type: Frontmatter (metadata) only`));
    lines.push(chalk.gray(`Both files reference the same common skill, but have different metadata.`));

    const parsedA = matter(conflict.contentA || '');
    const parsedB = matter(conflict.contentB || '');

    lines.push(chalk.cyan(`\n.${conflict.platformA} version frontmatter:`));
    lines.push(chalk.gray(JSON.stringify(parsedA.data, null, 2)));

    lines.push(chalk.magenta(`\n.${conflict.platformB} version frontmatter:`));
    lines.push(chalk.gray(JSON.stringify(parsedB.data, null, 2)));
  } else {
    lines.push(chalk.yellow(`\nConflict type: Content`));
    lines.push(chalk.gray(`The files have different content.`));

    if (conflict.contentA && conflict.contentB) {
      const parsedA = matter(conflict.contentA);
      const parsedB = matter(conflict.contentB);

      // Show what each file references or contains
      lines.push(chalk.cyan(`\n.${conflict.platformA} version:`));
      if (parsedA.content.trim().startsWith('@')) {
        lines.push(chalk.gray(`  References: ${parsedA.content.trim()}`));
      } else {
        lines.push(chalk.gray(`  Has ${parsedA.content.split('\n').length} lines of content`));
      }

      lines.push(chalk.magenta(`\n.${conflict.platformB} version:`));
      if (parsedB.content.trim().startsWith('@')) {
        lines.push(chalk.gray(`  References: ${parsedB.content.trim()}`));
      } else {
        lines.push(chalk.gray(`  Has ${parsedB.content.split('\n').length} lines of content`));
      }

      lines.push(chalk.gray('\nDiff (red = removed, green = added):'));
      lines.push(formatDiff(conflict.contentA, conflict.contentB));
    }
  }

  lines.push('');
  return lines.join('\n');
}

export async function resolveConflict(
  conflict: Conflict,
  inquirerImpl: InquirerImpl = inquirer
): Promise<ConflictResolution> {
  console.log(formatConflictDetails(conflict));

  const { action } = await inquirerImpl.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to resolve this conflict?',
      choices: [
        { name: `Use .${conflict.platformA} version (overwrite .${conflict.platformB})`, value: 'use-a' },
        { name: `Use .${conflict.platformB} version (overwrite .${conflict.platformA})`, value: 'use-b' },
        { name: 'Keep both unchanged', value: 'keep-both' },
        { name: 'Abort sync', value: 'abort' }
      ]
    }
  ]);

  return { action };
}

/**
 * Format details for a dependent file conflict
 */
function formatDependentConflictDetails(conflict: DependentConflict): string {
  const lines: string[] = [];

  lines.push(chalk.bold.red(`\n⚠️  Dependent file conflict: ${conflict.skillName}/${conflict.relativePath}`));
  lines.push(chalk.yellow(`\nFile: ${conflict.relativePath}`));
  lines.push(chalk.gray(`Platform: ${conflict.platform}`));

  if (conflict.commonHash && conflict.platformHash !== conflict.commonHash) {
    lines.push(chalk.yellow(`\nConflict: Platform file differs from common file`));
    lines.push(chalk.cyan(`\nPlatform (${conflict.platform}) hash:`));
    lines.push(chalk.gray(`  ${conflict.platformHash}`));

    lines.push(chalk.magenta(`\nCommon hash:`));
    lines.push(chalk.gray(`  ${conflict.commonHash}`));
  } else if (conflict.storedHash && conflict.platformHash !== conflict.storedHash) {
    lines.push(chalk.yellow(`\nConflict: File has changed since last sync`));
    lines.push(chalk.cyan(`\nCurrent hash:`));
    lines.push(chalk.gray(`  ${conflict.platformHash}`));

    lines.push(chalk.magenta(`\nStored hash (from frontmatter):`));
    lines.push(chalk.gray(`  ${conflict.storedHash}`));
  } else {
    lines.push(chalk.yellow(`\nConflict: Multiple versions exist with different content`));
    lines.push(chalk.cyan(`\n${conflict.platform} hash:`));
    lines.push(chalk.gray(`  ${conflict.platformHash}`));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Resolve a dependent file conflict through user interaction
 * @param conflict - The dependent file conflict to resolve
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Resolution action
 */
export async function resolveDependentConflict(
  conflict: DependentConflict,
  inquirerImpl: InquirerImpl = inquirer
): Promise<DependentConflictResolution> {
  console.log(formatDependentConflictDetails(conflict));

  const choices = [
    { name: 'Keep common version', value: 'use-common' },
    { name: `Keep ${conflict.platform} version`, value: 'use-platform' },
    { name: 'Skip this file (leave unchanged)', value: 'skip' },
    { name: 'Abort sync', value: 'abort' }
  ];

  const { action } = await inquirerImpl.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to resolve this conflict?',
      choices
    }
  ]);

  return { action };
}

/**
 * Batch resolve multiple dependent file conflicts
 * @param conflicts - Array of dependent file conflicts
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Map of file paths to their resolutions
 */
export async function resolveDependentConflicts(
  conflicts: DependentConflict[],
  inquirerImpl: InquirerImpl = inquirer
): Promise<Map<string, DependentConflictResolution>> {
  const resolutions = new Map<string, DependentConflictResolution>();

  for (const conflict of conflicts) {
    const resolution = await resolveDependentConflict(conflict, inquirerImpl);
    const key = `${conflict.skillName}/${conflict.relativePath}`;
    resolutions.set(key, resolution);

    if (resolution.action === 'abort') {
      break;
    }
  }

  return resolutions;
}
