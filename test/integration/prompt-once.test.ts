import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, cleanupTestFixture, stubInquirer, createConfig, createCommonSkill, exists } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer> | undefined;

test.afterEach(async () => {
  if (promptStub) {
    promptStub.restore();
    promptStub = undefined;
  }
});

test('Integration: should only prompt once per assistant even with multiple source platforms', async () => {
  const testDir = await createTestFixture('prompt-once-multi-source', async (dir) => {
    // claude has skills
    await createSkillFile(dir, '.claude', 'skill-a', '---\nname: skill-a\n---\ncontent');
    // cline has skills
    await createSkillFile(dir, '.cline', 'skill-b', '---\nname: skill-b\n---\ncontent');
    
    // codex is enabled but doesn't exist
    await createConfig(dir, ['claude', 'cline', 'codex']);
    await fs.mkdir(join(dir, '.codex'), { recursive: false }).catch(() => {});
    await fs.rmdir(join(dir, '.codex')).catch(() => {}); // Ensure it really doesn't exist
  });

  // Stub inquirer:
  // 1. Confirm creation of .codex (should only happen ONCE)
  promptStub = stubInquirer({ create: true });

  await run({ baseDir: testDir });

  // If it prompted twice, Sinon stub would throw "No stub response" for the second call
  // because we only provided one response object and it wasn't an array.
  // Actually, our stubInquirer helper reuses the last response if it's an array,
  // but if we want to be sure it's called once, we can check callCount.
  
  assert.strictEqual(promptStub.callCount, 1, 'Should only prompt once for .codex creation');
  
  assert.ok(await exists(testDir, '.codex/skills/skill-a/SKILL.md'), 'skill-a should be synced');
  assert.ok(await exists(testDir, '.codex/skills/skill-b/SKILL.md'), 'skill-b should be synced');

  await cleanupTestFixture(testDir);
});

test('Integration: should only prompt once per assistant for multiple common-only skills', async () => {
  const testDir = await createTestFixture('prompt-once-common-only', async (dir) => {
    // Multiple skills only in common
    await createCommonSkill(dir, 'common-1', '---\nname: common-1\n---\ncontent');
    await createCommonSkill(dir, 'common-2', '---\nname: common-2\n---\ncontent');
    
    // claude is enabled but doesn't exist
    await createConfig(dir, ['claude']);
  });

  // Stub inquirer:
  // 1. Confirm creation of .claude (should only happen ONCE)
  promptStub = stubInquirer({ create: true });

  await run({ baseDir: testDir });

  assert.strictEqual(promptStub.callCount, 1, 'Should only prompt once for .claude creation');
  
  assert.ok(await exists(testDir, '.claude/skills/common-1/SKILL.md'), 'common-1 should be synced');
  assert.ok(await exists(testDir, '.claude/skills/common-2/SKILL.md'), 'common-2 should be synced');

  await cleanupTestFixture(testDir);
});
