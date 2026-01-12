import { expect } from 'chai';
import { refactorSkill } from '../src/syncer.js';
import { promises as fs } from 'fs';

describe('refactorSkill', () => {
  const testDir = './test/fixtures/refactor';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.agents-common/skills/test-skill`, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should extract body to .agents-common and replace with @ reference', async () => {
    const sourcePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    await fs.writeFile(sourcePath, `---
name: test-skill
description: Test skill
---

# Content

This is content`);

    await refactorSkill(sourcePath);

    const sourceContent = await fs.readFile(sourcePath, 'utf8');
    const commonPath = `${testDir}/.agents-common/skills/test-skill/SKILL.md`;
    const commonContent = await fs.readFile(commonPath, 'utf8');

    expect(sourceContent).to.include('@.agents-common/skills/test-skill/SKILL.md');
    expect(sourceContent).to.include('managed-by: sync-skills');
    expect(sourceContent).to.include('refactored:');
    // Common now contains frontmatter + body
    expect(commonContent).to.include('name: test-skill');
    expect(commonContent).to.include('description: Test skill');
    expect(commonContent).to.include('# Content');
    expect(commonContent).to.include('This is content');
  });

  it('should not refactor if @ reference already exists', async () => {
    const sourcePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    await fs.writeFile(sourcePath, `---
name: test-skill
---

@.agents-common/skills/test-skill/SKILL.md`);

    await fs.writeFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'original');

    await refactorSkill(sourcePath);

    const commonContent = await fs.readFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'utf8');
    expect(commonContent).to.equal('original'); // Should not overwrite
  });
});
