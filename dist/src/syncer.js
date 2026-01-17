import { promises as fs } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { CORE_FIELDS } from './constants.js';
import { ASSISTANT_MAP } from './types.js';
export async function refactorSkill(sourcePath) {
    const content = await fs.readFile(sourcePath, 'utf8');
    const parsed = matter(content);
    // Skip if already has @ reference
    if (parsed.content.trim().startsWith('@')) {
        return null;
    }
    // Extract skill name from path and resolve paths
    const absSourcePath = resolve(sourcePath);
    const sourceDir = dirname(absSourcePath);
    const skillName = basename(sourceDir);
    // Navigate from the source directory to find the project root
    let projectRoot = resolve('.'); // Default to current working directory
    // Extract all assistant directory names
    const assistantDirs = Object.values(ASSISTANT_MAP).map(config => {
        const skillsPath = typeof config === 'string' ? config : config.project;
        return skillsPath.split('/')[0];
    });
    // Check if we're in any assistant directory structure
    const dirParts = sourceDir.split('/');
    let agentDirIndex = -1;
    for (const assistantDir of assistantDirs) {
        const index = dirParts.lastIndexOf(assistantDir);
        if (index >= 0 && index > agentDirIndex) {
            agentDirIndex = index;
        }
    }
    if (agentDirIndex >= 0) {
        // We're in an assistant directory, go up to the parent of that directory
        projectRoot = '/' + dirParts.slice(0, agentDirIndex).join('/');
    }
    const commonPath = join(projectRoot, '.agents-common/skills', skillName, 'SKILL.md');
    const relativeCommonPath = '.agents-common/skills/' + skillName + '/SKILL.md';
    // Ensure .agents-common directory exists
    await fs.mkdir(dirname(commonPath), { recursive: true });
    // Extract core frontmatter fields to copy to common
    const coreFrontmatter = {};
    for (const field of CORE_FIELDS) {
        if (parsed.data[field]) {
            coreFrontmatter[field] = parsed.data[field];
        }
    }
    // Write frontmatter + body to .agents-common (strip leading newline added by gray-matter)
    const bodyContent = parsed.content.startsWith('\n') ? parsed.content.slice(1) : parsed.content;
    // Compute hash of the new common skill (no dependents yet)
    const skillHash = computeSkillHash(coreFrontmatter, bodyContent, []);
    // Add sync metadata to common frontmatter
    const commonFrontmatter = {
        ...coreFrontmatter,
        metadata: {
            sync: {
                version: 2,
                files: {},
                hash: skillHash
            }
        }
    };
    const commonContent = matter.stringify(bodyContent, commonFrontmatter);
    await fs.writeFile(commonPath, commonContent);
    // Add sync metadata to source platform frontmatter
    const normalizedPlatform = parsed.data;
    normalizedPlatform.metadata = {
        ...(normalizedPlatform.metadata && typeof normalizedPlatform.metadata === 'object' && !Array.isArray(normalizedPlatform.metadata)
            ? normalizedPlatform.metadata
            : {}),
        sync: {
            hash: skillHash
        }
    };
    // Replace body with @ reference
    const newContent = matter.stringify(`@${relativeCommonPath}\n`, normalizedPlatform);
    await fs.writeFile(sourcePath, newContent);
    return commonPath;
}
export async function copySkill(sourcePath, targetPath) {
    await fs.mkdir(dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
}
/**
 * Compute hash of skill state (frontmatter + body + dependent files)
 * @param coreFrontmatter - CORE_FIELDS from skill
 * @param bodyContent - SKILL.md body content
 * @param dependentFiles - Array of dependent files with hashes
 * @returns Hash in format "sha256-{hex}"
 */
export function computeSkillHash(coreFrontmatter, bodyContent, dependentFiles = []) {
    const hash = createHash('sha256');
    // 1. Hash core frontmatter (deterministic JSON)
    const frontmatterStr = stableStringify(coreFrontmatter);
    hash.update(frontmatterStr);
    hash.update('\n');
    // 2. Hash body content
    hash.update(bodyContent);
    hash.update('\n');
    // 3. Hash dependent files (sorted by path for consistency)
    const sortedFiles = [...dependentFiles].sort((a, b) => a.path.localeCompare(b.path));
    for (const file of sortedFiles) {
        hash.update(`${file.path}:${file.hash}\n`);
    }
    return `sha256-${hash.digest('hex')}`;
}
/**
 * Update the main hash in a skill's frontmatter
 * @param skillPath - Path to the SKILL.md file
 * @param newHash - New hash value
 */
export async function updateMainHash(skillPath, newHash) {
    const content = await fs.readFile(skillPath, 'utf8');
    const parsed = matter(content);
    const existingData = parsed.data || {};
    const existingMetadata = existingData.metadata || {};
    const existingSync = existingMetadata.sync || {};
    const newData = {
        ...existingData,
        metadata: {
            ...existingMetadata,
            sync: {
                ...existingSync,
                hash: newHash
            }
        }
    };
    const newContent = matter.stringify(content, newData);
    await fs.writeFile(skillPath, newContent);
}
/**
 * Stable stringification for deterministic hashing
 * Sorts object keys recursively
 */
function stableStringify(obj) {
    // Handle null and undefined explicitly with markers
    if (obj === null)
        return 'null';
    if (obj === undefined)
        return 'undefined';
    // Helper to escape strings
    const jsonStringify = (s) => '"' + s.replace(/"/g, '\\"') + '"';
    if (typeof obj === 'string') {
        return jsonStringify(obj);
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(v => stableStringify(v)).join(',') + ']';
    }
    if (typeof obj === 'object') {
        const sortedKeys = Object.keys(obj).sort();
        const pairs = sortedKeys.map(key => {
            const value = obj[key];
            return `"${key}":${stableStringify(value)}`;
        });
        return '{' + pairs.join(',') + '}';
    }
    return '';
}
//# sourceMappingURL=syncer.js.map