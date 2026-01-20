# Testing Guide

This document outlines the testing procedures for the sync-skills tool.

## Prerequisites

- Node.js with ES modules support
- Project dependencies installed (`npm install`)

## Test Sequence

### 0. Setup Test Environment
Create a new test directory and navigate into it:

```bash
mkdir sync-skills-test
cd sync-skills-test
npm init -y
npm install ../path-to-sync-skills
```

### 1. Create Fake Skills

From the test directory, use the `add-skill` script to create test skills:

```bash
# Create skills in .claude
node ../scripts/add-skill claude skill-a
node ../scripts/add-skill claude skill-b
node ../scripts/add-skill claude skill-c

# Or directly
node ../scripts/add-fake-skill.js claude skill-a
node ../scripts/add-fake-skill.js codex another-skill
```

### 2. Run Sync

From the test directory, test the sync functionality:

```bash
# Full sync
npx tsx bin/sync-skills.ts

# With conflict handling
npx tsx bin/sync-skills.ts --fail-on-conflict
```

### 3. Verify Results

From the test directory, check the created structure:

```bash
# Configuration
cat .agents-common/config.json

# Common skills
cat .agents-common/skills/skill-a/SKILL.md

# Source skills (with @ reference + sync metadata)
cat .claude/skills/skill-a/SKILL.md

# Target skills (with @ reference only)
cat .codex/skills/skill-a/SKILL.md

# Directory tree
ls -laR .agents-common/ .claude/skills/ .codex/skills/
```

### 4. Test Reconfiguration

```bash
# Reconfigure which assistants to sync
npx tsx bin/sync-skills.ts --reconfigure
```

### 5. Test Home Mode

```bash
# Sync in home directory
npx tsx bin/sync-skills.ts --home
```

### 6. Clean Up

Remove test artifacts:

```bash
# Clean test fixtures
npm run test:clean

# Remove all generated files
rm -rf .agents-common .claude .codex
```

## Expected Behavior

### Auto-Configuration

When no configuration exists:
- Always prompt the user to select assistants
- Preselect detected assistants when any folders exist

### Sync Process

1. **Phase 1 - Discovery:** Detect which assistants have skills
2. **Phase 2 - Bidirectional Sync:** Create missing assistant folders
3. **Phase 2.5 - Common-Only Sync:** Create @ references in platform folders for skills that only exist in `.agents-common`
4. **Phase 2.75 - Out-of-Sync Detection:** Detect platform skills modified outside of sync-skills
5. **Phase 3 - Refactoring:** Move skills without `@` references to `.agents-common`
6. **Phase 4 - Conflict Resolution:** Detect and resolve skill conflicts
7. **Phase 5 - Frontmatter Propagation:** Sync frontmatter from common to targets
8. **Phase 6 - Dependent Files Sync:** Centralize non-SKILL.md files in `.agents-common`

## Dependent Files Sync

### Feature Overview

Dependent files (all non-SKILL.md files in skill folders) are centralized in `.agents-common/skills/` with hash-based conflict resolution. These files are NOT copied to platform folders - they only exist in the common folder.

### Supported File Types

- Documentation files (`README.md`, `guide.md`, etc.)
- Nested documentation (`docs/reference.md`)
- Utility scripts (`scripts/util.js`)
- Config files (`config.json`, `schema.yaml`)
- Any other supporting files

Excluded from sync:
- `SKILL.md` (handled by main sync process)
- `node_modules/`, `.git/`, and other ignored directories

### Scenarios

#### Scenario 1: Single Platform, No Common

**Before:**
```
.claude/myskill/SKILL.md
.claude/myskill/util.js
```

**After sync (with codex enabled):**
```
.claude/myskill/SKILL.md (@ reference)
.codex/myskill/SKILL.md (@ reference)
.agents-common/myskill/SKILL.md
.agents-common/myskill/util.js (centralized)
```

#### Scenario 2: Multi-Platform, No Common

**Before:**
```
.claude/myskill/SKILL.md
.claude/myskill/util.js
.codex/myskill/SKILL.md
.codex/myskill/util.js (different content)
```

**After sync:**
- Hash-based conflict resolution detects different content
- User prompted to resolve conflict
- Resolved file stored in common
- Main hash (includes all files) stored in `metadata.sync.hash`

#### Scenario 3: Existing Common + Platforms

- Platform files compared vs common files (hash)
- Common files compared vs stored hashes (in frontmatter)
- Conflicts detected when hashes differ
- After resolution, `metadata.sync.hash` recomputed (includes all files)

#### Scenario 4: Common Only, Both Platforms

**Before:**
```
.agents-common/myskill/SKILL.md
.agents-common/myskill/util.js
```

**After sync (with codex and claude enabled):**
```
.claude/myskill/SKILL.md (@ reference created)
.codex/myskill/SKILL.md (@ reference created)
.agents-common/myskill/SKILL.md (unchanged)
.agents-common/myskill/util.js (unchanged - centralized)
```

