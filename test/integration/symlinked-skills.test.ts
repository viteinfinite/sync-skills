import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, cleanupTestFixture, createConfig, exists, stubInquirer } from '../helpers/test-setup.js';

test.describe('symlinked skill handling', { concurrency: 1 }, () => {
  const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, '');
  test('ignores symlinked skills during sync and logs message', async () => {
    const promptStub = stubInquirer({ create: false });
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));

    const testDir = await createTestFixture('symlinked-sync', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.sync-skills/skills/linked-skill'), { recursive: true });
      await fs.writeFile(join(dir, '.sync-skills/skills/linked-skill/SKILL.md'), '---\nname: linked-skill\n---\n# Linked Skill\n');

      await fs.mkdir(join(dir, '.claude/skills'), { recursive: true });
      const target = join(dir, '.sync-skills/skills/linked-skill');
      await fs.symlink(target, join(dir, '.claude/skills/linked-skill'), 'dir');
    });

    try {
      await run({ baseDir: testDir });

      const output = stripAnsi(logs.join('\n'));
      assert.ok(
        output.includes('Ignored linked-skill because it was symlinked'),
        'should log ignore message for symlinked skill'
      );

      const commonSkillExists = await exists(testDir, '.sync-skills/skills/linked-skill/SKILL.md');
      assert.ok(commonSkillExists, 'should preserve existing common skill');
    } finally {
      promptStub.restore();
      console.log = originalLog;
      console.warn = originalWarn;
      await cleanupTestFixture(testDir);
    }
  });

  test('ignores symlinked skills regardless of target', async () => {
    const promptStub = stubInquirer({ create: false });
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));

    const testDir = await createTestFixture('symlinked-sync-external', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.external/skills/linked-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, '.external/skills/linked-skill/SKILL.md'),
        '---\nname: linked-skill\n---\n# Linked Skill\n'
      );

      await fs.mkdir(join(dir, '.claude/skills'), { recursive: true });
      const target = join(dir, '.external/skills/linked-skill');
      await fs.symlink(target, join(dir, '.claude/skills/linked-skill'), 'dir');
    });

    try {
      await run({ baseDir: testDir });

      const output = stripAnsi(logs.join('\n'));
      assert.ok(
        output.includes('Ignored linked-skill because it was symlinked'),
        'should log ignore message for symlinked skill'
      );

      const commonSkillExists = await exists(testDir, '.sync-skills/skills/linked-skill/SKILL.md');
      assert.ok(!commonSkillExists, 'should not create common skill for symlinked skill');
    } finally {
      promptStub.restore();
      console.log = originalLog;
      console.warn = originalWarn;
      await cleanupTestFixture(testDir);
    }
  });

  test('lists symlinked skills as unmanaged in list mode', async () => {
    const promptStub = stubInquirer({ create: false });
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = (...args: any[]) => logs.push(args.join(' '));
    console.warn = (...args: any[]) => logs.push(args.join(' '));

    const testDir = await createTestFixture('symlinked-list', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await fs.mkdir(join(dir, '.sync-skills/skills/linked-skill'), { recursive: true });
      await fs.writeFile(join(dir, '.sync-skills/skills/linked-skill/SKILL.md'), '---\nname: linked-skill\n---\n# Linked Skill\n');

      await fs.mkdir(join(dir, '.claude/skills'), { recursive: true });
      const target = join(dir, '.sync-skills/skills/linked-skill');
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
      promptStub.restore();
      console.log = originalLog;
      console.warn = originalWarn;
      await cleanupTestFixture(testDir);
    }
  });

  test('does not delete dependent files for ignored symlinked skills', async () => {
    const promptStub = stubInquirer({ create: false, outOfSyncAction: 'keep-common', action: 'use-common' });
    const testDir = await createTestFixture('symlinked-cleanup', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      await fs.mkdir(join(dir, '.sync-skills/skills/linked-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, '.sync-skills/skills/linked-skill/SKILL.md'),
        '---\nname: linked-skill\nmetadata:\n  sync:\n    version: 2\n    hash: sha256-abc123\n---\n# Linked Skill\n'
      );

      await fs.mkdir(join(dir, '.claude/skills/linked-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, '.claude/skills/linked-skill/SKILL.md'),
        '---\nname: linked-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/linked-skill/SKILL.md\n'
      );
      await fs.writeFile(join(dir, '.claude/skills/linked-skill/notes.txt'), 'claude notes');

      await fs.mkdir(join(dir, '.sync-skills/skills/linked-skill'), { recursive: true });
      await fs.writeFile(
        join(dir, '.sync-skills/skills/linked-skill/SKILL.md'),
        '---\nname: linked-skill\nmetadata:\n  sync:\n    hash: sha256-abc123\n---\n@../../../.sync-skills/skills/linked-skill/SKILL.md\n'
      );
      await fs.writeFile(join(dir, '.sync-skills/skills/linked-skill/notes.txt'), 'external notes');

      await fs.mkdir(join(dir, '.codex/skills'), { recursive: true });
      const target = join(dir, '.sync-skills/skills/linked-skill');
      await fs.symlink(target, join(dir, '.codex/skills/linked-skill'), 'dir');
    });

    try {
      await run({ baseDir: testDir });
      await run({ baseDir: testDir });

      const claudeNotesExists = await exists(testDir, '.claude/skills/linked-skill/notes.txt');
      assert.ok(!claudeNotesExists, 'should clean up dependent files for managed skills');

      const commonNotesExists = await exists(testDir, '.sync-skills/skills/linked-skill/notes.txt');
      assert.ok(commonNotesExists, 'should consolidate dependent files to common');

      const externalNotesExists = await exists(testDir, '.sync-skills/skills/linked-skill/notes.txt');
      assert.ok(externalNotesExists, 'should not delete dependent files under symlinked skills');

      const codexLinkStats = await fs.lstat(join(testDir, '.codex/skills/linked-skill'));
      assert.ok(codexLinkStats.isSymbolicLink(), 'should keep symlinked skill directory intact');
    } finally {
      promptStub.restore();
      await cleanupTestFixture(testDir);
    }
  });
});
