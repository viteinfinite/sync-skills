import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import sinon from 'sinon';
import inquirer from 'inquirer';

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
  const testDir = resolve(`./test/fixtures/${name}`);

  // Clean up any existing fixture
  await fs.rm(testDir, { recursive: true, force: true });

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
 * @param responses - Map of question names to resolved values
 * @returns Sinon stub that can be restored
 */
export function stubInquirer(responses: Record<string, unknown>): sinon.SinonStub {
  return sinon.stub(inquirer, 'prompt').callsFake(async (questions: unknown) => {
    const qs = questions as Array<{ name: string }>;
    const q = qs[0];
    if (q && q.name in responses) {
      return { [q.name]: responses[q.name] };
    }
    throw new Error(`No stub response for question: ${q.name}`);
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
