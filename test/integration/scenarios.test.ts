import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, createCommonSkill, cleanupTestFixture, stubInquirer, readSkillFile, readCommonSkill, createConfig, exists } from '../helpers/test-setup.js';

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

// Run tests sequentially to avoid sinon stub conflicts
test.describe('scenarios', { concurrency: 1 }, () => {
  test('Scenario 1: Full sync setup with platform skills and conflicts', async () => {
    // Config is pre-created, so only prompts are: folder creation, conflict resolution
    const promptStub = stubInquirer([
      { create: true },  // Create .codex folder
      { action: 'use-common' }  // Conflict resolution: use common
    ]);

    const testDir = await createTestFixture('scenario1', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      // Create .claude/skills with a skill (with frontmatter)
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\n# My Skill\nThis is a test skill.');
    });

    await run({ baseDir: testDir });

    // Verify .codex/skills was created with @ reference
    const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
    assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'),
      'codex skill should have @ reference');

    // Verify .agents-common/skills was created with the skill content
    const commonContent = await readCommonSkill(testDir, 'my-skill');
    assert.ok(commonContent.includes('# My Skill'),
      'common skill should have original content');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 2: .claude skills exists, .codex folder exists - auto-create', async () => {
    const promptStub = stubInquirer([
      { action: 'use-common' }  // Conflict resolution
    ]);

    const testDir = await createTestFixture('scenario2', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\n# My Skill\nThis is a test skill.');
      // Create .codex folder (but not .codex/skills)
      await fs.mkdir(join(dir, '.codex'), { recursive: true });
    });

    await run({ baseDir: testDir });

    // Verify .codex/skills was created without prompt
    const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
    assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'),
      'codex skill should have @ reference');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 3: No skills anywhere - exits without creating anything', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario3', async (dir) => {
      // Empty directory - no skills anywhere
    });

    await run({ baseDir: testDir });

    // Verify no assistant skill directories were created
    const codexSkillsExist = await exists(testDir, '.codex/skills');
    const claudeSkillsExist = await exists(testDir, '.claude/skills');
    const commonExists = await exists(testDir, '.agents-common');
    assert.ok(!codexSkillsExist, '.codex/skills should not exist');
    assert.ok(!claudeSkillsExist, '.claude/skills should not exist');
    assert.ok(!commonExists, '.agents-common should not exist');
    assert.strictEqual(promptStub.callCount, 0, 'should not prompt when no skills exist');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 4: .codex skills exists, no config, user declines .claude creation', async () => {
    const promptStub = stubInquirer([
      { assistants: ['claude', 'codex'] },  // Config prompt - user selects both
      { create: false },  // User declines folder creation
      { action: 'use-common' }  // Conflict resolution
    ]);

    const testDir = await createTestFixture('scenario4', async (dir) => {
      // .codex/skills exists, no config, no .claude
      await createSkillFile(dir, '.codex', 'codex-skill', '---\nname: codex-skill\n---\n# Codex Skill\nThis is a codex skill.');
    });

    await run({ baseDir: testDir });

    // Verify .agents-common/skills was created
    const commonContent = await readCommonSkill(testDir, 'codex-skill');
    assert.ok(commonContent.includes('# Codex Skill'),
      'common skill should have original content');
    const configExists = await exists(testDir, '.agents-common/config.json');
    assert.ok(configExists, 'config should be created in .agents-common');

    // Verify .codex/skills was refactored with @ reference
    const codexContent = await readSkillFile(testDir, '.codex', 'codex-skill');
    assert.ok(codexContent.includes('@.agents-common/skills/codex-skill/SKILL.md'),
      'codex skill should have @ reference');

    // Verify .claude/skills was NOT created
    const claudeSkillsExist = await exists(testDir, '.claude/skills');
    assert.ok(!claudeSkillsExist, '.claude/skills should not exist when user declines');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 5: .codex skills exists, no config, user confirms .claude creation', async () => {
    const promptStub = stubInquirer([
      { assistants: ['claude', 'codex'] },  // Config prompt - user selects both
      { create: true },  // User confirms folder creation
      { action: 'use-common' }  // Conflict resolution
    ]);

    const testDir = await createTestFixture('scenario5', async (dir) => {
      // .codex/skills exists, no config, no .claude
      await createSkillFile(dir, '.codex', 'codex-skill', '---\nname: codex-skill\n---\n# Codex Skill\nThis is a codex skill.');
    });

    await run({ baseDir: testDir });

    // Verify .agents-common/skills was created
    const commonContent = await readCommonSkill(testDir, 'codex-skill');
    assert.ok(commonContent.includes('# Codex Skill'),
      'common skill should have original content');

    // Verify .codex/skills was refactored with @ reference
    const codexContent = await readSkillFile(testDir, '.codex', 'codex-skill');
    assert.ok(codexContent.includes('@.agents-common/skills/codex-skill/SKILL.md'),
      'codex skill should have @ reference');

    // Verify .claude/skills WAS created with @ reference
    const claudeContent = await readSkillFile(testDir, '.claude', 'codex-skill');
    assert.ok(claudeContent.includes('@.agents-common/skills/codex-skill/SKILL.md'),
      'claude skill should have @ reference');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 6: Only .agents-common + config exist - creates assistant directories', async () => {
    const promptStub = stubInquirer({ 
      assistants: ['claude', 'codex'],
      create: true
    });

    const testDir = await createTestFixture('scenario6', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      // Create skill only in .agents-common
      await createCommonSkill(dir, 'common-skill', '---\nname: common-skill\n---\n# Common Skill\nThis is a common skill.');
    });

    await run({ baseDir: testDir });

    // Verify both platforms have @ references
    const claudeContent = await readSkillFile(testDir, '.claude', 'common-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'common-skill');

    assert.ok(claudeContent.includes('@.agents-common/skills/common-skill/SKILL.md'),
      'claude skill should have @ reference');
    assert.ok(codexContent.includes('@.agents-common/skills/common-skill/SKILL.md'),
      'codex skill should have @ reference');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 7: Skills already refactored to @, all equal - no conflict on second run', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario7', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      // Create common skill
      await createCommonSkill(dir, 'equal-skill', '---\nname: equal-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Equal Skill\nSame content');

      // Create both platform skills with @ reference and same frontmatter
      await createSkillFile(dir, '.claude', 'equal-skill', '---\nname: equal-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/equal-skill/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'equal-skill', '---\nname: equal-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/equal-skill/SKILL.md\n');
    });

    // First run - should succeed
    await run({ baseDir: testDir });

    // Second run - should also succeed without conflicts
    await run({ baseDir: testDir });

    assert.strictEqual(promptStub.callCount, 0, 'should not prompt when all skills are in sync');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 8: Skills with different non-CORE_FIELD fields - no conflict', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario8', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      // Create common skill
      await createCommonSkill(dir, 'model-skill', '---\nname: model-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Model Skill\nSame content');

      // Create platform skills with different model fields (non-CORE_FIELD)
      await createSkillFile(dir, '.claude', 'model-skill', '---\nname: model-skill\nmodel: claude-3-opus\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/model-skill/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'model-skill', '---\nname: model-skill\nmodel: gpt-4\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/model-skill/SKILL.md\n');
    });

    // Should not detect conflicts - different model fields are allowed
    await run({ baseDir: testDir });

    // Verify both platforms keep their model fields
    const claudeContent = await readSkillFile(testDir, '.claude', 'model-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'model-skill');

    assert.ok(claudeContent.includes('model: claude-3-opus'),
      'claude should keep its model field');
    assert.ok(codexContent.includes('model: gpt-4'),
      'codex should keep its model field');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 9: Body out-of-sync with @ reference - offers keep-common and abort', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-common' }  // Out-of-sync resolution
    ]);

    const testDir = await createTestFixture('scenario9', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      // Also create .codex folder to avoid prompt
      await fs.mkdir(join(dir, '.codex'), { recursive: true });

      // Create common skill
      await createCommonSkill(dir, 'body-sync-skill', '---\nname: body-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Body Sync\nOriginal content');

      // Create platform skill with wrong @ reference (body out of sync, starts with @)
      await createSkillFile(dir, '.claude', 'body-sync-skill', '---\nname: body-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/wrong-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'), 'should not offer keep-platform');

    // Verify platform was fixed with correct @ reference
    const claudeContent = await readSkillFile(testDir, '.claude', 'body-sync-skill');
    assert.ok(claudeContent.includes('@.agents-common/skills/body-sync-skill/SKILL.md'),
      'claude skill should have correct @ reference after resolution');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 10: N platforms with body out-of-sync @ - single resolution', async () => {
    // Both platforms have wrong @ references - no folder creation prompt needed
    const promptStub = stubInquirer([
      { action: 'keep-common' }
    ]);

    const testDir = await createTestFixture('scenario10', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      // Create common skill
      await createCommonSkill(dir, 'multi-sync-skill', '---\nname: multi-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Multi Sync\nOriginal content');

      // Both platforms have wrong @ references
      await createSkillFile(dir, '.claude', 'multi-sync-skill', '---\nname: multi-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/wrong1/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'multi-sync-skill', '---\nname: multi-sync-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/wrong2/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'), 'should not offer keep-platform');

    // Verify both platforms were fixed
    const claudeContent = await readSkillFile(testDir, '.claude', 'multi-sync-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'multi-sync-skill');

    assert.ok(claudeContent.includes('@.agents-common/skills/multi-sync-skill/SKILL.md'),
      'claude skill should have correct @ reference');
    assert.ok(codexContent.includes('@.agents-common/skills/multi-sync-skill/SKILL.md'),
      'codex skill should have correct @ reference');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 11: Body out-of-sync without @ - offers keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-platform' }
    ]);

    const testDir = await createTestFixture('scenario11', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      // Create .codex folder to avoid prompt
      await fs.mkdir(join(dir, '.codex'), { recursive: true });

      // Create common skill
      await createCommonSkill(dir, 'body-content-skill', '---\nname: body-content-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Body Content\nOriginal common content');

      // Platform has actual content (not @ reference) that differs
      await createSkillFile(dir, '.claude', 'body-content-skill', '---\nname: body-content-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n# Body Content\nModified platform content');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'), 'should offer keep-platform');
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');

    // Since we chose keep-platform, common should adopt platform body content
    const commonContent = await readCommonSkill(testDir, 'body-content-skill');
    assert.ok(commonContent.includes('Modified platform content'),
      'common skill should adopt platform content');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 12: N platforms with body out-of-sync (no @) - keep-common or abort', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-common' }
    ]);

    const testDir = await createTestFixture('scenario12', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      await createCommonSkill(dir, 'multi-body-skill', '---\nname: multi-body-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\n# Multi Body\nOriginal common content');

      await createSkillFile(dir, '.claude', 'multi-body-skill', '---\nname: multi-body-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nClaude content');
      await createSkillFile(dir, '.codex', 'multi-body-skill', '---\nname: multi-body-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nCodex content');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'), 'should not offer keep-platform');

    const claudeContent = await readSkillFile(testDir, '.claude', 'multi-body-skill');
    const codexContent = await readSkillFile(testDir, '.codex', 'multi-body-skill');
    assert.ok(claudeContent.includes('@.agents-common/skills/multi-body-skill/SKILL.md'),
      'claude should reference common after keep-common');
    assert.ok(codexContent.includes('@.agents-common/skills/multi-body-skill/SKILL.md'),
      'codex should reference common after keep-common');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 13: CORE_FIELD frontmatter out-of-sync - offers keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-platform' }
    ]);

    const testDir = await createTestFixture('scenario13', async (dir) => {
      await createConfig(dir, ['claude']);

      await createCommonSkill(dir, 'fm-skill', '---\nname: fm-skill\ndescription: Original description\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent');

      await createSkillFile(dir, '.claude', 'fm-skill', '---\nname: fm-skill\ndescription: Modified description\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/fm-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'), 'should offer keep-platform');
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');

    // After keep-platform, common should have platform's frontmatter
    const commonContent = await readCommonSkill(testDir, 'fm-skill');
    assert.ok(commonContent.includes('Modified description'),
      'common should have platform description after keep-platform');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 14: N platforms with CORE_FIELD frontmatter out-of-sync', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-common' }
    ]);

    const testDir = await createTestFixture('scenario14', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      await createCommonSkill(dir, 'multi-fm-skill', '---\nname: multi-fm-skill\ndescription: Original\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent');

      await createSkillFile(dir, '.claude', 'multi-fm-skill', '---\nname: multi-fm-skill\ndescription: Claude desc\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/multi-fm-skill/SKILL.md\n');
      await createSkillFile(dir, '.codex', 'multi-fm-skill', '---\nname: multi-fm-skill\ndescription: Codex desc\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/multi-fm-skill/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'), 'should not offer keep-platform');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 15: Both conflicts with @ reference - only keep-common and abort', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-common' }
    ]);

    const testDir = await createTestFixture('scenario15', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      // Create .codex folder to avoid prompt
      await fs.mkdir(join(dir, '.codex'), { recursive: true });

      await createCommonSkill(dir, 'both-at-skill', '---\nname: both-at-skill\ndescription: Original\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nOriginal content');

      // Platform has wrong @ reference AND different CORE_FIELD frontmatter
      await createSkillFile(dir, '.claude', 'both-at-skill', '---\nname: both-at-skill\ndescription: Modified\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/wrong/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
    assert.ok(!choices.some(choice => choice.value === 'keep-platform'), 'should not offer keep-platform');

    const claudeContent = await readSkillFile(testDir, '.claude', 'both-at-skill');
    assert.ok(claudeContent.includes('@.agents-common/skills/both-at-skill/SKILL.md'),
      'should have correct @ reference');
    assert.ok(claudeContent.includes('description: Original'),
      'should have common frontmatter');

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 16: Both conflicts without @ - keep-platform, keep-common, abort', async () => {
    const promptStub = stubInquirer([
      { action: 'keep-platform' }
    ]);

    const testDir = await createTestFixture('scenario16', async (dir) => {
      await createConfig(dir, ['claude']);

      await createCommonSkill(dir, 'both-content-skill', '---\nname: both-content-skill\ndescription: Original\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nOriginal content');

      // Platform has actual content (not @) AND different CORE_FIELD frontmatter
      await createSkillFile(dir, '.claude', 'both-content-skill', '---\nname: both-content-skill\ndescription: Modified\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\nPlatform content');
    });

    await run({ baseDir: testDir });

    const choices = getPromptChoices(promptStub, 'out-of-sync', 0);
    assert.ok(choices.some(choice => choice.value === 'keep-platform'), 'should offer keep-platform');
    assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
    assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');

    const commonContent = await readCommonSkill(testDir, 'both-content-skill');
    assert.ok(commonContent.includes('description: Modified'),
      'common should have platform frontmatter after keep-platform');
    assert.ok(commonContent.includes('Platform content'),
      'common should have platform body after keep-platform');

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
      // Create .codex folder to avoid prompt
      await fs.mkdir(join(dir, '.codex'), { recursive: true });

      await createCommonSkill(dir, 'skill1', '---\nname: skill1\ndescription: Original1\nmetadata:\n  sync:\n    hash: sha256-abc123\n    version: 2\n---\nContent1');
      await createCommonSkill(dir, 'skill2', '---\nname: skill2\ndescription: Original2\nmetadata:\n  sync:\n    hash: sha256-def456\n    version: 2\n---\nContent2');

      await createSkillFile(dir, '.claude', 'skill1', '---\nname: skill1\ndescription: Modified1\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@.agents-common/skills/wrong1/SKILL.md\n');
      await createSkillFile(dir, '.claude', 'skill2', '---\nname: skill2\ndescription: Modified2\nmetadata:\n  sync:\n    hash: sha256-def456\n---\n@.agents-common/skills/wrong2/SKILL.md\n');
    });

    await run({ baseDir: testDir });

    const firstChoices = getPromptChoices(promptStub, 'out-of-sync', 0);
    const secondChoices = getPromptChoices(promptStub, 'out-of-sync', 1);
    for (const choices of [firstChoices, secondChoices]) {
      assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
      assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
      assert.ok(!choices.some(choice => choice.value === 'keep-platform'), 'should not offer keep-platform');
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
      assert.ok(choices.some(choice => choice.value === 'keep-platform'), 'should offer keep-platform');
      assert.ok(choices.some(choice => choice.value === 'keep-common'), 'should offer keep-common');
      assert.ok(choices.some(choice => choice.value === 'abort'), 'should offer abort');
    }

    promptStub.restore();
    const secondPromptStub = stubInquirer({ assistants: ['claude'] });
    await run({ baseDir: testDir });
    assert.strictEqual(secondPromptStub.callCount, 0, 'second run should show no conflict');
    secondPromptStub.restore();

    await cleanupTestFixture(testDir);
  });
});
