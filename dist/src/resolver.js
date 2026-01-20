import inquirer from 'inquirer';
import chalk from 'chalk';
import matter from 'gray-matter';
import { formatDiff } from './detector.js';
function formatConflictDetails(conflict) {
    const lines = [];
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
    }
    else {
        lines.push(chalk.yellow(`\nConflict type: Content`));
        lines.push(chalk.gray(`The files have different content.`));
        if (conflict.contentA && conflict.contentB) {
            const parsedA = matter(conflict.contentA);
            const parsedB = matter(conflict.contentB);
            // Show what each file references or contains
            lines.push(chalk.cyan(`\n.${conflict.platformA} version:`));
            if (parsedA.content.trim().startsWith('@')) {
                lines.push(chalk.gray(`  References: ${parsedA.content.trim()}`));
            }
            else {
                lines.push(chalk.gray(`  Has ${parsedA.content.split('\n').length} lines of content`));
            }
            lines.push(chalk.magenta(`\n.${conflict.platformB} version:`));
            if (parsedB.content.trim().startsWith('@')) {
                lines.push(chalk.gray(`  References: ${parsedB.content.trim()}`));
            }
            else {
                lines.push(chalk.gray(`  Has ${parsedB.content.split('\n').length} lines of content`));
            }
            lines.push(chalk.gray('\nDiff (red = removed, green = added):'));
            lines.push(formatDiff(conflict.contentA, conflict.contentB));
        }
    }
    lines.push('');
    return lines.join('\n');
}
export async function resolveConflict(conflict, inquirerImpl = inquirer, options = {}) {
    console.log(formatConflictDetails(conflict));
    const allowUseA = options.allowUseA ?? true;
    const allowUseB = options.allowUseB ?? true;
    const choices = [];
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
    choices.push({ name: 'Keep both unchanged', value: 'keep-both' }, { name: 'Abort sync', value: 'abort' });
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
function formatDependentConflictDetails(conflict) {
    const lines = [];
    lines.push(chalk.bold.red(`\n⚠️  Dependent file conflict: ${conflict.skillName}/${conflict.relativePath}`));
    lines.push(chalk.yellow(`\nFile: ${conflict.relativePath}`));
    lines.push(chalk.gray(`Platform: ${conflict.platform}`));
    if (conflict.commonHash && conflict.platformHash !== conflict.commonHash) {
        lines.push(chalk.yellow(`\nConflict: Platform file differs from common file`));
        lines.push(chalk.cyan(`\nPlatform (${conflict.platform}) hash:`));
        lines.push(chalk.gray(`  ${conflict.platformHash}`));
        lines.push(chalk.magenta(`\nCommon hash:`));
        lines.push(chalk.gray(`  ${conflict.commonHash}`));
    }
    else {
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
export async function resolveDependentConflict(conflict, inquirerImpl = inquirer) {
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
export async function resolveDependentConflicts(conflicts, inquirerImpl = inquirer) {
    const resolutions = new Map();
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
 * Format details for out-of-sync skills (grouped by name)
 */
function formatOutOfSyncDetails(skillName, platforms) {
    const lines = [];
    lines.push(chalk.bold.yellow(`\n⚠️  Skill modified outside of sync-skills: ${skillName}`));
    lines.push(chalk.yellow(`\nModified in ${platforms.length} platform(s):`));
    for (const p of platforms) {
        lines.push(chalk.cyan(`\n  ${p.platform}`));
        lines.push(chalk.gray(`  Path: ${p.platformPath}`));
        lines.push(chalk.gray(`  Current hash: ${p.currentHash}`));
        lines.push(chalk.gray(`  Stored hash:  ${p.storedHash}`));
    }
    lines.push('');
    return lines.join('\n');
}
/**
 * Resolve an out-of-sync skill through user interaction
 * @param skillName - The name of the skill
 * @param platforms - Array of out-of-sync occurrences for this skill
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Resolution action
 */
export async function resolveOutOfSyncSkill(skillName, platforms, inquirerImpl = inquirer) {
    console.log(formatOutOfSyncDetails(skillName, platforms));
    const choices = platforms.map(p => ({
        name: `Use modified ${p.platform} version (updates common skill)`,
        value: `use-platform:${p.platform}`
    }));
    choices.push({ name: 'Use common version (discards all platform edits)', value: 'use-common' });
    choices.push({ name: 'Skip - Leave this skill as-is and continue', value: 'skip' });
    const { outOfSyncAction } = await inquirerImpl.prompt([
        {
            type: 'list',
            name: 'outOfSyncAction',
            message: 'How would you like to resolve this out-of-sync skill?',
            choices
        }
    ]);
    if (outOfSyncAction.startsWith('use-platform:')) {
        return {
            action: 'use-platform',
            platformName: outOfSyncAction.split(':')[1]
        };
    }
    return { action: outOfSyncAction };
}
/**
 * Batch resolve multiple out-of-sync skills
 * @param skills - Array of out-of-sync skills
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Map of skill names to their resolutions
 */
export async function resolveOutOfSyncSkills(skills, inquirerImpl = inquirer) {
    const resolutions = new Map();
    // Group by skill name
    const grouped = new Map();
    for (const skill of skills) {
        const existing = grouped.get(skill.skillName) || [];
        existing.push(skill);
        grouped.set(skill.skillName, existing);
    }
    for (const [skillName, platforms] of grouped.entries()) {
        const resolution = await resolveOutOfSyncSkill(skillName, platforms, inquirerImpl);
        resolutions.set(skillName, resolution);
        if (resolution.action === 'skip') {
            continue;
        }
    }
    return resolutions;
}
//# sourceMappingURL=resolver.js.map