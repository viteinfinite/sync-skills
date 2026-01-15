# Dependent Files Sync - Implementation Plan

## Overview

Implement dependent files sync feature to centralize non-SKILL.md files in `.agents-common/skills/` with hash-based conflict resolution.

## Reference Design

See [2025-01-14-dependent-files-sync-design.md](./2025-01-14-dependent-files-sync-design.md)

## Implementation Steps

### Phase 1: Core Functions (src/dependents.ts)

Create a new module `src/dependents.ts` with the following exports:

#### 1.1 Type Definitions
```typescript
// Add to src/types.ts or define in dependents.ts
interface DependentFile {
  relativePath: string;  // Relative to skill folder, e.g., "scripts/util.js"
  absolutePath: string;  // Absolute path to the file
  hash: string;          // sha256 hash
}

interface DependentFileHashes {
  [relativePath: string]: string;  // "scripts/util.js": "sha256-abc123..."
}

interface SyncMetadata {
  version: number;
  files: DependentFileHashes;
}
```

#### 1.2 File Detection
```typescript
export function detectDependentFiles(skillPath: string): DependentFile[]
```
- Scan skill folder recursively
- Exclude: `SKILL.md`, `node_modules/`, `.git/`
- Return array of dependent files with metadata

#### 1.3 Hash Computation
```typescript
export async function computeFileHash(filePath: string): Promise<string>
```
- Use `crypto.subtle.digest` or Node's `crypto` module
- Return `sha256-{hash}` format

#### 1.4 Collection from Platforms
```typescript
export async function collectDependentFilesFromPlatforms(
  skillName: string,
  platformPaths: string[]
): Promise<Map<string, DependentFile[]>>
```
- Return map of `{ platform: [dependent files] }`

#### 1.5 Consolidation to Common
```typescript
export async function consolidateDependentsToCommon(
  skillName: string,
  platformFiles: Map<string, DependentFile[]>,
  commonPath: string,
  storedHashes?: DependentFileHashes
): Promise<{ conflicts: Conflict[], hashes: DependentFileHashes }>
```
- Compare hashes across platforms and vs stored
- Copy resolved files to common
- Return conflicts for user resolution

#### 1.6 Cleanup Platform Files
```typescript
export async function cleanupPlatformDependentFiles(
  platformPath: string,
  skillName: string
): Promise<void>
```
- Remove dependent files from platform folder
- Preserve SKILL.md

#### 1.7 Frontmatter Updates
```typescript
export async function storeFileHashesInFrontmatter(
  skillPath: string,
  hashes: DependentFileHashes
): Promise<void>
```
- Parse existing frontmatter
- Update `metadata.sync.files`
- Write back to file

### Phase 2: Integrate into Sync Pipeline (src/index.ts)

Modify `src/index.ts` to add dependent files sync:

```typescript
// After Phase 5 (conflict resolution), add new phase:

// Phase 6: Sync dependent files
for (const skillName of allSkills) {
  const dependentFiles = await collectDependentFilesFromPlatforms(
    skillName,
    platformPaths
  );

  const result = await consolidateDependentsToCommon(
    skillName,
    dependentFiles,
    commonPath,
    getStoredHashes(skillName)
  );

  // Handle conflicts
  for (const conflict of result.conflicts) {
    await resolveDependentConflict(conflict);
  }

  // Update frontmatter
  await storeFileHashesInFrontmatter(
    path.join(commonPath, skillName, 'SKILL.md'),
    result.hashes
  );

  // Cleanup platforms
  for (const platform of platforms) {
    await cleanupPlatformDependentFiles(platform.path, skillName);
  }
}
```

### Phase 3: Conflict Resolution (src/resolver.ts)

Extend `src/resolver.ts` to handle dependent file conflicts:

```typescript
export async function resolveDependentConflict(
  conflict: DependentConflict
): Promise<string>  // Returns selected file path
```
- Show diff between conflicting versions
- Prompt user: keep common, keep platform, skip
- Return path to selected version

### Phase 4: Helper Functions

#### 4.1 Get Stored Hashes
```typescript
async function getStoredHashes(
  skillPath: string
): Promise<DependentFileHashes>
```
- Parse SKILL.md frontmatter
- Extract `metadata.sync.files` if exists
- Return empty object if not present

#### 4.2 Compare Hashes
```typescript
function hashMatches(a: string, b: string): boolean
function hashChanged(
  currentHash: string,
  storedHash: string | undefined
): boolean
```

### Phase 5: Unit Tests (test/dependents.test.ts)