#### Scenario 5: Common Only, Both Platforms

**Before:**
```
.agents-common/myskill-1/SKILL.md
.agents-common/myskill-1/util.js
.agents-common/myskill-2/SKILL.md
.claude/myskill-1/SKILL.md
```

**After sync (with claude enabled):**
```
.agents-common/myskill-1/SKILL.md
.agents-common/myskill-1/util.js
.agents-common/myskill-2/SKILL.md
.claude/myskill-1/SKILL.md
.claude/myskill-2/SKILL.md (new, with @ reference)
```

### Frontmatter Extension

After dependent files sync, SKILL.md frontmatter includes:

```yaml
---
name: my-skill
description: My skill
metadata:
  sync:
    version: 1
    hash: sha256-abc123... # Includes frontmatter + body + all dependent files
---
```

### Manual Testing

#### Test Scenario 1: Single Platform

```bash
# Create skill with dependent file
mkdir -p .claude/skills/test-skill
cat > .claude/skills/test-skill/SKILL.md << 'EOF'
---
name: test-skill
---
# Test Skill
EOF

echo 'console.log("hello");' > .claude/skills/test-skill/util.js

# Run sync
npx tsx bin/sync-skills.ts

# Verify
cat .agents-common/skills/test-skill/util.js
ls .claude/skills/test-skill/util.js  # Should not exist (removed)
```

#### Test Scenario 2: Multi-Platform Conflict

```bash
# Create skill in both platforms with different content
mkdir -p .claude/skills/conflict-skill
cat > .claude/skills/conflict-skill/SKILL.md << 'EOF'
---
name: conflict-skill
---
# Conflict Skill
EOF

mkdir -p .codex/skills/conflict-skill
cat > .codex/skills/conflict-skill/SKILL.md << 'EOF'
---
name: conflict-skill
---
# Conflict Skill
EOF

# Different content triggers conflict
echo 'console.log("claude");' > .claude/skills/conflict-skill/util.js
echo 'console.log("codex");' > .codex/skills/conflict-skill/util.js

# Run sync - should prompt for resolution
npx tsx bin/sync-skills.ts

# Verify hash stored in frontmatter (includes all files)
grep -A5 'metadata:' .agents-common/skills/conflict-skill/SKILL.md
```

### Verification Checklist

After running dependent files sync, verify:

- [ ] Dependent files exist only in `.agents-common/skills/{skill}/`
- [ ] Platform folders contain only `SKILL.md` (@ reference)
- [ ] Main hash stored in `metadata.sync.hash` field (includes frontmatter + body + all dependent files)
- [ ] Conflicts detected when file hashes differ
- [ ] Cleanup removed platform dependent files
- [ ] Empty directories removed from platform folders
- [ ] `SKILL.md` preserved in all locations

### Testing Hash-Based Conflicts

```bash
# Create skill with stored hash
mkdir -p .agents-common/skills/hash-test
cat > .agents-common/skills/hash-test/SKILL.md << 'EOF'
---
name: hash-test
metadata:
  sync:
    version: 1
    hash: sha256-abc123... # Main hash includes all files
---
# Hash Test
EOF

echo 'original content' > .agents-common/skills/hash-test/util.js

# Modify platform version - should detect out-of-sync
mkdir -p .claude/skills/hash-test
cat > .claude/skills/hash-test/SKILL.md << 'EOF'
---
name: hash-test
metadata:
  sync:
    hash: sha256-abc123...
---
# Hash Test
EOF

# Modify the content to trigger out-of-sync detection
echo 'modified content' > .claude/skills/hash-test/SKILL.md

# Run sync - out-of-sync detected (content hash != stored hash)
npx tsx bin/sync-skills.ts
```

### Directory Structure After Sync

```
.agents-common/
├── config.json
└── skills/
    ├── skill-a/SKILL.md (full content)
    └── skill-b/SKILL.md (full content)

.claude/skills/
└── skill-a/SKILL.md (@.agents-common/... + sync metadata)

.codex/skills/
└── skill-a/SKILL.md (@.agents-common/...)
```

### Conflict Detection

Conflicts are detected when:
- Skills have different content between assistants
- Frontmatter differs

Use `--fail-on-conflict` to exit on conflicts, or resolve interactively.

## Running Unit Tests

```bash
# Run all tests
npm test

# Run specific test file
npx tsx --test test/config.test.ts
npx tsx --test test/integration.test.ts
```

## Manual Testing Checklist

- [ ] `--help` flag displays usage
- [ ] Auto-config works when folders exist
- [ ] Auto-config prompts when no folders exist
- [ ] `--reconfigure` opens interactive prompt
- [ ] `--home` uses `~/.claude`, `~/.codex`
- [ ] `--fail-on-conflict` exits with error on conflicts
- [ ] Skills are properly refactored to `.agents-common`
- [ ] Conflicts are detected and can be resolved
- [ ] Config persistence works across runs
