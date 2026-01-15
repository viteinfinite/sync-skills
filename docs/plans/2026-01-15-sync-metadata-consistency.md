# Sync Metadata Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix sync metadata inconsistency where platform files have different `sync` frontmatter when referencing the same common skill, and add comprehensive hash-based sync status tracking.

**Architecture:**
- Add `hash` field to track canonical skill state (CORE_FIELDS + body + dependent-files)
- Store main hash in both common and platform files; match indicates "in sync"
- Keep individual dependent file hashes for fine-grained conflict resolution
- Update metadata at all sync touchpoints (refactor, propagate, dependent sync)

**Tech Stack:**
- TypeScript
- Node.js `fs` promises
- `gray-matter` for frontmatter parsing
- Node.js `crypto` for SHA-256 hashing

---

## Task 1: Add Hash Computation Utility

**Files:**
- Modify: `src/syncer.ts`

**Step 1: Add `computeSkillHash()` function to `src/syncer.ts`**

After the `copySkill()` function, add:

```typescript
/**
 * Compute hash of skill state (frontmatter + body + dependent files)
 * @param coreFrontmatter - CORE_FIELDS from skill
 * @param bodyContent - SKILL.md body content
 * @param dependentFiles - Array of dependent files with hashes
 * @returns Hash in format "sha256-{hex}"
 */
export function computeSkillHash(
  coreFrontmatter: Record<string, unknown>,
  bodyContent: string,
  dependentFiles: Array<{ path: string; hash: string }> = []
): string {
  const crypto = createHash('sha256');

  // 1. Hash core frontmatter (deterministic JSON)
  const frontmatterStr = stableStringify(coreFrontmatter);
  crypto.update(frontmatterStr);
  crypto.update('\n');

  // 2. Hash body content
  crypto.update(bodyContent);
  crypto.update('\n');

  // 3. Hash dependent files (sorted by path for consistency)
  const sortedFiles = [...dependentFiles].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sortedFiles) {
    crypto.update(`${file.path}:${file.hash}\n`);
  }

  return `sha256-${crypto.digest('hex')}`;
}

/**
 * Stable stringification for deterministic hashing
 * Sorts object keys recursively
 */
function stableStringify(obj: unknown, indent = ''): string {
  if (obj === null || obj === undefined) {
    return '';
  }
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(v => stableStringify(v, indent)).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => `"${key}":${stableStringify((obj as Record<string, unknown>)[key], indent)}`);
    return '{' + pairs.join(',') + '}';
  }
  return '';
}
```

Add import at top:
```typescript
import { createHash } from 'crypto';
```

**Step 2: Commit**

```bash
git add src/syncer.ts
git commit -m "feat: add computeSkillHash utility for sync metadata"
```

---

## Task 2: Update `refactorSkill()` to Add Sync Metadata

**Files:**
- Modify: `src/syncer.ts`

**Step 1: Modify `refactorSkill()` to compute and store hash**

Replace the entire function with:

