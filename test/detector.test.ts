import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { detectConflicts, detectOutOfSyncSkills } from '../src/detector.js';
import { createTestFixture, cleanupTestFixture } from './helpers/test-setup.js';

describe('detector', () => {
  describe('detectConflicts sync metadata', () => {
    it('ignores tool-managed sync metadata differences', async () => {
      const TEST_DIR = await createTestFixture('detector-sync', async (dir) => {
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.mkdir(join(dir, '.codex/skills/test-skill'), { recursive: true });

        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
metadata:
  sync:
    hash: sha256-aaa
    managed-by: sync-skills
---
@.agents-common/skills/test-skill/SKILL.md
`
        );

        await fs.writeFile(
          join(dir, '.codex/skills/test-skill/SKILL.md'),
          `---
name: test-skill
metadata:
  sync:
    hash: sha256-bbb
    managed-by: sync-skills
---
@.agents-common/skills/test-skill/SKILL.md
`
        );
      });

      const claudeSkills = [{ skillName: 'test-skill', path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md') }];
      const codexSkills = [{ skillName: 'test-skill', path: join(TEST_DIR, '.codex/skills/test-skill/SKILL.md') }];

      const conflicts = await detectConflicts(claudeSkills, codexSkills);

      assert.strictEqual(conflicts.length, 0);

      await cleanupTestFixture(TEST_DIR);
    });
  });

  describe('detectOutOfSyncSkills', () => {
    it('detects when a skill has been modified outside of sync-skills', async () => {
      const TEST_DIR = await createTestFixture('out-of-sync', async (dir) => {
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        
        // This hash is for body "Original content" and name "test-skill"
        const storedHash = 'sha256-4e383f59048386f53e34b7264855898d57574712066d9361732e700a08c0f543';

        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
metadata:
  sync:
    hash: ${storedHash}
---
Modified content
`
        );
      });

      const platformSkills = [{ 
        skillName: 'test-skill', 
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md') 
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills);

      assert.strictEqual(outOfSync.length, 1);
      assert.strictEqual(outOfSync[0].skillName, 'test-skill');
      assert.strictEqual(outOfSync[0].platform, 'claude');

      await cleanupTestFixture(TEST_DIR);
    });

    it('skips reference files (starting with @)', async () => {
      const TEST_DIR = await createTestFixture('out-of-sync-ref', async (dir) => {
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        
        // Even if hash doesn't match the "@..." content, it should be skipped
        const storedHash = 'sha256-wrong';

        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
metadata:
  sync:
    hash: ${storedHash}
---
@.agents-common/skills/test-skill/SKILL.md
`
        );
      });

      const platformSkills = [{ 
        skillName: 'test-skill', 
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md') 
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills);

      assert.strictEqual(outOfSync.length, 0, 'Reference files should be skipped');

      await cleanupTestFixture(TEST_DIR);
    });
  });
});