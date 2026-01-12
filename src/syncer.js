import { promises as fs } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import matter from 'gray-matter';

const CORE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

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
  // The structure could be: project-root/.claude/skills/skill-name/SKILL.md
  // or: project-root/.codex/skills/skill-name/SKILL.md
  // We need to place it at: project-root/.agents-common/skills/skill-name/SKILL.md

  // Find the project root by going up from sourceDir until we find a directory
  // that doesn't have .claude or .codex as a direct child
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

export async function cloneCodexSkills(baseDir, claudeSkills) {
  for (const skill of claudeSkills) {
    const content = await fs.readFile(skill.path, 'utf8');
    const parsed = matter(content);

    // Extract only core frontmatter fields
    const coreFrontmatter = {};
    for (const field of CORE_FIELDS) {
      if (parsed.data[field]) {
        coreFrontmatter[field] = parsed.data[field];
      }
    }

    // Get the @ reference from the content
    const atReference = parsed.content.trim();

    // Build the codex path
    const skillName = skill.skillName;
    const codexPath = join(baseDir, '.codex/skills', skillName, 'SKILL.md');

    // Ensure directory exists
    await fs.mkdir(dirname(codexPath), { recursive: true });

    // Write the codex skill file with @ reference and core frontmatter
    const codexContent = matter.stringify(atReference + '\n', coreFrontmatter);
    await fs.writeFile(codexPath, codexContent);
  }
}
