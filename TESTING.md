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
# Dry-run to see what would happen
npx tsx bin/sync-skills.ts --dry-run

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
- If assistant folders exist → Auto-create config with detected assistants
- If no folders exist → Prompt user to select assistants

### Sync Process

1. **Phase 1 - Discovery:** Detect which assistants have skills
2. **Phase 2 - Bidirectional Sync:** Create missing assistant folders
3. **Phase 3 - Refactoring:** Move skills without `@` references to `.agents-common`
4. **Phase 4 - Conflict Resolution:** Detect and resolve skill conflicts
5. **Phase 5 - Frontmatter Propagation:** Sync frontmatter from common to targets

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
- [ ] `--dry-run` shows changes without applying
- [ ] `--fail-on-conflict` exits with error on conflicts
- [ ] Skills are properly refactored to `.agents-common`
- [ ] Conflicts are detected and can be resolved
- [ ] Config persistence works across runs
