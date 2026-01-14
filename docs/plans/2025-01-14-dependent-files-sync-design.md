# Dependent Files Sync Design

## Overview

**Purpose:** Extend the sync-skills tool to handle ALL files in skill folders (not just `SKILL.md`), centralizing dependent files in `.agents-common/skills/` with hash-based conflict resolution.

**Current State:** The tool only processes `SKILL.md` files using `@` references. Other files like `reference.md`, `examples.md`, `scripts/*.js`, or config files are ignored during sync.

**Key Principle:** Dependent files are centralized in `.agents-common` and NEVER copied to platform folders. Only `SKILL.md` gets `@` references in platform locations.

## Final State Example

```
.claude/myskill/
└── SKILL.md (@ reference to .agents-common)

.codex/myskill/
└── SKILL.md (@ reference to .agents-common)

.agents-common/myskill/
├── SKILL.md (full content + sync metadata with file hashes)
└── file.js (centralized, not in platform folders)
```

## Scenarios

### Scenario 1: Single Platform, No Common
**Before:**
```
.claude/myskill/SKILL.md
.claude/myskill/file.js
```
**After sync (with codex enabled):**
```
.claude/myskill/SKILL.md (@ reference)
.codex/myskill/SKILL.md (@ reference)
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js
```

### Scenario 2: Multi-Platform, No Common
**Before:**
```
.claude/myskill/SKILL.md
.claude/myskill/file.js
.codex/myskill/SKILL.md
.codex/myskill/file.js
```
**After sync:**
```
.claude/myskill/SKILL.md (@ reference)
.codex/myskill/SKILL.md (@ reference)
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js (after conflict resolution)
```
- Hash-based conflict resolution
- If conflict → user resolves
- Hash stored in `metadata.sync.files`

### Scenario 3: Existing Common + Platforms
**Before:**
```
.claude/myskill/SKILL.md
.claude/myskill/file.js
.codex/myskill/SKILL.md
.codex/myskill/file.js
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js
```
**After sync:**
- Hash-based conflict resolution
- Hash compared against stored hash in frontmatter

### Scenario 4: Common Only, Both Platforms
**Before:**
```
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js
```
**After sync (with codex and claude enabled):**
```
.claude/myskill/SKILL.md (@ reference)
.codex/myskill/SKILL.md (@ reference)
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js
```

### Scenario 5: Common Only, Single Platform
**Before:**
```
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js
```
**After sync (with claude only):**
```
.claude/myskill/SKILL.md (@ reference)
.agents-common/myskill/SKILL.md
.agents-common/myskill/file.js
```

## Architecture

### Extended Sync Pipeline
```
1. Discovery
2. SKILL.md sync (unchanged)
3. Refactoring (unchanged)
4. Conflict resolution (SKILL.md)
5. DependentFileSync ← NEW
6. Conflict resolution (dependents, hash-based)
7. Frontmatter (with file hashes)
```

### Core Functions

| Function | Purpose |
|----------|---------|
| `detectDependentFiles(skillPath)` | Return list of non-SKILL.md files (recursive) |
| `collectDependentFilesFromPlatforms(skillName, platformPaths)` | Gather dependent files from all platforms |
| `consolidateDependentsToCommon(skillName, files)` | Merge into `.agents-common`, hash-based conflict resolution |
| `computeFileHash(filePath)` | Generate sha256 hash |
| `storeFileHashesInFrontmatter(skillPath, hashes)` | Update `metadata.sync.files` |
| `cleanupPlatformDependentFiles(platformPath)` | Remove dependent files from platform folders |

### Frontmatter Extension

```yaml
---
name: my-skill
description: My skill
metadata:
  sync:
    version: 1
    files:
      file.js: sha256-abc123...
      scripts/util.js: sha256-def456...
---
```

## Data Flow

### Phase 1: Discovery
```
For each platform (.claude, .codex, etc.):
  └─> Scan skills folder
      └─> Detect dependent files (all non-SKILL.md)
      └─> Build map: { skillName: [files from platform] }
```

### Phase 2: Consolidation (per skill)
```
For each skill:
  1. Check if .agents-common/skills/{skillName}/ exists
  2. If NO common:
     - Collect dependent files from all platforms
     - If multiple platforms have same file → hash compare
     - If hashes differ → CONFLICT → prompt user
     - Copy resolved file to common
     - Cleanup dependent files from platforms
  3. If common exists:
     - Compare platform files vs common files (hash)
     - Compare common files vs stored hashes (in frontmatter)
     - If mismatch → CONFLICT → prompt user
     - After resolution → update metadata.sync.files
```

### Phase 3: Cleanup
```
For each platform folder:
  └─> Remove dependent files (now centralized)
  └─> Keep only SKILL.md (@ reference)
```

### Conflict Resolution Flow
```
Hash mismatch detected:
  └─> Show diff (platform vs common or common vs stored)
  └─> Prompt user: keep which version?
  └─> User selects → copy selected version
  └─> Compute new hash
  └─> Update metadata.sync.files
```

## Error Handling

| Error Type | Handling |
|------------|----------|
| **File read error** | Skip file, log warning, continue with other files |
| **Invalid skill folder** | Skip, log error (SKILL.md missing) |
| **Hash computation failure** | Treat as conflict (cannot verify), require user resolution |
| **Frontmatter parse error** | Fail gracefully, don't modify file, log error with file path |
| **Cleanup failure** | Log warning, file remains but sync proceeds |
| **Platform folder missing** | Skip (normal for disabled platforms) |
| **Insufficient permissions** | Error with clear message, halt sync for that skill |

### Conflict Edge Cases
- File exists in multiple platforms with same content → merge silently (single hash)
- File exists in one platform only → treat as source of truth
- Common file deleted but platforms have it → conflict (ask user)
- Frontmatter missing `metadata.sync.files` → initialize as empty, treat all files as new

### User Interaction
- Conflicts presented one at a time per skill
- Options: `keep common`, `keep platform`, `skip`
- Non-interactive mode: fail fast, log all conflicts

## Testing Strategy

### Unit Tests
```
detectDependentFiles()
  ├─> Returns empty array for folder with only SKILL.md
  ├─> Returns single file for simple dependency
  ├─> Returns nested files (scripts/util.js)
  └─> Ignores node_modules, .git

consolidateDependentsToCommon()
  ├─> Copies single source to common
  ├─> Detects conflict when hashes differ
  └─> Updates frontmatter with hashes

computeFileHash()
  ├─> Returns consistent hash for same content
  └─> Different hashes for different content

cleanupPlatformDependentFiles()
  ├─> Removes dependent files
  └─> Preserves SKILL.md (@ reference)
```

### Integration Tests
1. Scenario 1: Single platform → common creation
2. Scenario 2: Multi-platform → conflict resolution
3. Scenario 3: Existing common → hash-based sync
4. Scenario 4: Common only → both platforms enabled
5. Scenario 5: Common only → single platform enabled

### TESTING.md Additions
- Section on dependent file sync behavior
- Expected state before/after for each scenario
- How to manually test hash-based conflicts
- Frontmatter metadata verification steps
