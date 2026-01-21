import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { AssistantConfig } from './types.js';

export interface WalkDirResult {
  agent: string;
  skillName: string;
  path: string;
  relativePath: string;
}

async function* walkDir(
  dir: string,
  agent: string,
  baseDir: string,
  originalBaseDir: string
): AsyncGenerator<WalkDirResult> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDir(fullPath, agent, baseDir, originalBaseDir);
      } else if (entry.name === 'SKILL.md') {
        const relativePath = fullPath.substring(baseDir.length + 1);
        const parts = relativePath.split('/');
        const skillName = parts[2];

        // Reconstruct the path using the original baseDir to preserve format
        // Use string concatenation to avoid path normalization
        const separator = originalBaseDir.endsWith('/') ? '' : '/';
        const resultPath = originalBaseDir + separator + relativePath;

        yield {
          agent,
          skillName,
          path: resultPath,
          relativePath
        };
      }
    }
  } catch {
    // Directory doesn't exist
  }
}

interface ScanResult {
  /** Map of assistant name to their skills (e.g., { claude: [...], codex: [...], kilo: [...] }) */
  platforms: Record<string, WalkDirResult[]>;
  /** Skills in .agents-common */
  common: WalkDirResult[];
}

/**
 * Scan for skills in all enabled assistant directories and .agents-common
 * @param baseDir - Base directory to scan
 * @param assistantConfigs - Array of assistant configs to scan
 * @returns ScanResult with platform skills map and common skills
 */
export async function scanSkills(
  baseDir: string = process.cwd(),
  assistantConfigs?: AssistantConfig[]
): Promise<ScanResult> {
  // If no configs provided, use default for backwards compatibility
  const configs = assistantConfigs || [
    { name: 'claude', dir: '.claude', skillsDir: '.claude/skills' },
    { name: 'codex', dir: '.codex', skillsDir: '.codex/skills' }
  ];

  const platforms: Record<string, WalkDirResult[]> = {};
  const common: WalkDirResult[] = [];

  // Normalize the base directory for filesystem operations
  const normalizedBaseDir = join(baseDir);

  // Scan each enabled assistant platform
  for (const config of configs) {
    const platformSkills: WalkDirResult[] = [];
    const skillsPath = join(baseDir, config.skillsDir);

    for await (const skill of walkDir(skillsPath, config.name, normalizedBaseDir, baseDir)) {
      platformSkills.push(skill);
    }

    platforms[config.name] = platformSkills;
  }

  // Scan .agents-common
  for await (const skill of walkDir(join(baseDir, '.agents-common'), 'common', normalizedBaseDir, baseDir)) {
    common.push(skill);
  }

  return { platforms, common };
}
