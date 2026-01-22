import { test } from 'node:test';
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { refactorSkill, computeSkillHash } from '../src/syncer.js';
import { buildCommonSkillReference } from '../src/references.js';

describe('refactorSkill', () => {
  const testDir = './test/fixtures/refactor';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.agents-common/skills/test-skill`, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should extract body to .agents-common and replace with @ reference', async () => {
    const sourcePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    await fs.writeFile(sourcePath, `---
name: test-skill
description: Test skill
---

# Content

This is content`);

    await refactorSkill(sourcePath);

    const sourceContent = await fs.readFile(sourcePath, 'utf8');
    const commonPath = `${testDir}/.agents-common/skills/test-skill/SKILL.md`;
    const commonContent = await fs.readFile(commonPath, 'utf8');
    const expectedRef = buildCommonSkillReference(sourcePath, commonPath);

    // Platform file now has @ reference and sync metadata under metadata.sync
    assert.ok(sourceContent.includes(expectedRef));
    assert.ok(sourceContent.includes('metadata:'));
    assert.ok(sourceContent.includes('sync:'));
    assert.ok(sourceContent.includes('hash:'));

    // Common file contains frontmatter + body with sync metadata
    assert.ok(commonContent.includes('name: test-skill'));
    assert.ok(commonContent.includes('description: Test skill'));
    assert.ok(commonContent.includes('version: 2'));
    assert.ok(commonContent.includes('# Content'));
    assert.ok(commonContent.includes('This is content'));
  });

  it('should not refactor if @ reference already exists', async () => {
    const sourcePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    const commonPath = `${testDir}/.agents-common/skills/test-skill/SKILL.md`;
    const atReference = buildCommonSkillReference(sourcePath, commonPath);
    await fs.writeFile(sourcePath, `---
name: test-skill
---

${atReference}`);

    await fs.writeFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'original');

    await refactorSkill(sourcePath);

    const commonContent = await fs.readFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'utf8');
    assert.strictEqual(commonContent, 'original'); // Should not overwrite
  });
});

describe('computeSkillHash', () => {
  it('should compute consistent hash for same input', () => {
    const frontmatter = { name: 'test', description: 'desc' };
    const body = 'skill content';
    const dependents: Array<{ path: string; hash: string }> = [];

    const hash1 = computeSkillHash(frontmatter, body, dependents);
    const hash2 = computeSkillHash(frontmatter, body, dependents);

    assert.strictEqual(hash1, hash2);
    assert.match(hash1, /^sha256-[a-f0-9]{64}$/);
  });

  it('should produce different hashes for different content', () => {
    const frontmatter1 = { name: 'test', description: 'desc' };
    const frontmatter2 = { name: 'test', description: 'different' };
    const body = 'skill content';

    const hash1 = computeSkillHash(frontmatter1, body, []);
    const hash2 = computeSkillHash(frontmatter2, body, []);

    assert.notStrictEqual(hash1, hash2);
  });

  it('should include dependent files in hash', () => {
    const frontmatter = { name: 'test' };
    const body = 'content';
    const dependents1: Array<{ path: string; hash: string }> = [];
    const dependents2: Array<{ path: string; hash: string }> = [{ path: 'utils.ts', hash: 'sha256-abc123' }];

    const hash1 = computeSkillHash(frontmatter, body, dependents1);
    const hash2 = computeSkillHash(frontmatter, body, dependents2);

    assert.notStrictEqual(hash1, hash2);
  });

  it('should handle unsorted object keys deterministically', () => {
    const frontmatter1 = { b: 1, a: 2 };
    const frontmatter2 = { a: 2, b: 1 };
    const body = 'content';

    const hash1 = computeSkillHash(frontmatter1, body, []);
    const hash2 = computeSkillHash(frontmatter2, body, []);

    assert.strictEqual(hash1, hash2);
  });
});
