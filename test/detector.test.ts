import { describe, it, beforeEach, afterEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { detectConflicts } from '../src/detector.js';

const TEST_DIR = 'test/fixtures/detector-sync';

describe('detectConflicts sync metadata', () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(join(TEST_DIR, '.claude/skills/test-skill'), { recursive: true });
    await fs.mkdir(join(TEST_DIR, '.codex/skills/test-skill'), { recursive: true });

    await fs.writeFile(
      join(TEST_DIR, '.claude/skills/test-skill/SKILL.md'),
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
      join(TEST_DIR, '.codex/skills/test-skill/SKILL.md'),
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

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('ignores tool-managed sync metadata differences', async () => {
    const claudeSkills = [{ skillName: 'test-skill', path: join(TEST_DIR, '.claude/skills/test-skill/SKILL.md') }];
    const codexSkills = [{ skillName: 'test-skill', path: join(TEST_DIR, '.codex/skills/test-skill/SKILL.md') }];

    const conflicts = await detectConflicts(claudeSkills, codexSkills);

    assert.strictEqual(conflicts.length, 0);
  });
});
