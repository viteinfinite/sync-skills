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
  createConfig
} from '../helpers/test-setup.js';

function getPromptChoices(promptStub: { getCalls: () => any[] }, messageIncludes: string, index = 0) {
  const matchingCalls = promptStub.getCalls().filter(call => {
    const questions = call.args[0];
    const firstQuestion = Array.isArray(questions) ? questions[0] : questions;
    return firstQuestion?.message?.includes(messageIncludes);
  });
  const match = matchingCalls[index];
  if (!match) {
    return [];
  }
  const questions = match.args[0];
  const firstQuestion = Array.isArray(questions) ? questions[0] : questions;
  return firstQuestion?.choices ?? [];
}

test.describe('scenarios out-of-sync', { concurrency: 1 }, () => {
  test('Scenario 9: Body out-of-sync with invalid @ reference - offers keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([{ action: 'keep-common' }]);

    const testDir = await createTestFixture('scenario9', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
      await createCommonSkill(dir, 'body-sync-skill', '---\nname: body-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Body Sync\nOriginal content');
      await createSkillFile(dir, '.claude', 'body-sync-skill', '---\nname: body-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/wrong-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'));
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));

    const claudeContent = await readSkillFile(testDir, '.claude', 'body-sync-skill');
    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/body-sync-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 10: N platforms with body out-of-sync @ - single resolution', async () => {
    const promptStub = stubInquirer([{ action: 'keep-common' }]);

    const testDir = await createTestFixture('scenario10', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'multi-sync-skill', '---\nname: multi-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Multi Sync\nOriginal content');
      await createSkillFile(dir, '.claude', 'multi-sync-skill', '---\nname: multi-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/wrong1/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'multi-sync-skill', '---\nname: multi-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/wrong2/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'));

    const claudeContent = await readSkillFile(testDir, '.claude', 'multi-sync-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'multi-sync-skill');

    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/multi-sync-skill/SKILL.md'));
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/multi-sync-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 11: Body out-of-sync without @ - offers keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([{ action: 'keep-platform' }]);

    const testDir = await createTestFixture('scenario11', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
      await createCommonSkill(dir, 'body-content-skill', '---\nname: body-content-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Body Content\nOriginal common content');
      await createSkillFile(dir, '.claude', 'body-content-skill', '---\nname: body-content-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n# Body Content\nModified platform content');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'));
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));

    const commonContent = await readCommonSkill(testDir, 'body-content-skill');
    assert.ok(commonContent.includes('Modified platform content'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 12: N platforms with body out-of-sync (no @) - keep-common or abort', async () => {
    const promptStub = stubInquirer([{ action: 'keep-common' }]);

    const testDir = await createTestFixture('scenario12', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'multi-body-skill', '---\nname: multi-body-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Multi Body\nOriginal common content');
      await createSkillFile(dir, '.claude', 'multi-body-skill', '---\nname: multi-body-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nClaude content');
      await createSkillFile(dir, '.codex', 'multi-body-skill', '---\nname: multi-body-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nCodex content');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'));

    const claudeContent = await readSkillFile(testDir, '.claude', 'multi-body-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'multi-body-skill');
    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/multi-body-skill/SKILL.md'));
    assert.ok(codexContent.includes('@../../../.sync-skills/skills/multi-body-skill/SKILL.md'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 13: CORE_FIELD frontmatter out-of-sync - offers keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([{ action: 'keep-platform' }]);

    const testDir = await createTestFixture('scenario13', async (dir) => {
      await createConfig(dir, ['claude']);
      await createCommonSkill(dir, 'fm-skill', '---\nname: fm-skill\ndescription: Original description\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent');
      await createSkillFile(dir, '.claude', 'fm-skill', '---\nname: fm-skill\ndescription: Modified description\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/fm-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'));
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));

    const commonContent = await readCommonSkill(testDir, 'fm-skill');
    assert.ok(commonContent.includes('Modified description'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 14: N platforms with CORE_FIELD frontmatter out-of-sync', async () => {
    const promptStub = stubInquirer([{ action: 'keep-common' }]);

    const testDir = await createTestFixture('scenario14', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'multi-fm-skill', '---\nname: multi-fm-skill\ndescription: Original\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent');
      await createSkillFile(dir, '.claude', 'multi-fm-skill', '---\nname: multi-fm-skill\ndescription: Claude desc\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/multi-fm-skill/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'multi-fm-skill', '---\nname: multi-fm-skill\ndescription: Codex desc\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/multi-fm-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 15: Both conflicts with @ reference - only keep-common and abort', async () => {
    const promptStub = stubInquirer([{ action: 'keep-common' }]);

    const testDir = await createTestFixture('scenario15', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
      await createCommonSkill(dir, 'both-at-skill', '---\nname: both-at-skill\ndescription: Original\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nOriginal content');
      await createSkillFile(dir, '.claude', 'both-at-skill', '---\nname: both-at-skill\ndescription: Modified\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/wrong/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'));

    const claudeContent = await readSkillFile(testDir, '.claude', 'both-at-skill');
    assert.ok(claudeContent.includes('@../../../.sync-skills/skills/both-at-skill/SKILL.md'));
    assert.ok(claudeContent.includes('description: Original'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 16: Both conflicts without @ - keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([{ action: 'keep-platform' }]);

    const testDir = await createTestFixture('scenario16', async (dir) => {
      await createConfig(dir, ['claude']);
      await createCommonSkill(dir, 'both-content-skill', '---\nname: both-content-skill\ndescription: Original\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nOriginal content');
      await createSkillFile(dir, '.claude', 'both-content-skill', '---\nname: both-content-skill\ndescription: Modified\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nPlatform content');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'));
    assert.ok(choices.some(choice => choice.value === 'keep-common'));
    assert.ok(choices.some(choice => choice.value === 'abort'));

    const commonContent = await readCommonSkill(testDir, 'both-content-skill');
    assert.ok(commonContent.includes('description: Modified'));
    assert.ok(commonContent.includes('Platform content'));

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 17: Multiple skills with both conflicts (@ reference) - keep-common or abort each', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-common' },
      { action: 'keep-common' }
    ]);

    const testDir = await createTestFixture('scenario17', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
      await createCommonSkill(dir, 'skill1', '---\nname: skill1\ndescription: Original1\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent1');
      await createCommonSkill(dir, 'skill2', '---\nname: skill2\ndescription: Original2\nmetadata:\n  sync:\n    hash: sha256-def456\n    version: 2\n---\nContent2');
      await createSkillFile(dir, '.claude', 'skill1', '---\nname: skill1\ndescription: Modified1\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/wrong1/SKILL.md\n');
      await createSkillFile(dir, '.claude', 'skill2', '---\nname: skill2\ndescription: Modified2\nmetadata:\n  sync:\n    hash: sha256-def456\n---\n@../../../.sync-skills/skills/wrong2/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const firstChoices = getPromptChoices(promptStub, 'out-of-sync', 0);
    const secondChoices = getPromptChoices(promptStub, 'out-of-sync', 1);
    for (const choices of [firstChoices, secondChoices]) {
      assert.ok(choices.some(choice => choice.value === 'keep-common'));
      assert.ok(choices.some(choice => choice.value === 'abort'));
      assert.ok(!choices.some(choice => choice.value === 'keep-platform'));
    }

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 18: Multiple skills with both conflicts (no @) - all options per skill', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-platform' },
      { action: 'keep-common' }
    ]);

    const testDir = await createTestFixture('scenario18', async (dir) => {
      await createConfig(dir, ['claude']);
      await createCommonSkill(dir, 'multi-both-skill1', '---\nname: multi-both-skill1\ndescription: Original1\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent1');
      await createCommonSkill(dir, 'multi-both-skill2', '---\nname: multi-both-skill2\ndescription: Original2\nmetadata:\n  sync:\n    hash: sha256-def456\n    version: 2\n---\nContent2');
      await createSkillFile(dir, '.claude', 'multi-both-skill1', '---\nname: multi-both-skill1\ndescription: Modified1\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nPlatform content1');
      await createSkillFile(dir, '.claude', 'multi-both-skill2', '---\nname: multi-both-skill2\ndescription: Modified2\nmetadata:\n  sync:\n    hash: sha256-def456\n---\nPlatform content2');
    });

    await run({ baseDir: testDir });

    const firstChoices = getPromptChoices(promptStub, 'out-of-sync', 0);
    const secondChoices = getPromptChoices(promptStub, 'out-of-sync', 1);
    for (const choices of [firstChoices, secondChoices]) {
      assert.ok(choices.some(choice => choice.value === 'keep-platform'));
      assert.ok(choices.some(choice => choice.value === 'keep-common'));
      assert.ok(choices.some(choice => choice.value === 'abort'));
    }

    promptStub.restore();
    const secondPromptStub = stubInquirer({ assistants: ['claude'] });
    await run({ baseDir: testDir });
    assert.strictEqual(secondPromptStub.callCount, 0);
    secondPromptStub.restore();

    await cleanupTestFixture(testDir);
  });
});
