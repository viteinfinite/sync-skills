import { promises as fs } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { CORE_FIELDS } from './constants.js';
import type { SkillFile } from './types.js';

export async function refactorSkill(sourcePath: string): Promise<string | null> {
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
  const coreFrontmatter: Record<string, unknown> = {};
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

export async function copySkill(sourcePath: string, targetPath: string): Promise<void> {
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
export function computeSkillHash(
  coreFrontmatter: Record<string, unknown>,
  bodyContent: string,
  dependentFiles: Array<{ path: string; hash: string }> = []
): string {
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
 * Stable stringification for deterministic hashing
 * Sorts object keys recursively
 */
function stableStringify(obj: unknown): string {
  // Handle null and undefined explicitly with markers
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';

  // Helper to escape strings
  const jsonStringify = (s: string): string => '"' + s.replace(/"/g, '\\"') + '"';

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
      const value = (obj as Record<string, unknown>)[key];
      return `"${key}":${stableStringify(value)}`;
    });
    return '{' + pairs.join(',') + '}';
  }
  return '';
}
