import { test } from 'node:test';
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  computeFileHash,
  hashMatches,
  hashChanged,
  detectDependentFiles,
  getStoredHashes,
  storeFileHashesInFrontmatter,
  consolidateDependentsToCommon,
  cleanupPlatformDependentFiles
} from '../src/dependents.js';

const TEST_DIR = 'test/fixtures/dependents-test';

describe('dependents', () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('computeFileHash', () => {
    it('should return consistent hash for same content', async () => {
      const testFile = join(TEST_DIR, 'test.txt');
      await fs.writeFile(testFile, 'hello world');

      const hash1 = await computeFileHash(testFile);
      const hash2 = await computeFileHash(testFile);

      assert.strictEqual(hash1, hash2);
      assert.ok(hash1.startsWith('sha256-'));
    });

    it('should return different hashes for different content', async () => {
      const file1 = join(TEST_DIR, 'file1.txt');
      const file2 = join(TEST_DIR, 'file2.txt');

      await fs.writeFile(file1, 'content 1');
      await fs.writeFile(file2, 'content 2');

      const hash1 = await computeFileHash(file1);
      const hash2 = await computeFileHash(file2);

      assert.notStrictEqual(hash1, hash2);
    });

    it('should handle empty files', async () => {
      const testFile = join(TEST_DIR, 'empty.txt');
      await fs.writeFile(testFile, '');

      const hash = await computeFileHash(testFile);

      assert.ok(hash.startsWith('sha256-'));
      assert.ok(hash.length > 8);
    });
  });

  describe('hashMatches', () => {
    it('should return true for matching hashes', () => {
      assert.ok(hashMatches('sha256-abc123', 'sha256-abc123'));
      assert.ok(hashMatches('abc123', 'sha256-abc123'));
      assert.ok(hashMatches('sha256-abc123', 'abc123'));
    });

    it('should return false for different hashes', () => {
      assert.ok(!hashMatches('sha256-abc123', 'sha256-def456'));
      assert.ok(!hashMatches('abc123', 'def456'));
    });
  });

  describe('hashChanged', () => {
    it('should return true when stored hash is undefined', () => {
      assert.ok(hashChanged('sha256-abc123', undefined));
    });

    it('should return true when hashes differ', () => {
      assert.ok(hashChanged('sha256-abc123', 'sha256-def456'));
    });

    it('should return false when hashes match', () => {
      assert.ok(!hashChanged('sha256-abc123', 'sha256-abc123'));
      assert.ok(!hashChanged('abc123', 'sha256-abc123'));
    });
  });

  describe('detectDependentFiles', () => {
    it('should return empty array for folder with only SKILL.md', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');

      const result = await detectDependentFiles(skillPath);

      assert.strictEqual(result.length, 0);
    });

    it('should return single file', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');
      await fs.writeFile(join(skillPath, 'util.js'), 'console.log("hello");');

      const result = await detectDependentFiles(skillPath);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'util.js');
      assert.ok(result[0].hash.startsWith('sha256-'));
    });

    it('should return nested files', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');
      await fs.mkdir(join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(join(skillPath, 'scripts', 'util.js'), 'export function foo() {}');

      const result = await detectDependentFiles(skillPath);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'scripts' + '/' + 'util.js'); // Use forward slash for cross-platform
    });

    it('should ignore node_modules', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');
      await fs.mkdir(join(skillPath, 'node_modules', 'test'), { recursive: true });
      await fs.writeFile(join(skillPath, 'node_modules', 'test', 'index.js'), 'module.exports = {};');

      const result = await detectDependentFiles(skillPath);

      assert.strictEqual(result.length, 0);
    });

    it('should return multiple files at different levels', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');
      await fs.writeFile(join(skillPath, 'README.md'), '# readme');
      await fs.mkdir(join(skillPath, 'docs'), { recursive: true });
      await fs.writeFile(join(skillPath, 'docs', 'guide.md'), '# guide');
      await fs.mkdir(join(skillPath, 'scripts'), { recursive: true });
      await fs.writeFile(join(skillPath, 'scripts', 'util.js'), 'console.log("hello");');

      const result = await detectDependentFiles(skillPath);

      assert.strictEqual(result.length, 3);
      const paths = result.map(f => f.relativePath).sort();
      assert.ok(paths.includes('README.md'));
      assert.ok(paths.includes('docs' + '/' + 'guide.md') || paths.includes('docs\\guide.md'));
      assert.ok(paths.includes('scripts' + '/' + 'util.js') || paths.includes('scripts\\util.js'));
    });
  });

  describe('getStoredHashes', () => {
    it('should return empty object when SKILL.md does not exist', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });

      const result = await getStoredHashes(skillPath);

      assert.deepStrictEqual(result, {});
    });

    it('should return empty object when no sync metadata exists', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        join(skillPath, 'SKILL.md'),
        '---\nname: test\n---\ncontent'
      );

      const result = await getStoredHashes(skillPath);

      assert.deepStrictEqual(result, {});
    });

    it('should return stored hashes from frontmatter', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        join(skillPath, 'SKILL.md'),
        '---\nname: test\nmetadata:\n  sync:\n    version: 1\n    files:\n      util.js: sha256-abc123\n---\ncontent'
      );

      const result = await getStoredHashes(skillPath);

      assert.deepStrictEqual(result, { 'util.js': 'sha256-abc123' });
    });
  });

  describe('storeFileHashesInFrontmatter', () => {
    it('should add sync metadata to existing frontmatter', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        join(skillPath, 'SKILL.md'),
        '---\nname: test\n---\ncontent'
      );

      const hashes = { 'util.js': 'sha256-abc123', 'config.json': 'sha256-def456' };
      await storeFileHashesInFrontmatter(skillPath, hashes);

      const content = await fs.readFile(join(skillPath, 'SKILL.md'), 'utf-8');
      assert.ok(content.includes('metadata:'));
      assert.ok(content.includes('sync:'));
      assert.ok(content.includes('sha256-abc123'));
      assert.ok(content.includes('sha256-def456'));
    });

    it('should update existing sync metadata', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        join(skillPath, 'SKILL.md'),
        '---\nname: test\nmetadata:\n  sync:\n    version: 1\n    files:\n      old.js: sha256-old123\n---\ncontent'
      );

      const hashes = { 'new.js': 'sha256-new456' };
      await storeFileHashesInFrontmatter(skillPath, hashes);

      const result = await getStoredHashes(skillPath);
      assert.deepStrictEqual(result, { 'new.js': 'sha256-new456' });
    });

    it('should preserve existing frontmatter fields', async () => {
      const skillPath = join(TEST_DIR, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(
        join(skillPath, 'SKILL.md'),
        '---\nname: test\ndescription: a test skill\n---\ncontent'
      );

      await storeFileHashesInFrontmatter(skillPath, { 'util.js': 'sha256-abc123' });

      const content = await fs.readFile(join(skillPath, 'SKILL.md'), 'utf-8');
      assert.ok(content.includes('name: test'));
      assert.ok(content.includes('description: a test skill'));
    });
  });

  describe('consolidateDependentsToCommon', () => {
    it('should copy single source to common', async () => {
      const commonPath = join(TEST_DIR, '.agents-common', 'skills');
      await fs.mkdir(commonPath, { recursive: true });

      const claudePath = join(TEST_DIR, '.claude', 'skills');
      await fs.mkdir(claudePath, { recursive: true });
      const claudeSkillPath = join(claudePath, 'test-skill');
      await fs.mkdir(claudeSkillPath, { recursive: true });
      await fs.writeFile(join(claudeSkillPath, 'util.js'), 'console.log("hello");');

      const platformFiles = new Map([
        ['claude', [
          { relativePath: 'util.js', absolutePath: join(claudeSkillPath, 'util.js'), hash: 'sha256-abc123' }
        ]]
      ]);

      const result = await consolidateDependentsToCommon('test-skill', platformFiles, commonPath, {});

      assert.strictEqual(result.conflicts.length, 0);
      assert.strictEqual(result.hashes['util.js'], 'sha256-abc123');

      const commonFilePath = join(commonPath, 'test-skill', 'util.js');
      const exists = await fs.access(commonFilePath).then(() => true).catch(() => false);
      assert.ok(exists);
    });

    it('should detect conflict when hashes differ', async () => {
      const commonPath = join(TEST_DIR, '.agents-common', 'skills');
      await fs.mkdir(commonPath, { recursive: true });

      const claudePath = join(TEST_DIR, '.claude', 'skills');
      const codexPath = join(TEST_DIR, '.codex', 'skills');
      await fs.mkdir(claudePath, { recursive: true });
      await fs.mkdir(codexPath, { recursive: true });

      const claudeSkillPath = join(claudePath, 'test-skill');
      const codexSkillPath = join(codexPath, 'test-skill');
      await fs.mkdir(claudeSkillPath, { recursive: true });
      await fs.mkdir(codexSkillPath, { recursive: true });

      await fs.writeFile(join(claudeSkillPath, 'util.js'), 'console.log("hello");');
      await fs.writeFile(join(codexSkillPath, 'util.js'), 'console.log("goodbye");');

      const platformFiles = new Map([
        ['claude', [
          { relativePath: 'util.js', absolutePath: join(claudeSkillPath, 'util.js'), hash: 'sha256-abc123' }
        ]],
        ['codex', [
          { relativePath: 'util.js', absolutePath: join(codexSkillPath, 'util.js'), hash: 'sha256-def456' }
        ]]
      ]);

      const result = await consolidateDependentsToCommon('test-skill', platformFiles, commonPath, {});

      // Should have a conflict since hashes differ
      assert.ok(result.conflicts.length > 0);
      assert.strictEqual(result.conflicts[0].relativePath, 'util.js');
    });
  });

  describe('cleanupPlatformDependentFiles', () => {
    it('should remove dependent files', async () => {
      const platformPath = join(TEST_DIR, '.claude', 'skills');
      await fs.mkdir(platformPath, { recursive: true });

      const skillPath = join(platformPath, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');
      await fs.writeFile(join(skillPath, 'util.js'), 'console.log("hello");');

      await cleanupPlatformDependentFiles(platformPath, 'test-skill', ['util.js']);

      const utilExists = await fs.access(join(skillPath, 'util.js')).then(() => true).catch(() => false);
      assert.ok(!utilExists);

      const skillMdExists = await fs.access(join(skillPath, 'SKILL.md')).then(() => true).catch(() => false);
      assert.ok(skillMdExists);
    });

    it('should remove empty directories', async () => {
      const platformPath = join(TEST_DIR, '.claude', 'skills');
      await fs.mkdir(platformPath, { recursive: true });

      const skillPath = join(platformPath, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');

      const scriptsPath = join(skillPath, 'scripts');
      await fs.mkdir(scriptsPath, { recursive: true });
      await fs.writeFile(join(scriptsPath, 'util.js'), 'console.log("hello");');

      // Cleanup should remove util.js and then the empty scripts directory
      await cleanupPlatformDependentFiles(platformPath, 'test-skill', ['scripts' + '/' + 'util.js']);

      const utilExists = await fs.access(join(scriptsPath, 'util.js')).then(() => true).catch(() => false);
      assert.ok(!utilExists);

      // The scripts directory should be removed since it's now empty
      const scriptsExists = await fs.access(scriptsPath).then(() => true).catch(() => false);
      assert.ok(!scriptsExists);
    });

    it('should preserve SKILL.md', async () => {
      const platformPath = join(TEST_DIR, '.claude', 'skills');
      await fs.mkdir(platformPath, { recursive: true });

      const skillPath = join(platformPath, 'test-skill');
      await fs.mkdir(skillPath, { recursive: true });
      await fs.writeFile(join(skillPath, 'SKILL.md'), '---\nname: test\n---\ncontent');

      await cleanupPlatformDependentFiles(platformPath, 'test-skill', []);

      const skillMdExists = await fs.access(join(skillPath, 'SKILL.md')).then(() => true).catch(() => false);
      assert.ok(skillMdExists);
    });
  });
});
