import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import inquirer from 'inquirer';
import matter from 'gray-matter';
import { pickCoreFrontmatter } from './frontmatter.js';
import { getAssistantConfigs } from './types.js';
/**
 * Discover the state of configured assistants
 * @param baseDir - Base directory to scan
 * @param configs - Assistant configs to discover (defaults to all)
 */
export async function discoverAssistants(baseDir, configs = getAssistantConfigs()) {
    const states = [];
    for (const config of configs) {
        const state = await discoverAssistant(baseDir, config);
        states.push(state);
    }
    return states;
}
/**
 * Discover the state of a single assistant
 */
async function discoverAssistant(baseDir, config) {
    const assistantDir = join(baseDir, config.dir);
    const skillsDir = join(baseDir, config.skillsDir);
    let hasDir = false;
    let hasSkills = false;
    const skills = [];
    try {
        // Check if assistant directory exists
        await fs.access(assistantDir);
        hasDir = true;
        // Check if skills directory exists and has content
        try {
            const entries = await fs.readdir(skillsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillFile = join(skillsDir, entry.name, 'SKILL.md');
                    try {
                        await fs.access(skillFile);
                        skills.push({
                            path: skillFile,
                            skillName: entry.name
                        });
                    }
                    catch {
                        // SKILL.md doesn't exist, skip this directory
                    }
                }
            }
            hasSkills = skills.length > 0;
        }
        catch {
            // Skills directory doesn't exist or is not accessible
            hasSkills = false;
        }
    }
    catch {
        // Assistant directory doesn't exist
        hasDir = false;
        hasSkills = false;
    }
    return {
        config,
        hasDir,
        hasSkills,
        skills
    };
}
/**
 * Find all sync pairs where source has skills and target doesn't
 */
export function findSyncPairs(states) {
    const pairs = [];
    for (const source of states) {
        if (!source.hasSkills)
            continue;
        for (const target of states) {
            if (target.config.name === source.config.name)
                continue;
            if (target.hasSkills)
                continue;
            pairs.push({ source, target });
        }
    }
    return pairs;
}
/**
 * Check if a sync pair needs user prompt (target dir doesn't exist)
 */
function needsPrompt(pair) {
    return !pair.target.hasDir;
}
/**
 * Prompt user for sync permission
 */
async function promptForSync(targetName) {
    const answer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'create',
            message: `.${targetName} folder does not exist. Would you like to create .${targetName}/skills with references to common skills?`,
            default: false
        }
    ]);
    return answer.create;
}
/**
 * Clone skills from source assistant to target assistant
 */
async function cloneAssistantSkills(baseDir, sourceSkills, targetConfig) {
    for (const skill of sourceSkills) {
        const content = await fs.readFile(skill.path, 'utf-8');
        const parsed = matter(content);
        // Extract only core frontmatter fields
        const coreFrontmatter = pickCoreFrontmatter(parsed.data);
        // Get the @ reference from the content (if it exists)
        // Or create a new reference to common skills
        let atReference = parsed.content.trim();
        if (!atReference.startsWith('@')) {
            // If source doesn't have @ reference, create one
            atReference = `@.agents-common/skills/${skill.skillName}/SKILL.md`;
        }
        // Build the target path
        const targetPath = join(baseDir, targetConfig.skillsDir, skill.skillName, 'SKILL.md');
        // Ensure directory exists
        await fs.mkdir(dirname(targetPath), { recursive: true });
        // Write the target skill file with @ reference and core frontmatter
        const targetContent = matter.stringify(atReference + '\n', coreFrontmatter);
        await fs.writeFile(targetPath, targetContent);
    }
}
/**
 * Process all sync pairs with appropriate prompts
 */
export async function processSyncPairs(baseDir, pairs, dryRun) {
    for (const pair of pairs) {
        const shouldPrompt = needsPrompt(pair);
        let shouldSync = false;
        if (dryRun) {
            // In dry run mode, don't sync
            continue;
        }
        if (shouldPrompt) {
            // Prompt user for permission
            shouldSync = await promptForSync(pair.target.config.name);
        }
        else {
            // Auto-sync when target directory exists
            shouldSync = true;
        }
        if (shouldSync) {
            await cloneAssistantSkills(baseDir, pair.source.skills, pair.target.config);
        }
    }
}
/**
 * Sync skills that exist only in .agents-common to enabled platforms
 * Creates @ references in platform folders for common-only skills
 */
export async function syncCommonOnlySkills(baseDir, commonSkills, enabledConfigs, dryRun) {
    for (const commonSkill of commonSkills) {
        for (const config of enabledConfigs) {
            const platformSkillPath = join(baseDir, config.skillsDir, commonSkill.skillName, 'SKILL.md');
            // Check if skill already exists in this platform
            try {
                await fs.access(platformSkillPath);
                // Skill already exists, skip
                continue;
            }
            catch {
                // Skill doesn't exist in platform, create it
            }
            if (dryRun) {
                console.log(`Would create @ reference for ${commonSkill.skillName} in ${config.name}`);
                continue;
            }
            // Read the common skill to extract frontmatter and sync metadata
            const content = await fs.readFile(commonSkill.path, 'utf-8');
            const parsed = matter(content);
            const commonMetadata = parsed.data?.metadata && typeof parsed.data.metadata === 'object' && !Array.isArray(parsed.data.metadata)
                ? parsed.data.metadata
                : undefined;
            const commonSync = commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)
                ? commonMetadata.sync
                : undefined;
            const commonHash = commonSync?.hash;
            // Extract only core frontmatter fields
            const coreFrontmatter = pickCoreFrontmatter(parsed.data);
            // Remove metadata from coreFrontmatter since we'll create our own with only sync.hash
            const { metadata, ...coreWithoutMetadata } = coreFrontmatter;
            // Create @ reference to common skill
            const atReference = `@.agents-common/skills/${commonSkill.skillName}/SKILL.md`;
            // Ensure directory exists
            await fs.mkdir(dirname(platformSkillPath), { recursive: true });
            // Build platform frontmatter with sync metadata
            const platformMetadata = { ...(commonMetadata || {}) };
            if (commonSync || commonHash) {
                platformMetadata.sync = {
                    ...(commonSync || {}),
                    ...(commonHash ? { hash: commonHash } : {})
                };
            }
            const platformFrontmatter = {
                ...coreWithoutMetadata,
                ...(Object.keys(platformMetadata).length > 0 ? { metadata: platformMetadata } : {})
            };
            // Write the platform skill file with @ reference and frontmatter
            const targetContent = matter.stringify(atReference + '\n', platformFrontmatter);
            await fs.writeFile(platformSkillPath, targetContent);
            console.log(`Created @ reference for ${commonSkill.skillName} in ${config.name}`);
        }
    }
}
//# sourceMappingURL=assistants.js.map