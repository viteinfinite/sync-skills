import { expect } from 'chai';
import { detectConflicts } from '../src/detector.js';
import { promises as fs } from 'fs';

describe('detectConflicts', () => {
  const testDir = './test/fixtures/detect';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.codex/skills/test-skill`, { recursive: true });

    await fs.writeFile(`${testDir}/.claude/skills/test-skill/SKILL.md`, 'content A');
    await fs.writeFile(`${testDir}/.codex/skills/test-skill/SKILL.md`, 'content B');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect conflicts when same skill has different content', async () => {
    const claudeSkills = [{ skillName: 'test-skill', path: `${testDir}/.claude/skills/test-skill/SKILL.md` }];
    const codexSkills = [{ skillName: 'test-skill', path: `${testDir}/.codex/skills/test-skill/SKILL.md` }];

    const conflicts = await detectConflicts(claudeSkills, codexSkills);

    expect(conflicts).to.have.lengthOf(1);
    expect(conflicts[0].skillName).to.equal('test-skill');
  });

  it('should not detect conflicts when content is identical', async () => {
    await fs.writeFile(`${testDir}/.codex/skills/test-skill/SKILL.md`, 'content A');

    const claudeSkills = [{ skillName: 'test-skill', path: `${testDir}/.claude/skills/test-skill/SKILL.md` }];
    const codexSkills = [{ skillName: 'test-skill', path: `${testDir}/.codex/skills/test-skill/SKILL.md` }];

    const conflicts = await detectConflicts(claudeSkills, codexSkills);

    expect(conflicts).to.have.lengthOf(0);
  });
});
