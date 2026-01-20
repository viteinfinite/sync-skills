import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, cleanupTestFixture, stubInquirer, exists } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer> | undefined;

test.afterEach(async () => {
  if (promptStub) {
    promptStub.restore();
    promptStub = undefined;
  }
});

test('Integration: --reconfigure - should update config and then continue to sync', async () => {
  const testDir = await createTestFixture('reconfigure-sync-test', async (dir) => {
    // 1. Create .claude folder with a skill (not refactored)
    await createSkillFile(dir, '.claude', 'test-skill', '---\nname: test-skill\n---\n\ntest content');
  });

  // Stub inquirer for:
  // 1. Reconfigure: select 'claude'
  promptStub = stubInquirer({ 
    assistants: ['claude'] 
  });

  // Run with reconfigure flag
  await run({ baseDir: testDir, reconfigure: true });

  // Verify config exists
  const configCreated = await exists(testDir, '.agents-common/config.json');
  assert.ok(configCreated, 'Config should be created');

  // Verify sync happened: skill should be refactored to .agents-common
  const commonExists = await exists(testDir, '.agents-common/skills/test-skill/SKILL.md');
  assert.ok(commonExists, 'Skill should be refactored to common (sync phase continued)');

  await cleanupTestFixture(testDir);
});