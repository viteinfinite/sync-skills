# Change: Create assistant skill directories from common-only skills

## Why

When a user has `.agents-common` configured with skills for certain assistants (e.g., claude and gemini), but those assistant directories don't exist yet, the tool currently skips creating them. This is an awkward gap in the workflow:

- Scenario: A team shares `.agents-common` skills via version control
- New team member runs `sync-skills`
- Expected: `.claude/skills` and `.gemini/skills` are created with @ references
- Actual: Nothing happens (assistant directories don't exist, so `syncCommonOnlySkills` skips them)

The current `syncCommonOnlySkills` function in `assistants.ts:199-276` has this code at lines 207-212:

```typescript
try {
  await fs.access(join(baseDir, config.dir));
} catch {
  // Assistant directory doesn't exist, skip creation
  continue;
}
```

This explicitly skips creation when the directory doesn't exist.

## What Changes

- **MODIFIED**: `syncCommonOnlySkills()` to create assistant directories when they don't exist (instead of skipping)
- **MODIFIED**: `normalizeFrontmatter()` in `detector.ts` to only compare `CORE_FIELDS` for conflicts (not all frontmatter fields)
- **MODIFIED**: Remove individual file hash tracking (`metadata.sync.files`) since main hash already includes all dependent files
- **ADDED**: Validation to detect platform skills modified outside of sync-skills (hash mismatch)
- **ADDED**: Interactive prompt asking user to apply edits to common skill when out-of-sync is detected
- **ADDED**: Integration test coverage for the scenario where only `.agents-common` exists
- **ADDED**: Integration test coverage for the same scenario with `--home` mode

## Impact

- Affected specs: N/A (integration test enhancement, behavior fixes)
- Affected code:
  - `src/assistants.ts` - `syncCommonOnlySkills()` function
  - `src/detector.ts` - `normalizeFrontmatter()` function
  - `src/dependents.ts` - remove `DependentFileHashes`, `getStoredHashes()`, `storeFileHashesInFrontmatter()`, simplify conflict detection
  - `src/index.ts` - dependent files cleanup logic, add out-of-sync detection phase, remove individual hash storage
  - `src/syncer.ts` - update `computeSkillHash()` to not return dependent file hashes
  - `src/types.ts` - remove `DependentFileHashes` interface
  - `src/resolver.ts` - add handler for out-of-sync skills prompt
  - `test/integration.test.ts` - add new test cases, update tests that expect individual file hashes
