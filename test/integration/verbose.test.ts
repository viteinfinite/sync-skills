import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { run } from '../../src/index.js';
import { createConfig, createTestFixture, cleanupTestFixture, stubInquirer } from '../helpers/test-setup.js';

describe('verbose mode', () => {
  it('logs SKILL.md operations in verbose mode', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    const promptStub = stubInquirer({ assistants: ['claude'] });
    const testDir = await createTestFixture('verbose-mode', async (dir) => {
      await createConfig(dir, ['claude']);
      await fs.mkdir(`${dir}/.claude/skills/test-skill`, { recursive: true });
      await fs.writeFile(
        `${dir}/.claude/skills/test-skill/SKILL.md`,
        '---\nname: test-skill\n---\nSkill content\n'
      );
    });

    try {
      await run({ baseDir: testDir, verbose: true });
    } finally {
      promptStub.restore();
      console.log = originalLog;
      await cleanupTestFixture(testDir);
    }

    assert.ok(logs.some(line => line.includes('[verbose]')));
    assert.ok(logs.some(line => line.includes('reason=refactor-to-common')));
    assert.ok(logs.some(line => line.includes('reason=replace-platform-with-reference')));
    assert.ok(logs.some(line => line.includes('[verbose-summary] SKILL.md operations')));
  });

  it('does not print verbose events by default', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    const promptStub = stubInquirer({ assistants: ['claude'] });
    const testDir = await createTestFixture('non-verbose-mode', async (dir) => {
      await createConfig(dir, ['claude']);
      await fs.mkdir(`${dir}/.claude/skills/test-skill`, { recursive: true });
      await fs.writeFile(
        `${dir}/.claude/skills/test-skill/SKILL.md`,
        '---\nname: test-skill\n---\nSkill content\n'
      );
    });

    try {
      await run({ baseDir: testDir });
    } finally {
      promptStub.restore();
      console.log = originalLog;
      await cleanupTestFixture(testDir);
    }

    assert.ok(!logs.some(line => line.includes('[verbose]')));
    assert.ok(!logs.some(line => line.includes('[verbose-summary]')));
  });
});

