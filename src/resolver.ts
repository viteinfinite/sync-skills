import inquirer from 'inquirer';
import chalk from 'chalk';
import matter from 'gray-matter';
import { formatDiff } from './detector.js';
import type { Conflict, ConflictResolution } from './types.js';

type InquirerImpl = typeof inquirer;

function formatConflictDetails(conflict: Conflict): string {
  const lines: string[] = [];

  lines.push(chalk.bold.red(`\n⚠️  Conflict detected: ${conflict.skillName}`));

  if (conflict.conflictType === 'frontmatter') {
    lines.push(chalk.yellow(`\nConflict type: Frontmatter (metadata) only`));
    lines.push(chalk.gray(`Both files reference the same common skill, but have different metadata.`));

    const claudeParsed = matter(conflict.claudeContent || '');
    const codexParsed = matter(conflict.codexContent || '');

    lines.push(chalk.cyan(`\n.claude/skills/${conflict.skillName}/SKILL.md frontmatter:`));
    lines.push(chalk.gray(JSON.stringify(claudeParsed.data, null, 2)));

    lines.push(chalk.magenta(`\n.codex/skills/${conflict.skillName}/SKILL.md frontmatter:`));
    lines.push(chalk.gray(JSON.stringify(codexParsed.data, null, 2)));
  } else {
    lines.push(chalk.yellow(`\nConflict type: Content`));
    lines.push(chalk.gray(`The files have different content.`));

    if (conflict.claudeContent && conflict.codexContent) {
      const claudeParsed = matter(conflict.claudeContent);
      const codexParsed = matter(conflict.codexContent);

      // Show what each file references or contains
      lines.push(chalk.cyan(`\n.claude/skills/${conflict.skillName}/SKILL.md:`));
      if (claudeParsed.content.trim().startsWith('@')) {
        lines.push(chalk.gray(`  References: ${claudeParsed.content.trim()}`));
      } else {
        lines.push(chalk.gray(`  Has ${claudeParsed.content.split('\n').length} lines of content`));
      }

      lines.push(chalk.magenta(`\n.codex/skills/${conflict.skillName}/SKILL.md:`));
      if (codexParsed.content.trim().startsWith('@')) {
        lines.push(chalk.gray(`  References: ${codexParsed.content.trim()}`));
      } else {
        lines.push(chalk.gray(`  Has ${codexParsed.content.split('\n').length} lines of content`));
      }

      lines.push(chalk.gray('\nDiff (red = removed, green = added):'));
      lines.push(formatDiff(conflict.claudeContent, conflict.codexContent));
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
        { name: 'Use .claude version (overwrite .codex)', value: 'use-claude' },
        { name: 'Use .codex version (overwrite .claude)', value: 'use-codex' },
        { name: 'Keep both unchanged', value: 'keep-both' },
        { name: 'Abort sync', value: 'abort' }
      ]
    }
  ]);

  return { action, conflict };
}