```typescript
export async function refactorSkill(sourcePath: string): Promise<string | null> {
  const content = await fs.readFile(sourcePath, 'utf8');
  const parsed = matter(content);

  // Skip if already has @ reference
  if (parsed.content.trim().startsWith('@')) {
    return null;
  }

  // Extract skill name from path and resolve paths
  const absSourcePath = resolve(sourcePath);
  const sourceDir = dirname(absSourcePath);
  const skillName = basename(sourceDir);

  // Navigate from the source directory to find the project root
  let currentDir = sourceDir;
  let projectRoot = resolve('.'); // Default to current working directory

  // Check if we're in a .claude or .codex directory structure
  const dirParts = sourceDir.split('/');
  const claudeIndex = dirParts.lastIndexOf('.claude');
  const codexIndex = dirParts.lastIndexOf('.codex');

  if (claudeIndex >= 0 || codexIndex >= 0) {
    // We're in a .claude or .codex directory, go up to the parent of that directory
    const agentDirIndex = Math.max(claudeIndex, codexIndex);
    projectRoot = '/' + dirParts.slice(0, agentDirIndex).join('/');
  }

  const commonPath = join(projectRoot, '.agents-common/skills', skillName, 'SKILL.md');
  const relativeCommonPath = '.agents-common/skills/' + skillName + '/SKILL.md';

  // Ensure .agents-common directory exists
  await fs.mkdir(dirname(commonPath), { recursive: true });

  // Extract core frontmatter fields to copy to common
  const coreFrontmatter: Record<string, unknown> = {};
  for (const field of CORE_FIELDS) {
    if (parsed.data[field]) {
      coreFrontmatter[field] = parsed.data[field];
    }
  }

  // Write frontmatter + body to .agents-common (strip leading newline added by gray-matter)
  const bodyContent = parsed.content.startsWith('\n') ? parsed.content.slice(1) : parsed.content;

  // Compute hash of the new common skill (no dependents yet)
  const skillHash = computeSkillHash(coreFrontmatter, bodyContent, []);

  // Add sync metadata to common frontmatter
  const commonFrontmatter = {
    ...coreFrontmatter,
    sync: {
      'managed-by': 'sync-skills',
      'version': 2,
      'hash': skillHash,
      'dependent-files': {}
    }
  };

  const commonContent = matter.stringify(bodyContent, commonFrontmatter);
  await fs.writeFile(commonPath, commonContent);

  // Add sync metadata to source platform frontmatter
  parsed.data.sync = {
    'managed-by': 'sync-skills',
    'hash': skillHash
  };

  // Replace body with @ reference
  const newContent = matter.stringify(`@${relativeCommonPath}\n`, parsed.data);
  await fs.writeFile(sourcePath, newContent);

  return commonPath;
}
```

**Step 2: Commit**

```bash
git add src/syncer.ts
git commit -m "feat: add sync metadata with hash to refactored skills"
```

---

## Task 3: Update `syncCommonOnlySkills()` to Include Sync Metadata

**Files:**
- Modify: `src/assistants.ts`

**Step 1: Modify the skill creation loop to include sync metadata**

Find the section in `syncCommonOnlySkills()` that creates platform files (around line 240-248) and replace with:

```typescript
// Read common file to get sync metadata
const commonContent = await fs.readFile(commonSkill.path, 'utf8');
const commonParsed = matter(commonContent);
const commonHash = commonParsed.data?.sync?.hash;

// Create @ reference to common skill
const atReference = `@.agents-common/skills/${commonSkill.skillName}/SKILL.md`;

// Ensure directory exists
await fs.mkdir(dirname(platformSkillPath), { recursive: true });

// Build platform frontmatter with sync metadata
const platformFrontmatter = {
  ...coreFrontmatter,
  sync: {
    'managed-by': 'sync-skills',
    ...(commonHash ? { hash: commonHash } : {})
  }
};

// Write the platform skill file with @ reference and frontmatter
const targetContent = matter.stringify(atReference + '\n', platformFrontmatter);
await fs.writeFile(platformSkillPath, targetContent);

console.log(`Created @ reference for ${commonSkill.skillName} in ${config.name}`);
```

**Step 2: Commit**

```bash
git add src/assistants.ts
git commit -m "feat: include sync metadata when creating platform files from common"
```

---

## Task 4: Update `propagateFrontmatter()` to Propagate Hash

**Files:**
- Modify: `src/propagator.ts`

**Step 1: Remove `sync` from SKIP_FIELDS**

Change line 6 from:
```typescript
const SKIP_FIELDS = ['sync'];
```
To:
```typescript
const SKIP_FIELDS = [] as string[];
```

**Step 2: Ensure hash is always propagated from common**

After the merge loop in `mergeFrontmatter()`, ensure sync metadata from common overrides platform:

Find the `mergeFrontmatter()` function and after the existing merge logic, add:

```typescript
  // Always use common's sync hash as the source of truth
  if (common.sync && typeof common.sync === 'object' && !Array.isArray(common.sync)) {
    const commonSync = common.sync as Record<string, unknown>;
    if (commonSync.hash) {
      merged.sync = {
        ...(typeof merged.sync === 'object' && merged.sync && !Array.isArray(merged.sync) ? merged.sync as Record<string, unknown> : {}),
        'managed-by': 'sync-skills',
        'hash': commonSync.hash
      };
    }
  }

  return { merged, conflicts };
```

**Step 3: Commit**

```bash
git add src/propagator.ts
git commit -m "feat: propagate sync hash from common to platform files"
```

