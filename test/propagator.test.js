import { expect } from 'chai';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { propagateFrontmatter } from '../src/propagator.js';

describe('propagateFrontmatter', () => {
  let testDir;

  beforeEach(async () => {
    testDir = join(tmpdir(), 'propagator-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should leave targets unchanged when common has no frontmatter', async () => {
    // Create target file with frontmatter
    const targetPath = join(testDir, 'target.md');
    await fs.writeFile(targetPath, `---
name: test-skill
description: A test skill
---

# Target content`);

    // Create common file without frontmatter
    const commonPath = join(testDir, 'common.md');
    await fs.writeFile(commonPath, `# Common content`);

    await propagateFrontmatter(commonPath, [targetPath]);

    const targetContent = await fs.readFile(targetPath, 'utf8');
    expect(targetContent).to.include('name: test-skill');
    expect(targetContent).to.include('description: A test skill');
  });

  it('should add new fields from common to target', async () => {
    // Create target file with minimal frontmatter
    const targetPath = join(testDir, 'target.md');
    await fs.writeFile(targetPath, `---
name: test-skill
---

# Target content`);

    // Create common file with additional fields
    const commonPath = join(testDir, 'common.md');
    await fs.writeFile(commonPath, `---
name: test-skill
description: A test skill
license: MIT
---

# Common content`);

    await propagateFrontmatter(commonPath, [targetPath]);

    const targetContent = await fs.readFile(targetPath, 'utf8');
    expect(targetContent).to.include('name: test-skill');
    expect(targetContent).to.include('description: A test skill');
    expect(targetContent).to.include('license: MIT');
  });

  it('should merge allowed-tools lists', async () => {
    // Create target file with allowed-tools
    const targetPath = join(testDir, 'target.md');
    await fs.writeFile(targetPath, `---
name: test-skill
allowed-tools:
  - Read
  - Grep
---

# Target content`);

    // Create common file with different allowed-tools
    const commonPath = join(testDir, 'common.md');
    await fs.writeFile(commonPath, `---
name: test-skill
allowed-tools:
  - Write
  - Glob
---

# Common content`);

    await propagateFrontmatter(commonPath, [targetPath]);

    const targetContent = await fs.readFile(targetPath, 'utf8');
    expect(targetContent).to.include('- Read');
    expect(targetContent).to.include('- Grep');
    expect(targetContent).to.include('- Write');
    expect(targetContent).to.include('- Glob');
  });

  it('should merge metadata objects', async () => {
    // Create target file with metadata
    const targetPath = join(testDir, 'target.md');
    await fs.writeFile(targetPath, `---
name: test-skill
metadata:
  author: target
  version: 1.0
---

# Target content`);

    // Create common file with metadata
    const commonPath = join(testDir, 'common.md');
    await fs.writeFile(commonPath, `---
name: test-skill
metadata:
  author: common
  category: test
---

# Common content`);

    await propagateFrontmatter(commonPath, [targetPath]);

    const targetContent = await fs.readFile(targetPath, 'utf8');
    // Common should override target for 'author'
    expect(targetContent).to.include('author: common');
    // Target's version should be preserved (YAML may format as '1' instead of '1.0')
    expect(targetContent).to.include('version:');
    // Common's category should be added
    expect(targetContent).to.include('category: test');
  });

  it('should preserve sync metadata in target', async () => {
    // Create target file with sync metadata
    const targetPath = join(testDir, 'target.md');
    await fs.writeFile(targetPath, `---
name: test-skill
metadata:
  sync:
    managed-by: sync-skills
    refactored: 2025-01-12T00:00:00.000Z
---

# Target content`);

    // Create common file
    const commonPath = join(testDir, 'common.md');
    await fs.writeFile(commonPath, `---
name: test-skill
description: A test skill
---

# Common content`);

    await propagateFrontmatter(commonPath, [targetPath]);

    const targetContent = await fs.readFile(targetPath, 'utf8');
    expect(targetContent).to.include('managed-by: sync-skills');
    expect(targetContent).to.include('refactored: 2025-01-12T00:00:00.000Z');
    expect(targetContent).to.include('description: A test skill');
  });

  it('should skip non-existent target files', async () => {
    // Create common file
    const commonPath = join(testDir, 'common.md');
    await fs.writeFile(commonPath, `---
name: test-skill
description: A test skill
---

# Common content`);

    const nonExistentPath = join(testDir, 'does-not-exist.md');

    // Should not throw
    await propagateFrontmatter(commonPath, [nonExistentPath]);
  });

  it('should be a no-op when common file does not exist', async () => {
    // Create target file
    const targetPath = join(testDir, 'target.md');
    await fs.writeFile(targetPath, `---
name: test-skill
---

# Target content`);

    const nonExistentPath = join(testDir, 'common-does-not-exist.md');

    // Should not throw
    await propagateFrontmatter(nonExistentPath, [targetPath]);

    // Target should be unchanged
    const targetContent = await fs.readFile(targetPath, 'utf8');
    expect(targetContent).to.include('name: test-skill');
  });

});
