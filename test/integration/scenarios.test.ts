import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, createCommonSkill, cleanupTestFixture, stubInquirer, readSkillFile, createConfig } from '../helpers/test-setup.js';

// Run tests sequentially to avoid sinon stub conflicts
test.describe('scenarios', { concurrency: 1 }, () => {
  test('Integration: Scenario 1 - .codex folder missing should prompt user', async () => {
    const promptStub = stubInquirer({ 
      assistants: ['claude', 'codex'],
      create: true, 
      action: 'keep-both' 
    });

    const testDir = await createTestFixture('scenario1', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '# My Skill\nThis is a test skill.');
    });

    await run({ baseDir: testDir });

    // Verify .codex/skills was created
    const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
    assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Integration: Scenario 2 - .codex folder exists should auto-create', async () => {
    const promptStub = stubInquirer({ 
      assistants: ['claude', 'codex'],
      action: 'keep-both' 
    });

    const testDir = await createTestFixture('scenario2', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '# My Skill\nThis is a test skill.');
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
    });

    await run({ baseDir: testDir });

    // Verify .codex/skills was created without prompt
    const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
    assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Integration: Scenario 3 - no skills should exit silently', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario3', async (dir) => {
      // Empty directory
    });

    await run({ baseDir: testDir });

    // Verify no assistant skill directories were created (only config should exist)
    const codexSkillsExist = await fs.access(join(testDir, '.codex/skills')).then(() => true).catch(() => false);
    const claudeSkillsExist = await fs.access(join(testDir, '.claude/skills')).then(() => true).catch(() => false);
    assert.ok(!codexSkillsExist, '.codex/skills should not exist');
    assert.ok(!claudeSkillsExist, '.claude/skills should not exist');

    // Config should be created
    const configExists = await fs.access(join(testDir, '.agents-common/config.json')).then(() => true).catch(() => false);
    assert.ok(configExists, 'config should exist');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Integration: Bidirectional - sync from .codex to .claude', async () => {
    const promptStub = stubInquirer({ 
      assistants: ['claude', 'codex'],
      create: true, 
      action: 'keep-both' 
    });

    const testDir = await createTestFixture('bidirectional', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.codex', 'codex-skill', '# Codex Skill\nThis is a codex test skill.');
    });

    await run({ baseDir: testDir });

    // Verify .claude/skills was created
    const claudeContent = await readSkillFile(testDir, '.claude', 'codex-skill');
    assert.ok(claudeContent.includes('@.agents-common/skills/codex-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Integration: Scenario 5 - common-only skills should get platform references', async () => {
    const promptStub = stubInquirer({ 
      assistants: ['claude'],
      action: 'keep-both' 
    });

    const testDir = await createTestFixture('scenario5', async (dir) => {
      // Set up config with claude enabled
      await createConfig(dir, ['claude']);

      // Create myskill-1 in both common and claude (existing sync)
      await createCommonSkill(dir, 'myskill-1', '---\nname: myskill-1\n---\n# My Skill 1\nContent');
      await createSkillFile(dir, '.claude', 'myskill-1', '---\nname: myskill-1\n---\n@.agents-common/skills/myskill-1/SKILL.md\n');

      // Create myskill-2 ONLY in common (no platform reference yet)
      await createCommonSkill(dir, 'myskill-2', '---\nname: myskill-2\n---\n# My Skill 2\nCommon only skill');
    });

    await run({ baseDir: testDir });

    // Verify myskill-2 now has @ reference in .claude
    const claudeContent = await readSkillFile(testDir, '.claude', 'myskill-2');
    assert.ok(claudeContent.includes('@.agents-common/skills/myskill-2/SKILL.md'),
      'myskill-2 should have @ reference in .claude');
    assert.ok(claudeContent.includes('name: myskill-2'),
      'myskill-2 should have frontmatter preserved');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Integration: Scenario 5 - common-only skills should sync to multiple platforms', async () => {
    const promptStub = stubInquirer({
      assistants: ['claude', 'codex'],
      action: 'keep-both'
    });

    const testDir = await createTestFixture('scenario5-multi', async (dir) => {
      // Set up config with both claude and codex enabled
      await createConfig(dir, ['claude', 'codex']);

      // Create .codex folder so it doesn't prompt
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
      await fs.mkdir(join(dir, '.claude'), { recursive: true });

      // Create skill ONLY in common
      await createCommonSkill(dir, 'common-only-skill', '---\nname: common-only-skill\ndescription: A skill only in common\n---\n# Common Only\nThis skill exists only in .agents-common');
    });

    await run({ baseDir: testDir });

    // Verify skill has @ references in both platforms
    const claudeContent = await readSkillFile(testDir, '.claude', 'common-only-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'common-only-skill');

    assert.ok(claudeContent.includes('@.agents-common/skills/common-only-skill/SKILL.md'),
      'common-only-skill should have @ reference in .claude');
    assert.ok(codexContent.includes('@.agents-common/skills/common-only-skill/SKILL.md'),
      'common-only-skill should have @ reference in .codex');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });
});
