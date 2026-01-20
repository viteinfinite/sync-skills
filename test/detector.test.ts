import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { detectConflicts, detectOutOfSyncSkills } from '../src/detector.js';
import { createTestFixture, cleanupTestFixture } from './helpers/test-setup.js';
import type { OutOfSyncSkill } from '../src/types.js';

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
    it('detects body mismatch when platform has different content than common', async () => {
      const TEST_DIR = await createTestFixture('out-of-sync-body', async (dir) => {
        // Create common skill
        await fs.mkdir(join(dir, '.agents-common/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.agents-common/skills/test-skill/SKILL.md'),
          `---
name: test-skill
metadata:
  sync:
    hash: sha256-abc123
    version: 2
---
Common content
`
        );

        // Create platform skill with different content
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
metadata:
  sync:
    hash: sha256-abc123
---
Modified content
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.agents-common/skills/test-skill/SKILL.md')
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 1);
      assert.strictEqual(outOfSync[0].skillName, 'test-skill');
      assert.strictEqual(outOfSync[0].platform, 'claude');
      assert.strictEqual(outOfSync[0].mismatchType, 'body');

      await cleanupTestFixture(TEST_DIR);
    });

    it('detects frontmatter mismatch when platform has different metadata', async () => {
      const TEST_DIR = await createTestFixture('out-of-sync-frontmatter', async (dir) => {
        // Create common skill
        await fs.mkdir(join(dir, '.agents-common/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.agents-common/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Original description
metadata:
  sync:
    hash: sha256-abc123
    version: 2
---
Common content
`
        );

        // Create platform skill with @ reference but different frontmatter
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Modified description
metadata:
  sync:
    hash: sha256-abc123
---
@.agents-common/skills/test-skill/SKILL.md
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.agents-common/skills/test-skill/SKILL.md')
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 1);
      assert.strictEqual(outOfSync[0].skillName, 'test-skill');
      assert.strictEqual(outOfSync[0].platform, 'claude');
      assert.strictEqual(outOfSync[0].mismatchType, 'frontmatter');

      await cleanupTestFixture(TEST_DIR);
    });

    it('detects frontmatter mismatch when platform has different metadata with @ reference', async () => {
      const TEST_DIR = await createTestFixture('out-of-sync-both', async (dir) => {
        // Create common skill
        await fs.mkdir(join(dir, '.agents-common/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.agents-common/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Original description
metadata:
  sync:
    hash: sha256-abc123
    version: 2
---
Common content
`
        );

        // Create platform skill with different frontmatter and correct @ reference
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Modified description
metadata:
  sync:
    hash: sha256-abc123
---
@.agents-common/skills/test-skill/SKILL.md
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.agents-common/skills/test-skill/SKILL.md')
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 1);
      assert.strictEqual(outOfSync[0].skillName, 'test-skill');
      assert.strictEqual(outOfSync[0].platform, 'claude');
      // With correct @ reference, only frontmatter is mismatched
      assert.strictEqual(outOfSync[0].mismatchType, 'frontmatter');

      await cleanupTestFixture(TEST_DIR);
    });

    it('detects both mismatch when platform has wrong @ reference and different frontmatter', async () => {
      const TEST_DIR = await createTestFixture('out-of-sync-both', async (dir) => {
        // Create common skill
        await fs.mkdir(join(dir, '.agents-common/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.agents-common/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Original description
metadata:
  sync:
    hash: sha256-abc123
    version: 2
---
Common content
`
        );

        // Create platform skill with wrong @ reference and different frontmatter
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Modified description
metadata:
  sync:
    hash: sha256-abc123
---
@.agents-common/skills/other-skill/SKILL.md
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.agents-common/skills/test-skill/SKILL.md')
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 1);
      assert.strictEqual(outOfSync[0].skillName, 'test-skill');
      assert.strictEqual(outOfSync[0].platform, 'claude');
      // Both wrong reference and different frontmatter
      assert.strictEqual(outOfSync[0].mismatchType, 'both');

      await cleanupTestFixture(TEST_DIR);
    });

    it('returns empty array when platform and common are in sync', async () => {
      const TEST_DIR = await createTestFixture('in-sync', async (dir) => {
        // Create common skill
        await fs.mkdir(join(dir, '.agents-common/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.agents-common/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Same description
metadata:
  sync:
    hash: sha256-abc123
    version: 2
---
Common content
`
        );

        // Create platform skill with matching frontmatter and @ reference
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
description: Same description
metadata:
  sync:
    hash: sha256-abc123
---
@.agents-common/skills/test-skill/SKILL.md
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.agents-common/skills/test-skill/SKILL.md')
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 0);

      await cleanupTestFixture(TEST_DIR);
    });

    it('skips when common skill has no hash', async () => {
      const TEST_DIR = await createTestFixture('no-common-hash', async (dir) => {
        // Create common skill without hash
        await fs.mkdir(join(dir, '.agents-common/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.agents-common/skills/test-skill/SKILL.md'),
          `---
name: test-skill
---
Common content
`
        );

        // Create platform skill with different content
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
---
Modified content
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.agents-common/skills/test-skill/SKILL.md')
      }];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 0, 'Should skip when common has no hash');

      await cleanupTestFixture(TEST_DIR);
    });

    it('skips when common skill does not exist', async () => {
      const TEST_DIR = await createTestFixture('no-common', async (dir) => {
        // Create platform skill without corresponding common skill
        await fs.mkdir(join(dir, '.claude/skills/test-skill'), { recursive: true });
        await fs.writeFile(
          join(dir, '.claude/skills/test-skill/SKILL.md'),
          `---
name: test-skill
---
Platform content
`
        );
      });

      const platformSkills = [{
        skillName: 'test-skill',
        path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md')
      }];

      const commonSkills: Array<{ skillName: string; path: string }> = [];

      const outOfSync = await detectOutOfSyncSkills(platformSkills, commonSkills, 'claude');

      assert.strictEqual(outOfSync.length, 0, 'Should skip when common skill does not exist');

      await cleanupTestFixture(TEST_DIR);
    });
  });
});