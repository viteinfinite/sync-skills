import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  collectDependentFilesFromPlatforms,
  consolidateDependentsToCommon,
  cleanupPlatformDependentFiles,
  getStoredHashes,
  storeFileHashesInFrontmatter
} from '../../src/dependents.js';
import { createTestFixture, cleanupTestFixture, createSkillFile, createConfig } from '../helpers/test-setup.js';

// Run tests sequentially to avoid file system conflicts
test.describe('dependent files sync', { concurrency: 1 }, () => {
  test('Scenario 1: Single platform, no common - creates common with dependent files', async () => {
    const testDir = await createTestFixture('scenario1-single-platform', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\ncontent');
      // Add dependent file
      const skillPath = join(dir, '.claude', 'skills', 'my-skill');
      await fs.writeFile(join(skillPath, 'util.js'), 'console.log("hello");');
    });

    // Collect dependent files from platforms
    const platforms = [
      { name: 'claude', path: join(testDir, '.claude', 'skills') }
    ];
    const collected = await collectDependentFilesFromPlatforms('my-skill', platforms);

    assert.strictEqual(collected.size, 1);
    assert.ok(collected.has('claude'));
    assert.strictEqual(collected.get('claude')!.length, 1);
    assert.strictEqual(collected.get('claude')![0].relativePath, 'util.js');

    // Consolidate to common
    const commonPath = join(testDir, '.agents-common', 'skills');
    const result = await consolidateDependentsToCommon('my-skill', collected, commonPath, {});

    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(result.hashes['util.js']?.startsWith('sha256-'), true);

    // Verify common file exists
    const commonUtilPath = join(commonPath, 'my-skill', 'util.js');
    const commonContent = await fs.readFile(commonUtilPath, 'utf-8');
    assert.strictEqual(commonContent, 'console.log("hello");');

    // Create SKILL.md in common (simulating main sync phase)
    const commonSkillPath = join(commonPath, 'my-skill');
    await fs.writeFile(join(commonSkillPath, 'SKILL.md'), '---\nname: my-skill\n---\ncontent');

    // Update frontmatter with hashes
    await storeFileHashesInFrontmatter(commonSkillPath, result.hashes);

    // Verify hash stored in frontmatter
    const storedHashes = await getStoredHashes(commonSkillPath);
    assert.ok(storedHashes['util.js'], 'Hash should be stored in frontmatter');

    // Cleanup platform files
    await cleanupPlatformDependentFiles(join(testDir, '.claude', 'skills'), 'my-skill', ['util.js']);

    // Verify platform file removed
    const platformUtilPath = join(testDir, '.claude', 'skills', 'my-skill', 'util.js');
    const platformUtilExists = await fs.access(platformUtilPath).then(() => true).catch(() => false);
    assert.ok(!platformUtilExists, 'Platform dependent file should be removed');

    await cleanupTestFixture(testDir);
  });

  test('Scenario 2: Multi-platform, no common - conflict resolution via hash', async () => {
    const testDir = await createTestFixture('scenario2-multi-platform', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\ncontent');
      await createSkillFile(dir, '.codex', 'my-skill', '---\nname: my-skill\n---\ncontent');

      // Add different dependent files in each platform
      const claudePath = join(dir, '.claude', 'skills', 'my-skill');
      const codexPath = join(dir, '.codex', 'skills', 'my-skill');
      await fs.writeFile(join(claudePath, 'util.js'), 'console.log("hello");');
      await fs.writeFile(join(codexPath, 'util.js'), 'console.log("goodbye");');
    });

    // Collect from both platforms
    const platforms = [
      { name: 'claude', path: join(testDir, '.claude', 'skills') },
      { name: 'codex', path: join(testDir, '.codex', 'skills') }
    ];
    const collected = await collectDependentFilesFromPlatforms('my-skill', platforms);

    assert.strictEqual(collected.size, 2);
    assert.ok(collected.has('claude'));
    assert.ok(collected.has('codex'));

    // Consolidate should detect conflict
    const commonPath = join(testDir, '.agents-common', 'skills');
    const result = await consolidateDependentsToCommon('my-skill', collected, commonPath, {});

    // Should have conflict since hashes differ
    assert.ok(result.conflicts.length > 0);
    assert.strictEqual(result.conflicts[0].relativePath, 'util.js');
    assert.ok(result.conflicts[0].platformHash);
    assert.ok(result.conflicts[0].platformHash !== result.conflicts[0].commonHash || !result.conflicts[0].commonHash);

    await cleanupTestFixture(testDir);
  });

  test('Scenario 3: Existing common + platforms - compares vs stored hash', async () => {
    const testDir = await createTestFixture('scenario3-existing-common', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      // Create common with dependent file and stored hash
      const commonPath = join(dir, '.agents-common', 'skills', 'my-skill');
      await fs.mkdir(commonPath, { recursive: true });
      await fs.writeFile(join(commonPath, 'SKILL.md'), '---\nname: my-skill\n---\ncontent');

      // Create util.js with known content
      const utilPath = join(commonPath, 'util.js');
      await fs.writeFile(utilPath, 'console.log("original");');

      // Store hash in frontmatter
      await storeFileHashesInFrontmatter(commonPath, {
        'util.js': 'sha256-stored-hash-12345'
      });

      // Create platform with modified dependent file
      await createSkillFile(dir, '.claude', 'my-skill', '---\nname: my-skill\n---\ncontent');
      const claudePath = join(dir, '.claude', 'skills', 'my-skill');
      await fs.writeFile(join(claudePath, 'util.js'), 'console.log("modified");');
    });

    // Collect from platform
    const platforms = [
      { name: 'claude', path: join(testDir, '.claude', 'skills') }
    ];
    const collected = await collectDependentFilesFromPlatforms('my-skill', platforms);

    // Get stored hashes
    const commonSkillPath = join(testDir, '.agents-common', 'skills', 'my-skill');
    const storedHashes = await getStoredHashes(commonSkillPath);
    assert.strictEqual(storedHashes['util.js'], 'sha256-stored-hash-12345');

    // Consolidate - should detect conflict since hash differs from stored
    const commonPath = join(testDir, '.agents-common', 'skills');
    const result = await consolidateDependentsToCommon('my-skill', collected, commonPath, storedHashes);

    // Should have conflict since current hash != stored hash
    assert.ok(result.conflicts.length > 0);
    assert.strictEqual(result.conflicts[0].relativePath, 'util.js');
    assert.strictEqual(result.conflicts[0].storedHash, 'sha256-stored-hash-12345');

    await cleanupTestFixture(testDir);
  });

  test('Scenario 4: Common only, both platforms - creates @ references in both', async () => {
    const testDir = await createTestFixture('scenario4-common-only', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      // Create common with dependent file
      const commonPath = join(dir, '.agents-common', 'skills', 'my-skill');
      await fs.mkdir(commonPath, { recursive: true });
      await fs.writeFile(join(commonPath, 'SKILL.md'), '---\nname: my-skill\n---\ncontent');
      await fs.writeFile(join(commonPath, 'util.js'), 'console.log("hello");');

      // Store hashes
      await storeFileHashesInFrontmatter(commonPath, {
        'util.js': 'sha256-abc123'
      });
    });

    // No dependent files on platforms - nothing to collect
    const platforms = [
      { name: 'claude', path: join(testDir, '.claude', 'skills') },
      { name: 'codex', path: join(testDir, '.codex', 'skills') }
    ];
    const collected = await collectDependentFilesFromPlatforms('my-skill', platforms);

    assert.strictEqual(collected.size, 0);

    // Consolidate with empty collection should do nothing
    const commonPath = join(testDir, '.agents-common', 'skills');
    const result = await consolidateDependentsToCommon('my-skill', collected, commonPath, {});

    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(Object.keys(result.hashes).length, 0);

    // Verify dependent file still exists in common only
    const commonUtilPath = join(commonPath, 'my-skill', 'util.js');
    const commonContent = await fs.readFile(commonUtilPath, 'utf-8');
    assert.strictEqual(commonContent, 'console.log("hello");');

    await cleanupTestFixture(testDir);
  });

  test('Scenario 5: Common only, single platform - creates @ reference in one platform', async () => {
    const testDir = await createTestFixture('scenario5-common-single', async (dir) => {
      await createConfig(dir, ['claude']); // Only claude enabled

      // Create common with dependent file
      const commonPath = join(dir, '.agents-common', 'skills', 'my-skill');
      await fs.mkdir(commonPath, { recursive: true });
      await fs.writeFile(join(commonPath, 'SKILL.md'), '---\nname: my-skill\n---\ncontent');
      await fs.writeFile(join(commonPath, 'util.js'), 'console.log("hello");');

      // Store hashes
      await storeFileHashesInFrontmatter(commonPath, {
        'util.js': 'sha256-abc123'
      });
    });

    // Only check claude platform
    const platforms = [
      { name: 'claude', path: join(testDir, '.claude', 'skills') }
    ];
    const collected = await collectDependentFilesFromPlatforms('my-skill', platforms);

    assert.strictEqual(collected.size, 0);

    // Consolidate with empty collection
    const commonPath = join(testDir, '.agents-common', 'skills');
    const result = await consolidateDependentsToCommon('my-skill', collected, commonPath, {});

    assert.strictEqual(result.conflicts.length, 0);

    // Verify dependent file exists in common
    const commonUtilPath = join(commonPath, 'my-skill', 'util.js');
    const commonContent = await fs.readFile(commonUtilPath, 'utf-8');
    assert.strictEqual(commonContent, 'console.log("hello");');

    await cleanupTestFixture(testDir);
  });

  test('Integration: Full workflow - single platform to common with cleanup', async () => {
    const testDir = await createTestFixture('integration-full-workflow', async (dir) => {
      await createConfig(dir, ['claude', 'codex']);

      // Create skill in claude with multiple dependent files
      await createSkillFile(dir, '.claude', 'complex-skill', '---\nname: complex-skill\n---\ncontent');
      const skillPath = join(dir, '.claude', 'skills', 'complex-skill');

      // Add various dependent files
      await fs.writeFile(join(skillPath, 'README.md'), '# My Skill');
      await fs.mkdir(join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(join(skillPath, 'scripts', 'util.js'), 'export function foo() {}');
      await fs.writeFile(join(skillPath, 'scripts', 'helper.js'), 'export function bar() {}');
      await fs.mkdir(join(skillPath, 'docs'), { recursive: true });
      await fs.writeFile(join(skillPath, 'docs', 'guide.md'), '# Guide');
    });

    // Collect all dependent files
    const platforms = [
      { name: 'claude', path: join(testDir, '.claude', 'skills') }
    ];
    const collected = await collectDependentFilesFromPlatforms('complex-skill', platforms);

    assert.strictEqual(collected.get('claude')!.length, 4);

    // Consolidate to common
    const commonPath = join(testDir, '.agents-common', 'skills');
    const result = await consolidateDependentsToCommon('complex-skill', collected, commonPath, {});

    assert.strictEqual(result.conflicts.length, 0);
    assert.strictEqual(Object.keys(result.hashes).length, 4);

    // Create SKILL.md in common (simulating main sync phase)
    const commonSkillPath = join(commonPath, 'complex-skill');
    await fs.writeFile(join(commonSkillPath, 'SKILL.md'), '---\nname: complex-skill\n---\ncontent');

    // Store hashes in frontmatter
    await storeFileHashesInFrontmatter(commonSkillPath, result.hashes);

    // Verify all files in common
    const commonFiles = [
      'README.md',
      'scripts/util.js',
      'scripts/helper.js',
      'docs/guide.md'
    ];

    for (const file of commonFiles) {
      const filePath = join(commonSkillPath, ...file.split('/'));
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      assert.ok(exists, `File ${file} should exist in common`);
    }

    // Cleanup platform files
    await cleanupPlatformDependentFiles(
      join(testDir, '.claude', 'skills'),
      'complex-skill',
      commonFiles
    );

    // Verify platform files removed
    for (const file of commonFiles) {
      const platformPath = join(testDir, '.claude', 'skills', 'complex-skill', ...file.split('/'));
      const exists = await fs.access(platformPath).then(() => true).catch(() => false);
      assert.ok(!exists, `File ${file} should be removed from platform`);
    }

    // Verify SKILL.md still exists in platform
    const platformSkillMd = join(testDir, '.claude', 'skills', 'complex-skill', 'SKILL.md');
    const skillMdExists = await fs.access(platformSkillMd).then(() => true).catch(() => false);
    assert.ok(skillMdExists, 'SKILL.md should remain in platform');

    // Verify empty directories cleaned up
    const scriptsPath = join(testDir, '.claude', 'skills', 'complex-skill', 'scripts');
    const scriptsExists = await fs.access(scriptsPath).then(() => true).catch(() => false);
    assert.ok(!scriptsExists, 'Empty scripts directory should be removed');

    await cleanupTestFixture(testDir);
  });
});
