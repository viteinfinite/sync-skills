import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import {
  createTestFixture,
  createSkillFile,
  createCommonSkill,
  cleanupTestFixture,
  stubInquirer,
  readSkillFile,
  readCommonSkill,
  createConfig,
  exists
} from '../helpers/test-setup.js';

// Run tests sequentially to avoid sinon stub conflicts
test.describe('scenarios setup', { concurrency: 1 }, () => {
  test('Scenario 1: Full sync setup with platform skills and conflicts', async () => {
    const promptStub = stubInquirer([
      { create: true },
      { action: 'use-common' }
    ]);

    const testDir = await createTestFixture('scenario1', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\n# My Skill\nThis is a test skill.');
    });

    await run({ baseDir: testDir });

    const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/my-skill/SKILL.md'));

    const commonContent = await readCommonSkill(testDir, 'my-skill');
    assert.ok(commonContent.includes('# My Skill'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 2: .claude skills exists, .codex folder exists - auto-create', async () => {
    const promptStub = stubInquirer([{ action: 'use-common' }]);

    const testDir = await createTestFixture('scenario2', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\n# My Skill\nThis is a test skill.');
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
    });

    await run({ baseDir: testDir });

    const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/my-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario: First sync with only claude skill should not prompt out-of-sync right after refactor', async () => {
    const promptStub = stubInquirer({ assistants: ['claude'] });

    const testDir = await createTestFixture('scenario-first-sync-claude-only', async (dir) => {
      await createSkillFile(dir, '.claude', 'mimma', '---\nname: mimma\n---\nHEOLO');
    });

    await run({ baseDir: testDir });

    const claudeContent = await readSkillFile(testDir, '.claude', 'mimma');
    const commonContent = await readCommonSkill(testDir, 'mimma');

    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/mimma/SKILL.md'));
    assert.ok(commonContent.includes('HEOLO'));

    const outOfSyncPrompts = promptStub.getCalls().filter(call => {
      const questions = call.args[0];
      const firstQuestion = Array.isArray(questions) ? questions[0] : questions;
      return firstQuestion?.message?.includes('out-of-sync');
    });
    assert.strictEqual(outOfSyncPrompts.length, 0);

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 3: No skills anywhere - exits without creating anything', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario3', async () => {});

    await run({ baseDir: testDir });

    const codexSkillsExist = await exists(testDir, '.codex/skills');
    const claudeSkillsExist = await exists(testDir, '.claude/skills');
    const commonExists = await exists(testDir, '.sync-skills');
    assert.ok(!codexSkillsExist);
    assert.ok(!claudeSkillsExist);
    assert.ok(!commonExists);
    assert.strictEqual(promptStub.callCount, 0);

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 4: .codex skills exists, no config, user declines .claude creation', async () => {
    const promptStub = stubInquirer([
      { assistants: ['claude', 'codex'] },
      { create: false },
      { action: 'use-common' }
    ]);

    const testDir = await createTestFixture('scenario4', async (dir) => {
      await createSkillFile(dir, '.codex', 'codex-skill', '---\nname: codex-skill\n---\n# Codex Skill\nThis is a codex skill.');
    });

    await run({ baseDir: testDir });

    const commonContent = await readCommonSkill(testDir, 'codex-skill');
    assert.ok(commonContent.includes('# Codex Skill'));
    const configExists = await exists(testDir, '.sync-skills/config.json');
    assert.ok(configExists);

    const codexContent = await readSkillFile(testDir, '.codex', 'codex-skill');
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/codex-skill/SKILL.md'));

    const claudeSkillsExist = await exists(testDir, '.claude/skills');
    assert.ok(!claudeSkillsExist);

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 5: .codex skills exists, no config, user confirms .claude creation', async () => {
    const promptStub = stubInquirer([
      { assistants: ['claude', 'codex'] },
      { create: true },
      { action: 'use-common' }
    ]);

    const testDir = await createTestFixture('scenario5', async (dir) => {
      await createSkillFile(dir, '.codex', 'codex-skill', '---\nname: codex-skill\n---\n# Codex Skill\nThis is a codex skill.');
    });

    await run({ baseDir: testDir });

    const commonContent = await readCommonSkill(testDir, 'codex-skill');
    assert.ok(commonContent.includes('# Codex Skill'));

    const codexContent = await readSkillFile(testDir, '.codex', 'codex-skill');
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/codex-skill/SKILL.md'));

    const claudeContent = await readSkillFile(testDir, '.claude', 'codex-skill');
    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/codex-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 6: Only .sync-skills + config exist - creates assistant directories', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'], create: true });

    const testDir = await createTestFixture('scenario6', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'common-skill', '---\nname: common-skill\n---\n# Common Skill\nThis is a common skill.');
    });

    await run({ baseDir: testDir });

    const claudeContent = await readSkillFile(testDir, '.claude', 'common-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'common-skill');

    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/common-skill/SKILL.md'));
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/common-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 7: Skills already refactored to @, all equal - no conflict on second run', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario7', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'equal-skill', '---\nname: equal-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Equal Skill\nSame content');
      await createSkillFile(dir, '.claude', 'equal-skill', '---\nname: equal-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/equal-skill/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'equal-skill', '---\nname: equal-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/equal-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });
    await run({ baseDir: testDir });

    assert.strictEqual(promptStub.callCount, 0);

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 8: Skills with different non-CORE_FIELD fields - no conflict', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario8', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'model-skill', '---\nname: model-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Model Skill\nSame content');
      await createSkillFile(dir, '.claude', 'model-skill', '---\nname: model-skill\nmodel: claude-3-opus\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/model-skill/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'model-skill', '---\nname: model-skill\nmodel: gpt-4\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/model-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const claudeContent = await readSkillFile(testDir, '.claude', 'model-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'model-skill');

    assert.ok(claudeContent.includes('model: claude-3-opus'));
    assert.ok(codexContent.includes('model: gpt-4'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });
});
