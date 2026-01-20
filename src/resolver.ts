import inquirer from 'inquirer';
import chalk from 'chalk';
import matter from 'gray-matter';
import { formatDiff } from './detector.js';
import type { OutOfSyncSkill, SyncMismatchType } from './types.js';
import type { Conflict, ConflictResolution, DependentConflict, DependentConflictResolution, OutOfSyncResolution } from './types.js';

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
  inquirerImpl: InquirerImpl = inquirer,
  options: { allowUseA?: boolean; allowUseB?: boolean; allowUseCommon?: boolean } = {}
): Promise<ConflictResolution> {
  console.log(formatConflictDetails(conflict));

  const allowUseA = options.allowUseA ?? true;
  const allowUseB = options.allowUseB ?? true;

  const choices: Array<{ name: string; value: ConflictResolution['action'] }> = [];

  if (allowUseA) {
    choices.push({
      name: `Use .${conflict.platformA} version (overwrite .${conflict.platformB})`,
      value: 'use-a'
    });
  }

  if (allowUseB) {
    choices.push({
      name: `Use .${conflict.platformB} version (overwrite .${conflict.platformA})`,
      value: 'use-b'
    });
  }

  if (options.allowUseCommon) {
    choices.push({ name: 'Use common version (discard platform edits)', value: 'use-common' });
  }

  choices.push(
    { name: 'Keep both unchanged', value: 'keep-both' },
    { name: 'Abort sync', value: 'abort' }
  );

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

/**
 * Format details for an out-of-sync skill (pairwise comparison)
 */
function formatOutOfSyncDetails(skill: OutOfSyncSkill): string {
  const lines: string[] = [];
  const showPreview = skill.platform !== 'multiple';

  const mismatchDescription: Record<SyncMismatchType, string> = {
    'body': 'Body content is out of sync',
    'frontmatter': 'Frontmatter (metadata) is out of sync',
    'both': 'Both body and frontmatter are out of sync'
  };

  lines.push(chalk.bold.yellow(`\n⚠️  Skill out of sync: ${skill.skillName}`));
  lines.push(chalk.yellow(`\nPlatform: ${skill.platform}`));
  lines.push(chalk.gray(`Platform path: ${skill.platformPath}`));
  lines.push(chalk.gray(`Common path: ${skill.commonPath}`));
  lines.push(chalk.yellow(`\nMismatch type: ${mismatchDescription[skill.mismatchType]}`));

  // Show platform content if available
  if (showPreview && skill.platformContent) {
    const platformParsed = matter(skill.platformContent);
    lines.push(chalk.cyan(`\nPlatform content:`));
    if (platformParsed.content.trim().startsWith('@')) {
      lines.push(chalk.gray(`  ${platformParsed.content.trim()}`));
    } else {
      const preview = platformParsed.content.split('\n').slice(0, 3).join('\n');
      lines.push(chalk.gray(`  ${preview}${platformParsed.content.split('\n').length > 3 ? '...' : ''}`));
    }
  }

  // Show common content if available
  if (showPreview && skill.commonContent) {
    const commonParsed = matter(skill.commonContent);
    lines.push(chalk.magenta(`\nCommon content:`));
    const preview = commonParsed.content.split('\n').slice(0, 3).join('\n');
    lines.push(chalk.gray(`  ${preview}${commonParsed.content.split('\n').length > 3 ? '...' : ''}`));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get available choices based on mismatch type
 * Case 1: body out of sync AND platform has @ reference -> only "abort" and "keep common"
 * Case 2: frontmatter out of sync only -> "keep platform", "keep common", "abort"
 * Case 3: both out of sync -> treat as case 1 (stricter)
 */
function getChoicesForMismatch(skill: OutOfSyncSkill): Array<{ name: string; value: string }> {
  const platformHasAtReference = (() => {
    if (!skill.platformContent) {
      return false;
    }
    const parsed = matter(skill.platformContent);
    return parsed.content.trim().startsWith('@');
  })();
  const allowKeepPlatform = skill.allowKeepPlatform !== false;
  const discardLabel = skill.platform === 'multiple' ? 'platform edits' : skill.platform;

  if (!allowKeepPlatform) {
    return [
      { name: `Keep common version (discard ${discardLabel})`, value: 'keep-common' },
      { name: 'Abort sync', value: 'abort' }
    ];
  }

  // Case 1: body out of sync with @ reference
  if (skill.mismatchType === 'body' && platformHasAtReference) {
    return [
      { name: `Keep common version (discard ${discardLabel})`, value: 'keep-common' },
      { name: 'Abort sync', value: 'abort' }
    ];
  }

  // Case 2: both mismatches with @ reference (stricter)
  if (skill.mismatchType === 'both' && platformHasAtReference) {
    return [
      { name: `Keep common version (discard ${discardLabel})`, value: 'keep-common' },
      { name: 'Abort sync', value: 'abort' }
    ];
  }

  // Case 3: frontmatter mismatch or body without @ reference
  return [
    { name: `Keep ${skill.platform} version (use ${skill.platform})`, value: 'keep-platform' },
    { name: `Keep common version (discard ${discardLabel})`, value: 'keep-common' },
    { name: 'Abort sync', value: 'abort' }
  ];
}

/**
 * Resolve an out-of-sync skill through user interaction
 * @param skill - The out-of-sync skill to resolve
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Resolution action
 */
export async function resolveOutOfSyncSkill(
  skill: OutOfSyncSkill,
  inquirerImpl: InquirerImpl = inquirer
): Promise<OutOfSyncResolution> {
  console.log(formatOutOfSyncDetails(skill));

  const choices = getChoicesForMismatch(skill);

  const { action } = await inquirerImpl.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'How would you like to resolve this out-of-sync skill?',
      choices
    }
  ]);

  return { action: action as OutOfSyncResolution['action'] };
}

/**
 * Batch resolve multiple out-of-sync skills
 * @param skills - Array of out-of-sync skills
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Array of resolutions in the same order as input skills
 */
export async function resolveOutOfSyncSkills(
  skills: OutOfSyncSkill[],
  inquirerImpl: InquirerImpl = inquirer
): Promise<OutOfSyncResolution[]> {
  const resolutions: OutOfSyncResolution[] = [];

  for (const skill of skills) {
    const resolution = await resolveOutOfSyncSkill(skill, inquirerImpl);
    resolutions.push(resolution);

    if (resolution.action === 'abort') {
      break;
    }
  }

  return resolutions;
}
