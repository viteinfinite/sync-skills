import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, cleanupTestFixture, createConfig, exists } from '../helpers/test-setup.js';

test.describe('symlinked skill handling', { concurrency: 1 }, () => {
  const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, '');
  test('ignores symlinked skills during sync and logs message', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));

    const testDir = await createTestFixture('symlinked-sync', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.agents/skills/linked-skill'), { recursive: true });
      await fs.writeFile(join(dir, '.agents/skills/linked-skill/SKILL.md'), '---\nname: linked-skill\n---\n# Linked Skill\n');

      await fs.mkdir(join(dir, '.claude/skills'), { recursive: true });
      const target = join(dir, '.agents/skills/linked-skill');
      await fs.symlink(target, join(dir, '.claude/skills/linked-skill'), 'dir');
    });

    try {
      await run({ baseDir: testDir });

      const output = stripAnsi(logs.join('\n'));
      assert.ok(
        output.includes('Ignored linked-skill because it was symlinked'),
        'should log ignore message for symlinked skill'
      );

      const commonSkillExists = await exists(testDir, '.agents-common/skills/linked-skill/SKILL.md');
      assert.ok(!commonSkillExists, 'should not create common skill for symlinked skill');
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      await cleanupTestFixture(testDir);
    }
  });

  test('lists symlinked skills as unmanaged in list mode', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));

    const testDir = await createTestFixture('symlinked-list', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.agents/skills/linked-skill'), { recursive: true });
      await fs.writeFile(join(dir, '.agents/skills/linked-skill/SKILL.md'), '---\nname: linked-skill\n---\n# Linked Skill\n');

      await fs.mkdir(join(dir, '.claude/skills'), { recursive: true });
      const target = join(dir, '.agents/skills/linked-skill');
      await fs.symlink(target, join(dir, '.claude/skills/linked-skill'), 'dir');
    });

    try {
      await run({ baseDir: testDir, listMode: true });

      const output = stripAnsi(logs.join('\n'));
      assert.ok(
        output.includes('Ignored linked-skill because it was symlinked'),
        'should log ignore message in list mode'
      );
      assert.ok(output.includes('linked-skill'), 'should list symlinked skill');
      assert.ok(output.includes('(unmanaged)'), 'should mark symlinked skill as unmanaged');
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      await cleanupTestFixture(testDir);
    }
  });
});
