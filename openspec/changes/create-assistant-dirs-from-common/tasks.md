# Tasks: Create assistant skill directories from common-only skills

## Implementation Tasks

- [x] 1.1 Remove individual file hash tracking: Remove `DependentFileHashes` interface from `src/types.ts`

- [x] 1.2 Remove `getStoredHashes()` and `storeFileHashesInFrontmatter()` from `src/dependents.ts`

- [x] 1.3 Simplify `consolidateDependentsToCommon()` in `src/dependents.ts` to not track individual hashes

- [x] 1.4 Update `src/index.ts` to not store individual file hashes, scan common folder for cleanup instead

- [x] 1.5 Modify `syncCommonOnlySkills()` in `src/assistants.ts` to remove the directory existence check that causes early `continue` (lines 207-212)

- [x] 1.6 Fix dependent files cleanup logic in `src/index.ts` (around line 278-290) to only cleanup from platforms that originally had those files

- [x] 1.7 Fix conflict detection in `src/detector.ts` to only compare `CORE_FIELDS` (modify `normalizeFrontmatter()` to use `pickCoreFrontmatter()` logic)

- [x] 1.8 Implement out-of-sync detection: Add `detectOutOfSyncSkills()` function in `src/detector.ts` (or new file `src/out-of-sync.ts`)

- [x] 1.9 Implement out-of-sync prompt handler in `src/resolver.ts` for user's choice (Yes/No/Skip)

- [x] 1.10 Integrate out-of-sync detection into main sync flow in `src/index.ts` as Phase 2.75

- [x] 1.11 Add integration test: "Scenario: Only .agents-common exists - should create assistant directories with @ references" in `test/integration.test.ts`

- [x] 1.12 Add integration test: "Scenario: Only .agents-common exists with --home - should create home assistant directories with @ references" in `test/integration.test.ts`

- [x] 1.13 Add integration test: "Scenario: Dependent files cleanup with newly created platform - should not warn about deleting non-existent files" in `test/integration.test.ts`

- [x] 1.14 Add integration test: "Scenario: Different model fields do not cause conflict - non-core fields should be ignored" in `test/integration.test.ts`

- [x] 1.15 Add integration test: "Scenario: Platform skill modified externally - should detect hash mismatch and prompt user" in `test/integration.test.ts`

- [x] 1.16 Run integration tests and verify they pass

- [x] 1.17 If tests fail, debug and fix the implementation

- [x] 1.18 Run full test suite to ensure no regressions

## Validation Tasks

- [ ] 2.1 Manual test: Create a test directory with only `.agents-common` configured for claude and gemini, run `sync-skills`, verify directories are created

- [ ] 2.2 Manual test: Same as above with `--home` flag

- [ ] 2.3 Manual test: Verify dry-run mode logs correctly without creating files

- [ ] 2.4 Manual test: Create `.claude/skills/my-skill/` with `model: haiku` and `.gemini/skills/my-skill/` with `model: gemini-3-pro-preview`, run `sync-skills`, verify no conflict is detected

- [ ] 2.5 Manual test: Create a synced skill, then modify `.claude/skills/my-skill/SKILL.md` directly, run `sync-skills`, verify warning is displayed and prompt appears
