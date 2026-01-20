# Design: Create assistant skill directories from common-only skills

## Current Behavior

The `syncCommonOnlySkills()` function in `src/assistants.ts:199-276` currently:

1. Iterates over common skills
2. For each enabled assistant config:
   - Checks if the assistant directory exists (line 207-212)
   - **If it doesn't exist: skips with `continue`**
   - If it exists: checks if the skill exists, and creates it if not

## Problem

When `.agents-common` exists with skills but assistant directories don't exist:

```
my-project/
  .agents-common/
    skills/
      my-skill/
        SKILL.md
    config.json  # assistants: ["claude", "gemini"]
  # .claude/ does not exist
  # .gemini/ does not exist
```

Running `sync-skills` does nothing - the assistant directories are never created.

## Solution

Change the logic in `syncCommonOnlySkills()`:

**Before:**
```typescript
try {
  await fs.access(join(baseDir, config.dir));
} catch {
  // Assistant directory doesn't exist, skip creation
  continue;
}
```

**After:**
```typescript
// No need to check if directory exists - we'll create it as needed
// The skill existence check below will handle the case where we need to create
```

The existing skill existence check (lines 216-223) already creates the directory:

```typescript
// Ensure directory exists
await fs.mkdir(dirname(platformSkillPath), { recursive: true });
```

So we simply need to remove the early `continue` that prevents execution.

## Edge Cases

1. **User declines auto-create prompt**: This scenario already has a prompt for creating assistant directories. The change should respect that prompt.
2. **Home mode**: Should work the same way when `--home` flag is used.
3. **Dependent files cleanup for newly created platforms**: When a platform directory is created fresh (didn't exist before), the cleanup logic should not attempt to delete dependent files from that platform since they were never there.
4. **Non-core frontmatter fields causing false conflicts**: Fields like `model` that are not in `CORE_FIELDS` should not trigger conflicts.
5. **Platform skills modified outside of sync-skills**: When a user modifies a platform skill directly (e.g., edits `.claude/skills/my-skill/SKILL.md`), the hash will no longer match. The tool should detect this and prompt the user.

## Individual File Hash Tracking (Redundant)

The current implementation tracks individual file hashes in `metadata.sync.files`:
```yaml
metadata:
  sync:
    hash: sha256-abc123...  # Main hash includes all files
    files:
      scripts/util.js: sha256-def456...
      templates/tmpl.txt: sha256-ghi789...
```

This is redundant because:
1. The main `metadata.sync.hash` already includes all dependent files via `computeSkillHash()`
2. When ANY dependent file changes, the main hash changes
3. We don't need per-file hashes to detect changes - the main hash tells us if ANY file changed

**Simplify to:**
```yaml
metadata:
  sync:
    hash: sha256-abc123...  # Includes frontmatter + body + all dependent files
```

**Changes needed:**
- Remove `DependentFileHashes` interface from `src/types.ts`
- Remove `getStoredHashes()` and `storeFileHashesInFrontmatter()` from `src/dependents.ts`
- Simplify `consolidateDependentsToCommon()` to not track individual hashes
- Remove `files` parameter from frontmatter in `src/index.ts`
- Update tests that check for `metadata.sync.files`

For cleanup, just scan the common skill folder to see which dependent files exist, then remove those from platform folders.

## Dependent Files Cleanup Bug

Currently, the cleanup logic in `index.ts:278-290` tries to cleanup dependent files from ALL enabled platforms:

```typescript
const filesToCleanup = Object.keys(finalHashes);
if (filesToCleanup.length > 0) {
  for (const config of enabledConfigs) {
    await cleanupPlatformDependentFiles(platformSkillsPath, skillName, filesToCleanup);
  }
}
```

This causes warnings like:
```
Warning: Could not delete /path/to/.codex/skills/new-suffixer/SUFFIX.txt: ENOENT: no such file or directory
```

When `.codex` was just created and never had `SUFFIX.txt`, the cleanup should skip it.

**Fix**: Only cleanup dependent files from platforms that originally had those files. The `platformFiles` map returned by `collectDependentFilesFromPlatforms` already tracks which platforms had which files - use that information.

## Conflict Detection False Positives

The conflict detection in `detector.ts:normalizeFrontmatter()` currently compares ALL frontmatter fields (except sync metadata). This causes false conflicts when platforms have different non-core fields.

Example:
```yaml
# .claude/skills/new-suffixer/SKILL.md
name: new-suffixer
description: Suffix filenames
model: haiku-3.5  # Different model for claude

# .gemini/skills/new-suffixer/SKILL.md
name: new-suffixer
description: Suffix filenames
model: gemini-3-pro-preview  # Different model for gemini
```

These are flagged as conflicting even though `model` is not in `CORE_FIELDS` (`['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']`).

**Fix**: Modify `normalizeFrontmatter()` to use `pickCoreFrontmatter()` (or similar logic) to only include `CORE_FIELDS` when comparing for conflicts. Non-core fields like `model` are platform-specific and should be ignored.

## Out-of-Sync Detection

Each platform skill stores a `metadata.sync.hash` that should match the hash of the common skill. If a user modifies a platform skill directly (e.g., by editing `.claude/skills/my-skill/SKILL.md` to fix a typo), the hash will no longer match.

**Current behavior**: The sync proceeds without warning, potentially overwriting the user's edits.

**Desired behavior**:
1. Before Phase 3 (refactoring), detect any platform skills where the current hash doesn't match the stored `metadata.sync.hash`
2. Warn the user: "Skill `my-skill` in `.claude/skills/` has been modified outside of sync-skills"
3. Prompt: "Do you want to apply these edits to the common skill? (Yes/No/Skip)"
   - **Yes**: Copy the platform skill's content to the common skill, update hashes, then continue sync
   - **No**: Use the common skill's content (overwrites platform edits)
   - **Skip**: Leave this skill as-is and continue with other skills
4. If user says Yes, after updating common skill, re-run sync-skills

**Implementation**:
- Add a new phase before Phase 3: "Phase 2.75: Detect out-of-sync platform skills"
- Create a function `detectOutOfSyncSkills()` in `detector.ts` or new file `out-of-sync.ts`
- Create a prompt handler in `resolver.ts` for the user's choice
- If user chooses Yes, update the common skill and restart the sync process

## Testing Strategy

Add five new integration test scenarios:

1. **Project mode**: Only `.agents-common` exists, configured for claude and gemini
2. **Home mode**: Same scenario with `--home` flag
3. **Dependent files cleanup with newly created platform**: `.claude/skills/new-suffixer/` has `SUFFIX.txt`, `.codex` doesn't exist. After sync, no warning about deleting non-existent file from `.codex`
4. **Non-core frontmatter fields don't cause conflicts**: `.claude/skills/my-skill/SKILL.md` has `model: haiku`, `.gemini/skills/my-skill/SKILL.md` has `model: gemini-3-pro-preview`, no conflict should be detected
5. **Out-of-sync platform skill**: User modifies `.claude/skills/my-skill/SKILL.md` directly, sync-skills detects the hash mismatch, prompts user to apply edits to common skill
