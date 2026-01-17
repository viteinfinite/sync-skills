import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, cleanupTestFixture, stubInquirer } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer> | undefined;

test.afterEach(async () => {
  if (promptStub) {
    promptStub.restore();
    promptStub = undefined;
  }
});

test('Integration: Auto-configuration - should prompt and create config when folders exist', async () => {
  const testDir = await createTestFixture('auto-config-folders-exist', async (dir) => {
    // Create .claude folder with skills
    await createSkillFile(dir, '.claude', 'test-skill', '@test');
  });

  promptStub = stubInquirer({ assistants: ['claude'] });

  // Import after setup to ensure fresh module
  const { run } = await import('../../src/index.js');

  // Run sync (should prompt and create config)
  await run({ baseDir: testDir });

  // Check config was created
  const { readConfig } = await import('../../src/config.js');
  const config = await readConfig(testDir);

  assert.ok(config);
  assert.deepEqual(config?.assistants, ['claude']);

  await cleanupTestFixture(testDir);
});

test('Integration: Auto-configuration - should prompt when no folders exist', async () => {
  // Create empty directory
  const testDir = await createTestFixture('auto-config-no-folders');

  // Stub inquirer to select claude
  promptStub = stubInquirer({ assistants: ['claude'] });

  // This should prompt and create config
  try {
    await run({ baseDir: testDir });
  } catch (e) {
    // May exit if no config
  }

  const { readConfig } = await import('../../src/config.js');
  const config = await readConfig(testDir);

  assert.ok(config);
  assert.deepEqual(config?.assistants, ['claude']);

  await cleanupTestFixture(testDir);
});
