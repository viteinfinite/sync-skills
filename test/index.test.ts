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
      outOfSyncAction: 'use-common' // For out-of-sync detection - discard platform edits
    });

    const claudePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;

    await run({ baseDir: testDir, failOnConflict: false });

    const content = await fs.readFile(claudePath, 'utf8');
    assert.ok(content.includes('@../../../.agents-common/skills/test-skill/SKILL.md'));

    await cleanupTestFixture(testDir);
  });

  it('should fail on out-of-sync skills in non-interactive mode', async () => {
    const testDir = await createTestFixture('index-out-of-sync', async (dir) => {
      await fs.mkdir(`${dir}/.agents-common/skills/test-skill`, { recursive: true });
      await fs.writeFile(`${dir}/.agents-common/skills/test-skill/SKILL.md`, `---
name: test-skill
description: Original description
metadata:
  sync:
    version: 2
    hash: sha256-0aa1d1e50634a32c6f583b64c2bdf4b827c0ff0f820c1f1fb5f06cc0b4df6a99
---

Original content`);

      await fs.mkdir(`${dir}/.agents-common`, { recursive: true });
      await fs.writeFile(`${dir}/.agents-common/config.json`, JSON.stringify({
        version: 1,
        assistants: ['claude']
      }, null, 2));

      await fs.mkdir(`${dir}/.claude/skills/test-skill`, { recursive: true });
      await fs.writeFile(`${dir}/.claude/skills/test-skill/SKILL.md`, `---
name: test-skill
description: Original description
metadata:
  sync:
    hash: sha256-0aa1d1e50634a32c6f583b64c2bdf4b827c0ff0f820c1f1fb5f06cc0b4df6a99
---

Modified content`);
    });

    await assert.rejects(
      () => run({ baseDir: testDir, failOnConflict: true }),
      /Out-of-sync skills detected: test-skill/
    );

    await cleanupTestFixture(testDir);
  });
});
