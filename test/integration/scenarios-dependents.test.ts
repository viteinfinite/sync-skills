import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import {
  createTestFixture,
  createSkillFile,
  createCommonSkill,
  cleanupTestFixture,
  stubInquirer,
  createConfig
} from '../helpers/test-setup.js';

test.describe('scenarios dependents', { concurrency: 1 }, () => {
  test('Scenario 9: Dependent file mismatch triggers conflict', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario9', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'dep-skill', '---\nname: dep-skill\n---\nCommon content\n');
      await fs.writeFile(join(dir, '.sync-skills/skills/dep-skill/util.js'), 'console.log("common");');

      await createSkillFile(
        dir,
        '.claude',
        'dep-skill',
        '---\nname: dep-skill\n---\n@../../../.sync-skills/skills/dep-skill/SKILL.md\n'
      );
      await createSkillFile(
        dir,
        '.codex',
        'dep-skill',
        '---\nname: dep-skill\n---\n@../../../.sync-skills/skills/dep-skill/SKILL.md\n'
      );

      await fs.writeFile(join(dir, '.claude/skills/dep-skill/extra.js'), 'console.log("extra");');
    });

    await assert.rejects(
      run({ baseDir: testDir, failOnConflict: true }),
      /Out-of-sync skills detected: dep-skill/
    );

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });

  test('Scenario 10: Identical SKILL.md and dependents produce no conflict', async () => {
    const promptStub = stubInquirer({ assistants: ['claude', 'codex'] });

    const testDir = await createTestFixture('scenario10', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createCommonSkill(dir, 'clean-skill', '---\nname: clean-skill\n---\nCommon content\n');
      await fs.writeFile(join(dir, '.sync-skills/skills/clean-skill/util.js'), 'console.log("common");');

      await createSkillFile(
        dir,
        '.claude',
        'clean-skill',
        '---\nname: clean-skill\n---\n@../../../.sync-skills/skills/clean-skill/SKILL.md\n'
      );
      await createSkillFile(
        dir,
        '.codex',
        'clean-skill',
        '---\nname: clean-skill\n---\n@../../../.sync-skills/skills/clean-skill/SKILL.md\n'
      );
    });

    await run({ baseDir: testDir, failOnConflict: true });

    assert.strictEqual(promptStub.callCount, 0);

    promptStub.restore();
    await cleanupTestFixture(testDir);
  });
});
