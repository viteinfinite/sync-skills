import { test, describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { run } from '../src/index.js';
import { promises as fs } from 'fs';
import { createTestFixture, cleanupTestFixture, stubInquirer } from './helpers/test-setup.js';

describe('run', () => {
  let promptStub: ReturnType<typeof stubInquirer> | undefined;

  afterEach(() => {
    if (promptStub) {
      promptStub.restore();
      promptStub = undefined;
    }
  });

  it('should refactor skills without @ references', async () => {
    const testDir = await createTestFixture('index-integration', async (dir) => {
      await fs.mkdir(`${dir}/.claude/skills/test-skill`, { recursive: true });
      await fs.mkdir(`${dir}/.codex/skills/test-skill`, { recursive: true });

      const claudePath = `${dir}/.claude/skills/test-skill/SKILL.md`;
      await fs.writeFile(claudePath, `---
name: test-skill
---

# Test

Content`);
    });

    promptStub = stubInquirer({
      assistants: ['claude', 'codex'],
      outOfSyncAction: 'no' // For out-of-sync detection - discard platform edits
    });

    const claudePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;

    await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

    const content = await fs.readFile(claudePath, 'utf8');
    assert.ok(content.includes('@.agents-common/skills/test-skill/SKILL.md'));

    await cleanupTestFixture(testDir);
  });
});
