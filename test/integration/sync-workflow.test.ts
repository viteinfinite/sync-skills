import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, readSkillFile, cleanupTestFixture, stubInquirer } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer>;

test.beforeEach(() => {
  promptStub = stubInquirer({ action: 'keep-both' });
});

test.afterEach(() => {
  promptStub.restore();
});

test('Integration: Full Sync Workflow - should refactor skills to .agents-common', async () => {
  const testDir = await createTestFixture('sync-full', async (dir) => {
    // Create skills in both assistants
    await createSkillFile(dir, '.claude', 'my-skill', `---
name: my-skill
description: A test skill
---

# My Skill

Claude version`);
    await createSkillFile(dir, '.codex', 'my-skill', `---
name: my-skill
description: A test skill
---

# My Skill

Codex version`);
  });

  await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

  // Verify .claude skill was refactored
  const claudeContent = await readSkillFile(testDir, '.claude', 'my-skill');
  assert.ok(claudeContent.includes('@.agents-common/skills/my-skill/SKILL.md'));
  assert.ok(claudeContent.includes('metadata:'));
  assert.ok(claudeContent.includes('sync:'));

  // Verify .codex skill was refactored
  const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
  assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));
  assert.ok(codexContent.includes('metadata:'));
  assert.ok(codexContent.includes('sync:'));

  // Verify common skill exists with frontmatter
  const commonContent = await fs.readFile(join(testDir, '.agents-common/skills/my-skill/SKILL.md'), 'utf8');
  assert.ok(commonContent.includes('---'));
  assert.ok(commonContent.includes('name: my-skill'));

  await cleanupTestFixture(testDir);
});

test('Integration: Sync - should detect conflicts between skills', async () => {
  const testDir = await createTestFixture('sync-conflict', async (dir) => {
    await createSkillFile(dir, '.claude', 'conflicting-skill', `---
name: conflicting-skill
description: A conflicting skill
---

Claude content`);
    await createSkillFile(dir, '.codex', 'conflicting-skill', `---
name: conflicting-skill
description: A conflicting skill
---

Codex content`);
  });

  // Run with conflict detection
  await run({ baseDir: testDir, failOnConflict: false });

  // Verify conflict was handled
  const claudeContent = await readSkillFile(testDir, '.claude', 'conflicting-skill');
  assert.ok(claudeContent.includes('@.agents-common'));

  await cleanupTestFixture(testDir);
});

test('Integration: Frontmatter field order - should not treat different field order as conflict', async () => {
  const testDir = await createTestFixture('field-order-test', async (dir) => {
    // Same content and fields, but different field order
    await createSkillFile(dir, '.claude', 'order-skill', `---
name: order-skill
description: Test field order
tags: test, sync
---

Same content`);
    await createSkillFile(dir, '.codex', 'order-skill', `---
tags: test, sync
name: order-skill
description: Test field order
---

Same content`);
  });

  // Run sync - should not detect conflict
  await run({ baseDir: testDir, failOnConflict: true });

  // Verify both were refactored successfully
  const claudeContent = await readSkillFile(testDir, '.claude', 'order-skill');
  const codexContent = await readSkillFile(testDir, '.codex', 'order-skill');

  // Both should now reference the common skill
  assert.ok(claudeContent.includes('@.agents-common/skills/order-skill/SKILL.md'));
  assert.ok(codexContent.includes('@.agents-common/skills/order-skill/SKILL.md'));

  // Common skill should exist
  const commonContent = await fs.readFile(join(testDir, '.agents-common/skills/order-skill/SKILL.md'), 'utf8');
  assert.ok(commonContent.includes('name: order-skill'));
  assert.ok(commonContent.includes('Same content'));

  await cleanupTestFixture(testDir);
});
