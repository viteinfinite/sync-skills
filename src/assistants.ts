import { promises as fs } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import matter from 'gray-matter';
import type {
  AssistantConfig,
  AssistantState,
  SkillFile,
  SyncPair
} from './types.js';

const CORE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

/**
 * Discover the state of all configured assistants
 */
export async function discoverAssistants(baseDir: string): Promise<AssistantState[]> {
  const states: AssistantState[] = [];

  for (const config of ASSISTANTS) {
    const state = await discoverAssistant(baseDir, config);
    states.push(state);
  }

  return states;
}

/**
 * Discover the state of a single assistant
 */
async function discoverAssistant(baseDir: string, config: AssistantConfig): Promise<AssistantState> {
  const assistantDir = join(baseDir, config.dir);
  const skillsDir = join(baseDir, config.skillsDir);

  let hasDir = false;
  let hasSkills = false;
  const skills: SkillFile[] = [];

  try {
    // Check if assistant directory exists
    await fs.access(assistantDir);
    hasDir = true;

    // Check if skills directory exists and has content
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory) {
          const skillFile = join(skillsDir, entry.name, 'SKILL.md');
          try {
            await fs.access(skillFile);
            skills.push({
              path: skillFile,
              skillName: entry.name
            });
          } catch {
            // SKILL.md doesn't exist, skip this directory
          }
        }
      }

      hasSkills = skills.length > 0;
    } catch {
      // Skills directory doesn't exist or is not accessible
      hasSkills = false;
    }
  } catch {
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
export function findSyncPairs(states: AssistantState[]): SyncPair[] {
  const pairs: SyncPair[] = [];

  for (const source of states) {
    if (!source.hasSkills) continue;

    for (const target of states) {
      if (target.config.name === source.config.name) continue;
      if (target.hasSkills) continue;

      pairs.push({ source, target });
    }
  }

  return pairs;
}

/**
 * Check if a sync pair needs user prompt (target dir doesn't exist)
 */
export function needsPrompt(pair: SyncPair): boolean {
  return !pair.target.hasDir;
}

/**
 * Prompt user for sync permission
 */
export async function promptForSync(targetName: string): Promise<boolean> {
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
export async function cloneAssistantSkills(
  baseDir: string,
  sourceSkills: SkillFile[],
  targetConfig: AssistantConfig
): Promise<void> {
  for (const skill of sourceSkills) {
    const content = await fs.readFile(skill.path, 'utf-8');
    const parsed = matter(content);

    // Extract only core frontmatter fields
    const coreFrontmatter: Record<string, unknown> = {};
    for (const field of CORE_FIELDS) {
      if (parsed.data[field]) {
        coreFrontmatter[field] = parsed.data[field];
      }
    }

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
export async function processSyncPairs(
  baseDir: string,
  pairs: SyncPair[],
  dryRun: boolean
): Promise<void> {
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
    } else {
      // Auto-sync when target directory exists
      shouldSync = true;
    }

    if (shouldSync) {
      await cloneAssistantSkills(baseDir, pair.source.skills, pair.target.config);
    }
  }
}

// Helper function to get dirname
function dirname(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

// Re-export ASSISTANTS for convenience
export const ASSISTANTS = await import('./types.js').then(m => m.ASSISTANTS);