Create comprehensive unit tests:

```typescript
describe('detectDependentFiles', () => {
  it('returns empty for SKILL.md only folder', async () => {});
  it('returns single file', async () => {});
  it('returns nested files', async () => {});
  it('ignores node_modules', async () => {});
});

describe('computeFileHash', () => {
  it('returns consistent hash', async () => {});
  it('different hashes for different content', async () => {});
});

describe('consolidateDependentsToCommon', () => {
  it('copies single source to common', async () => {});
  it('detects conflict when hashes differ', async () => {});
  it('updates frontmatter with hashes', async () => {});
});

describe('cleanupPlatformDependentFiles', () => {
  it('removes dependent files', async () => {});
  it('preserves SKILL.md', async () => {});
});
```

### Phase 6: Integration Tests (test/integration/)

Add to or create `test/integration/dependent-files.test.ts`:

```typescript
describe('Scenario 1: Single platform, no common', () => {
  it('creates common with dependent files', async () => {
    // Setup: .claude/myskill/SKILL.md + file.js
    // Assert: .agents-common/myskill/file.js exists
    // Assert: .claude/myskill/file.js removed
  });
});

describe('Scenario 2: Multi-platform, no common', () => {
  it('resolves conflicts via hash', async () => {
    // Setup: .claude and .codex both have file.js (different content)
    // Assert: User prompted, conflict resolved
    // Assert: Hash stored in frontmatter
  });
});

describe('Scenario 3: Existing common + platforms', () => {
  it('compares vs stored hash', async () => {
    // Setup: Common exists with stored hash
    // Setup: Platform has modified file
    // Assert: Conflict detected
  });
});

describe('Scenario 4: Common only, both platforms', () => {
  it('creates @ references in both platforms', async () => {
    // Setup: .agents-common only
    // Assert: Both .claude and .codex get SKILL.md @ references
    // Assert: Dependent files stay in common only
  });
});

describe('Scenario 5: Common only, single platform', () => {
  it('creates @ reference in one platform', async () => {
    // Setup: .agents-common only, claude enabled
    // Assert: Only .claude gets SKILL.md @ reference
  });
});
```

### Phase 7: Update TESTING.md

Add new section to `TESTING.md`:

```markdown
## Dependent Files Sync

### Feature Overview
Dependent files (all non-SKILL.md files) are centralized in `.agents-common/skills/`
with hash-based conflict resolution.

### Manual Testing

#### Test Scenario 1: Single Platform
1. Create `.claude/skills/test-skill/SKILL.md`
2. Add `.claude/skills/test-skill/util.js`
3. Run: `npm test` or sync command
4. Verify:
   - `.agents-common/skills/test-skill/util.js` exists
   - `.claude/skills/test-skill/util.js` removed
   - Hash in SKILL.md frontmatter

#### Test Scenario 2: Multi-Platform Conflict
1. Create same file in `.claude` and `.codex` with different content
2. Run sync
3. Verify conflict prompt appears
4. Select resolution
5. Verify hash stored in frontmatter

### Verification Checklist
- [ ] Dependent files only in `.agents-common`
- [ ] Platform folders have only SKILL.md (@ reference)
- [ ] Hashes stored in `metadata.sync.files`
- [ ] Conflicts detected when hashes differ
- [ ] Cleanup removes platform dependent files
```

### Phase 8: Error Handling

Add error handling throughout:

```typescript
// File operations wrapped in try-catch
try {
  await fs.readFile(filePath);
} catch (error) {
  console.warn(`Skipping file ${filePath}: ${error.message}`);
  continue;
}

// Hash computation failures
if (!hash) {
  // Treat as conflict - cannot verify
  conflicts.push({ type: 'hash_error', file });
}
```

## Dependencies

- Existing: `gray-matter` (frontmatter parsing)
- Existing: `inquirer` (user prompts)
- May need: `crypto` (Node built-in) for hashing
- May need: `glob` or recursive readdir for file detection

## Order of Implementation

1. **Phase 1** - Core functions (dependents.ts)
2. **Phase 5** - Unit tests (dependents.test.ts)
3. **Phase 2** - Integration into sync pipeline
4. **Phase 3** - Conflict resolution
5. **Phase 6** - Integration tests
6. **Phase 7** - Update TESTING.md
7. **Phase 8** - Error handling refinement

## Success Criteria

- All 5 scenarios pass integration tests
- Unit tests cover all core functions
- TESTING.md documents manual testing steps
- No regression in existing SKILL.md sync behavior
- Dependent files only exist in `.agents-common` after sync
