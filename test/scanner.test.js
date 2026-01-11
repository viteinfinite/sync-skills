import { expect } from 'chai';
import { scanSkills } from '../src/scanner.js';
import { promises as fs } from 'fs';

describe('scanSkills', () => {
  const testDir = './test/fixtures/scan';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.codex/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.agents-common/skills/test-skill`, { recursive: true });

    await fs.writeFile(`${testDir}/.claude/skills/test-skill/SKILL.md`, 'content');
    await fs.writeFile(`${testDir}/.codex/skills/test-skill/SKILL.md`, 'content');
    await fs.writeFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'content');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should scan all skill files from target directories', async () => {
    const result = await scanSkills(testDir);

    expect(result.claude).to.have.lengthOf(1);
    expect(result.codex).to.have.lengthOf(1);
    expect(result.common).to.have.lengthOf(1);
  });

  it('should return skill metadata', async () => {
    const result = await scanSkills(testDir);

    expect(result.claude[0]).to.include({
      agent: 'claude',
      skillName: 'test-skill',
      path: `${testDir}/.claude/skills/test-skill/SKILL.md`
    });
  });
});
