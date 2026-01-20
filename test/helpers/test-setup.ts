import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import sinon from 'sinon';
import inquirer from 'inquirer';

// Create a shared sandbox for all tests
const sandbox = sinon.createSandbox();

/**
 * Create a temporary test fixture directory
 * @param name - Name for the test fixture
 * @param setup - Optional setup function to create files
 * @returns Absolute path to the test fixture directory
 */
export async function createTestFixture(
  name: string,
  setup?: (dir: string) => Promise<void>
): Promise<string> {
  const testDir = join(tmpdir(), `sync-skills-test-${name}-${Math.random().toString(36).slice(2, 7)}`);

  // Create the directory
  await fs.mkdir(testDir, { recursive: true });

  // Run setup if provided
  if (setup) {
    await setup(testDir);
  }

  return testDir;
}

/**
 * Clean up a test fixture directory
 * @param dir - Absolute path to the test fixture directory
 */
export async function cleanupTestFixture(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Stub inquirer.prompt to avoid interactive prompts
 * Supports both single response and sequential response array
 * Uses a shared sandbox to avoid conflicts between tests
 * @param responses - Map of question names to resolved values, or array of such maps for sequential calls
 * @returns Sinon stub that can be restored
 */
export function stubInquirer(responses: Record<string, unknown> | Array<Record<string, unknown>>): sinon.SinonStub {
  // Restore any existing prompt stub first
  sandbox.restore();

  const responsesArray = Array.isArray(responses) ? responses : [responses];
  let callCount = 0;

  return sandbox.stub(inquirer, 'prompt').callsFake(async (questions: unknown) => {
    const qs = (Array.isArray(questions) ? questions : [questions]) as Array<{ name: string; message?: string }>;
    const currentResponses = responsesArray[Math.min(callCount, responsesArray.length - 1)];
    callCount++;
    const result: Record<string, unknown> = {};
    for (const q of qs) {
      // Handle out-of-sync prompts (distinguish by message content)
      if (q.name === 'action' && q.message && q.message.includes('out-of-sync')) {
        const outOfSyncAction = currentResponses['outOfSyncAction'] as string | undefined;
        // Map old outOfSyncAction values to new action values
        if (outOfSyncAction === 'use-common' || outOfSyncAction === 'keep-common') {
          result[q.name] = 'keep-common';
        } else if (outOfSyncAction === 'skip') {
          result[q.name] = 'keep-common'; // skip now means keep common
        } else if (outOfSyncAction === 'use-platform') {
          result[q.name] = 'keep-platform';
        } else if (outOfSyncAction === 'abort') {
          result[q.name] = 'abort';
        } else {
          result[q.name] = currentResponses['action'] ?? 'keep-common';
        }
      } else if (q.name in currentResponses) {
        result[q.name] = currentResponses[q.name];
      } else {
        throw new Error(`No stub response for question: ${q.name}`);
      }
    }
    return result;
  });
}

/**
 * Create a skill file with content
 * @param dir - Base directory
 * @param assistant - Assistant name (e.g., '.claude')
 * @param skillName - Name of the skill
 * @param content - Content of the skill file
 */
export async function createSkillFile(
  dir: string,
  assistant: string,
  skillName: string,
  content: string
): Promise<void> {
  const skillDir = join(dir, assistant, 'skills', skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');
}

/**
 * Read a skill file content
 * @param dir - Base directory
 * @param assistant - Assistant name (e.g., '.claude')
 * @param skillName - Name of the skill
 * @returns Content of the skill file
 */
export async function readSkillFile(
  dir: string,
  assistant: string,
  skillName: string
): Promise<string> {
  const skillPath = join(dir, assistant, 'skills', skillName, 'SKILL.md');
  return await fs.readFile(skillPath, 'utf-8');
}

/**
 * Create a common skill file in .agents-common
 * @param dir - Base directory
 * @param skillName - Name of the skill
 * @param content - Content of the skill file
 */
export async function createCommonSkill(
  dir: string,
  skillName: string,
  content: string
): Promise<void> {
  const skillDir = join(dir, '.agents-common/skills', skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');
}

/**
 * Create a config file with specified assistants
 * @param dir - Base directory
 * @param assistants - Array of assistant names to enable
 */
export async function createConfig(
  dir: string,
  assistants: string[] = ['claude', 'codex']
): Promise<void> {
  const configDir = join(dir, '.agents-common');
  await fs.mkdir(configDir, { recursive: true });
  const configPath = join(configDir, 'config.json');
  const config = {
    version: 1,
    assistants
  };
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Read a common skill file content
 * @param dir - Base directory
 * @param skillName - Name of the skill
 * @returns Content of the skill file
 */
export async function readCommonSkill(
  dir: string,
  skillName: string
): Promise<string> {
  const skillPath = join(dir, '.agents-common/skills', skillName, 'SKILL.md');
  return await fs.readFile(skillPath, 'utf-8');
}

/**
 * Check if a file or directory exists
 * @param dir - Base directory
 * @param path - Relative path to check
 * @returns True if exists, false otherwise
 */
export async function exists(dir: string, path: string): Promise<boolean> {
  try {
    await fs.access(join(dir, path));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a directory
 * @param dir - Base directory
 * @param path - Relative path to create
 */
export async function createDir(dir: string, path: string): Promise<void> {
  await fs.mkdir(join(dir, path), { recursive: true });
}
