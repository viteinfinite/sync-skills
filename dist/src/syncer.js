import { promises as fs } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import matter from 'gray-matter';
import { CORE_FIELDS } from './constants.js';
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
    let currentDir = sourceDir;
    let projectRoot = resolve('.'); // Default to current working directory
    // Check if we're in a .claude or .codex directory structure
    const dirParts = sourceDir.split('/');
    const claudeIndex = dirParts.lastIndexOf('.claude');
    const codexIndex = dirParts.lastIndexOf('.codex');
    if (claudeIndex >= 0 || codexIndex >= 0) {
        // We're in a .claude or .codex directory, go up to the parent of that directory
        const agentDirIndex = Math.max(claudeIndex, codexIndex);
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
    const commonContent = matter.stringify(bodyContent, coreFrontmatter);
    await fs.writeFile(commonPath, commonContent);
    // Add metadata to frontmatter
    parsed.data.sync = {
        'managed-by': 'sync-skills',
        'refactored': new Date().toISOString()
    };
    // Replace body with @ reference
    const newContent = matter.stringify(`@${relativeCommonPath}\n`, parsed.data);
    await fs.writeFile(sourcePath, newContent);
    return commonPath;
}
export async function copySkill(sourcePath, targetPath) {
    await fs.mkdir(dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
}
//# sourceMappingURL=syncer.js.map