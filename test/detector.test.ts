import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { detectConflicts } from '../src/detector.js';

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { detectConflicts } from '../src/detector.js';
import { createTestFixture, cleanupTestFixture } from './helpers/test-setup.js';

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