---

## Task 5: Add Hash Recomputation After Dependent Files Sync

**Files:**
- Modify: `src/index.ts`
- Modify: `src/syncer.ts`

**Step 1: Add `updateMainHash()` function to `src/syncer.ts`**

Add after `computeSkillHash()`:

```typescript
/**
 * Update the main hash in a skill's frontmatter
 * @param skillPath - Path to the SKILL.md file
 * @param newHash - New hash value
 */
export async function updateMainHash(skillPath: string, newHash: string): Promise<void> {
  const content = await fs.readFile(skillPath, 'utf8');
  const parsed = matter(content);

  const existingData = parsed.data || {};
  const existingSync = (existingData as { sync?: Record<string, unknown> }).sync || {};

  const newData = {
    ...existingData,
    sync: {
      ...existingSync,
      'hash': newHash
    }
  };

  const newContent = matter.stringify(content, newData);
  await fs.writeFile(skillPath, newContent);
}
```

**Step 2: Import `updateMainHash` in `src/index.ts`**

Add to imports:
```typescript
import { refactorSkill, copySkill, updateMainHash } from './syncer.js';
```

**Step 3: Update dependent files sync section to recompute hash**

In `src/index.ts`, after the `storeFileHashesInFrontmatter` call (around line 210), add:

```typescript
// Recompute main hash with new dependent files
const updatedHash = computeSkillHash(
  commonFrontmatter.core,
  commonFrontmatter.body,
  Object.entries(finalHashes).map(([path, hash]) => ({ path, hash }))
);

// Update hash in common file
await updateMainHash(join(commonSkillPath, 'SKILL.md'), updatedHash);

// Propagate updated hash to all platforms
const platformSkillPaths: string[] = [];
for (const config of enabledConfigs) {
  const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
  try {
    await fs.access(platformSkillPath);
    platformSkillPaths.push(platformSkillPath);
  } catch {
    // Platform skill doesn't exist, skip
  }
}

if (platformSkillPaths.length > 0) {
  await propagateFrontmatter(join(commonSkillPath, 'SKILL.md'), platformSkillPaths, { failOnConflict, dryRun });
}
```

Wait, we need to get the common frontmatter and body first. Let me revise - this needs to be more integrated. Let me check the actual code structure first.

**Step 4 (Revised): Get common content before recomputing hash**

Before the `storeFileHashesInFrontmatter` call, add:

```typescript
// Read common file content for hash recomputation
const commonSkillMdPath = join(commonSkillPath, 'SKILL.md');
const commonContent = await fs.readFile(commonSkillMdPath, 'utf8');
const commonParsed = matter(commonContent);
```

Then after `storeFileHashesInFrontmatter`, add:

```typescript
// Recompute main hash with new dependent files
const coreFrontmatter: Record<string, unknown> = {};
for (const field of CORE_FIELDS) {
  if (commonParsed.data[field]) {
    coreFrontmatter[field] = commonParsed.data[field];
  }
}

const bodyContent = commonParsed.content.startsWith('\n')
  ? commonParsed.content.slice(1)
  : commonParsed.content;

const dependentFileList = Object.entries(finalHashes).map(
  ([path, hash]) => ({ path, hash })
);

const updatedHash = computeSkillHash(coreFrontmatter, bodyContent, dependentFileList);

// Update hash in common file
await updateMainHash(commonSkillMdPath, updatedHash);

// Propagate updated hash to all platforms
const platformSkillPaths: string[] = [];
for (const config of enabledConfigs) {
  const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
  try {
    await fs.access(platformSkillPath);
    platformSkillPaths.push(platformSkillPath);
  } catch {
    // Platform skill doesn't exist, skip
  }
}

if (platformSkillPaths.length > 0 && !dryRun) {
  await propagateFrontmatter(commonSkillMdPath, platformSkillPaths, { failOnConflict, dryRun });
}
```

**Step 5: Add import for `CORE_FIELDS`**

In `src/index.ts`, add to imports:
```typescript
import { CORE_FIELDS } from './constants.js';
import { computeSkillHash } from './syncer.js';
```

**Step 6: Commit**

```bash
git add src/index.ts src/syncer.ts
git commit -m "feat: recompute and propagate hash after dependent files sync"
```

