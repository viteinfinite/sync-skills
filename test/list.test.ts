import { describe, it, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { run } from '../src/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { buildCommonSkillReference } from '../src/references.js';
import { createTestFixture, cleanupTestFixture } from './helpers/test-setup.js';

describe('list mode', () => {
  let logs: string[] = [];
  const originalLog = console.log;
  const originalWarn = console.warn;

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    logs = [];
  });

  it('should list installed skills with description and file count', async () => {
    const testDir = await createTestFixture('list-test', async (dir) => {
      // Create a skill in claude
      const claudeSkillDir = join(dir, '.claude/skills/skill-1');
      await fs.mkdir(claudeSkillDir, { recursive: true });
      await fs.writeFile(join(claudeSkillDir, 'SKILL.md'), '---\ndescription: Skill 1 description\n---\nBody');
      await fs.writeFile(join(claudeSkillDir, 'extra.js'), 'console.log("hi")');

      // Create a skill in common with @ reference from codex
      const commonSkillDir = join(dir, '.agents-common/skills/skill-2');
      await fs.mkdir(commonSkillDir, { recursive: true });
      await fs.writeFile(join(commonSkillDir, 'SKILL.md'), '---\ndescription: Common skill 2 description\n---\nCommon body');

      const codexSkillDir = join(dir, '.codex/skills/skill-2');
      const codexSkillPath = join(codexSkillDir, 'SKILL.md');
      await fs.mkdir(codexSkillDir, { recursive: true });
      const atReference = buildCommonSkillReference(codexSkillPath, join(commonSkillDir, 'SKILL.md'));
      await fs.writeFile(codexSkillPath, `---\n---\n${atReference}`);
    });

    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
    };

    await run({ baseDir: testDir, listMode: true });

    const output = logs.join('\n');
    
    assert.ok(output.includes('skill-1'), 'Should contain skill-1');
    assert.ok(output.includes('[claude]'), 'Should contain claude site');
    assert.ok(output.includes('Skill 1 description'), 'Should contain skill-1 description');
    assert.strictEqual(output.includes('(2 files)'), false, 'Should NOT contain file count for skill-1');

    assert.ok(output.includes('skill-2'), 'Should contain skill-2');
    assert.ok(output.includes('[common, codex]'), 'Should contain grouped sites [common, codex]');
    assert.ok(output.includes('Common skill 2 description'), 'Should contain skill-2 description from common');
    assert.strictEqual(output.includes('(1 files)'), false, 'Should NOT contain file count for skill-2');

    await cleanupTestFixture(testDir);
  });

  it('should show message when no skills found', async () => {
    const testDir = await createTestFixture('list-empty', async (dir) => {
      // Empty dir
    });

    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
    };

    await run({ baseDir: testDir, listMode: true });

    assert.ok(logs.some(l => l.includes('No skills found')), 'Should show no skills found message');

    await cleanupTestFixture(testDir);
  });
});