---

## Task 6: Add Unit Tests for Hash Computation

**Files:**
- Modify: `test/syncer.test.js`

**Step 1: Add tests for `computeSkillHash()`**

Add to `test/syncer.test.js`:

```javascript
describe('computeSkillHash', () => {
  it('should compute consistent hash for same input', () => {
    const frontmatter = { name: 'test', description: 'desc' };
    const body = 'skill content';
    const dependents = [];

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
    const dependents1 = [];
    const dependents2 = [{ path: 'utils.ts', hash: 'sha256-abc123' }];

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
```

**Step 2: Run tests**

```bash
npm test -- test/syncer.test.js
```

Expected: PASS

**Step 3: Commit**

```bash
git add test/syncer.test.js
git commit -m "test: add tests for computeSkillHash"
```

---

## Task 7: Add Integration Test for Sync Metadata Consistency

**Files:**
- Modify: `test/integration/sync-workflow.test.ts`

**Step 1: Add test for sync metadata consistency**

Add a new test case:

```typescript
test('sync metadata: platform files have matching hash after sync', async () => {
  // Setup: Create a skill in both platforms with different content
  const claudeSkillPath = join(fixturesDir, '.claude/skills/test-sync-meta/SKILL.md');
  const codexSkillPath = join(fixturesDir, '.codex/skills/test-sync-meta/SKILL.md');

  await fs.mkdir(dirname(claudeSkillPath), { recursive: true });
  await fs.mkdir(dirname(codexSkillPath), { recursive: true });

  await fs.writeFile(claudeSkillPath, matter.stringify('Claude content', {
    name: 'test-sync-meta',
    description: 'Test sync metadata'
  }));

  await fs.writeFile(codexSkillPath, matter.stringify('Codex content', {
    name: 'test-sync-meta',
    description: 'Test sync metadata'
  }));

  // Run sync (user chooses codex version)
  const rl = readline.createInterface({
    input: Stream.from(['use-codex']), // Choose codex
    output: new Writable()
  });

  // Mock readline if needed
  // ... sync logic ...

  // After sync, both files should have same sync.hash
  const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
  const codexContent = await fs.readFile(codexSkillPath, 'utf8');

  const claudeParsed = matter(claudeContent);
  const codexParsed = matter(codexContent);

  const claudeHash = claudeParsed.data.sync?.hash;
  const codexHash = codexParsed.data.sync?.hash;

  assert(claudeHash, 'Claude skill should have sync.hash');
  assert(codexHash, 'Codex skill should have sync.hash');
  assert.strictEqual(claudeHash, codexHash, 'Both platforms should have matching hash');

  // Cleanup
  await fs.rm(dirname(claudeSkillPath), { recursive: true, force: true });
  await fs.rm(dirname(codexSkillPath), { recursive: true, force: true });
});
```

**Step 2: Run integration tests**

```bash
npm run test:integration
```

Expected: PASS

**Step 3: Commit**

```bash
git add test/integration/sync-workflow.test.ts
git commit -m "test: add integration test for sync metadata consistency"
```

---

## Task 8: Run Full Test Suite

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds without errors

**Step 3: Fix any issues**

If tests fail or build errors occur, fix and commit with:
```bash
git commit -m "fix: resolve test failures and build errors"
```

---

## Task 9: Manual Verification

**Step 1: Test with real skills**

```bash
cd /tmp/test-sync-skills
npm link /Users/civetta/Works/Personal/sync-skills
sync-skills --dry-run
```

**Step 2: Verify sync metadata**

Check that:
- Common skills have `sync.hash`, `sync.version: 2`, `sync.dependent-files`
- Platform skills have `sync.hash` matching common
- No "frontmatter only" conflicts occur

**Step 3: Document any edge cases found**

If issues found, create follow-up tasks

---

## Summary

This implementation:
1. ✅ Adds hash-based sync status tracking
2. ✅ Ensures platform files have consistent sync metadata
3. ✅ Propagates hash from common to all platforms
4. ✅ Recomputes hash after dependent files sync
5. ✅ Includes comprehensive tests

**Post-implementation:**
- Run verification: `./scripts/npx-test.sh`
- Run install test: `./scripts/npm-install-test.sh`
