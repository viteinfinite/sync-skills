# sync-skills Design Document

## Overview

`syntax-skills` is an npm package (runnable via npx) that synchronizes agent skill definitions between `.claude/` and `.codex/` directories. It extracts common content to `.agents-common/` and uses `@`-based static linking for shared definitions.

**Key features:**
- Bidirectional sync between `.claude/` and `.codex/` skills
- Automatic refactoring: extracts shared content to `.agents-common/`
- Interactive conflict resolution
- Fail-fast mode for CI/CD (pre-commit hooks)
- Watch mode for continuous synchronization

## Project Structure

```
your-project/
├── .agents-common/               # Shared skill content (no frontmatter)
│   └── skills/
│       └── pr-review/
│           └── SKILL.md          # Pure markdown content
├── .claude/
│   └── skills/
│       └── pr-review/
│           └── SKILL.md          # Frontmatter + @ reference
└── .codex/
    └── skills/
        └── pr-review/
            └── SKILL.md          # Frontmatter + @ reference
```

## File Format

### Source File (`.agents-common/skills/*/SKILL.md`)

Pure markdown content, no frontmatter:

```markdown
# PR Review

## Instructions

Review pull requests by checking:
- Code quality
- Test coverage
- Documentation
```

### Target Files (`.claude/skills/*/SKILL.md`, `.codex/skills/*/SKILL.md`)

Frontmatter + `@` reference:

```yaml
---
name: pr-review
description: Review PRs using team standards
metadata:
  sync:
    managed-by: sync-skills
    refactored: 2025-01-11T10:30:00Z
---

@.agents-common/skills/pr-review/SKILL.md
```

**Note:** The `@` reference syntax is a built-in feature of the agent skill system - this tool does not implement `@` resolution.

## CLI Interface

```bash
# Basic sync (interactive conflict resolution)
npx sync-skills

# Non-interactive mode (fails on conflicts)
npx sync-skills --fail-on-conflict

# Dry run (show what would change)
npx sync-skills --dry-run

# Help
npx sync-skills --help
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or no changes needed) |
| 1 | Conflict with `--fail-on-conflict` |
| 2 | File system error |

### Pre-commit Hook Integration

```bash
# .husky/pre-commit
npx sync-skills --fail-on-conflict || exit 1
```

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────┐
│           sync-skills CLI               │
├─────────────────────────────────────────┤
│                                          │
│  ┌─────────────┐  ┌──────────────┐      │
│  │  Config     │  │  File        │      │
│  │  Loader     │→ │  Scanner     │      │
│  └─────────────┘  └──────────────┘      │
│                           │              │
│                           ▼              │
│                  ┌──────────────┐        │
│                  │   Parser     │        │
│                  │ (split       │        │
│                  │  frontmatter)│        │
│                  └──────────────┘        │
│                           │              │
│                           ▼              │
│                  ┌──────────────┐        │
│                  │  Conflict    │        │
│                  │  Detector    │        │
│                  └──────────────┘        │
│                           │              │
│                           ▼              │
│                  ┌──────────────┐        │
│                  │  Resolution  │        │
│                  │  Handler     │        │
│                  └──────────────┘        │
│                           │              │
│                           ▼              │
│                  ┌──────────────┐        │
│                  │  Refactor    │        │
│                  │  + Sync      │        │
│                  └──────────────┘        │
└─────────────────────────────────────────┘
```

### Package Structure

```
sync-skills/
├── package.json
├── README.md
├── bin/
│   └── sync-skills.js          # CLI entry point
├── src/
│   ├── config.js               # Config loader
│   ├── scanner.js              # File scanner
│   ├── parser.js               # Frontmatter parser
│   ├── detector.js             # Conflict detector
│   ├── resolver.js             # Interactive prompter
│   ├── syncer.js               # File copier + refactor
│   └── utils.js                # Helpers (hash, diff)
└── test/
    └── sync-skills.test.js
```

### Dependencies

```json
{
  "dependencies": {
    "chalk": "^5.3",       // Terminal colors
    "inquirer": "^9.2",    // Interactive prompts
    "ora": "^7.0",         // Spinners
    "minimist": "^1.2",    // CLI arg parsing
    "gray-matter": "^4.0"  // Frontmatter parser
  },
  "bin": {
    "sync-skills": "./bin/sync-skills.js"
  }
}
```

## Workflow

### 1. Scan Phase

Discover all skill files in target directories:

```
.claude/skills/*.md    →  List of skill files
.codex/skills/*.md     →  List of skill files
.agents-common/skills/*.md  →  Common content files
```

### 2. Parse Phase

For each skill file, split into frontmatter and body:

```javascript
// Input:
---
name: pr-review
description: ...
---

# PR Review
Full content...

// Output:
{
  frontmatter: { name: 'pr-review', description: '...' },
  body: '# PR Review\nFull content...',
  hasAtReference: false
}
```

### 3. Refactor Phase

If a skill doesn't have an `@` reference, extract its body to `.agents-common/`:

**Before:**
```yaml
# .claude/skills/pr-review/SKILL.md
---
name: pr-review
description: ...
---

# PR Review
Full content...
```

**After:**
```yaml
# .claude/skills/pr-review/SKILL.md
---
name: pr-review
description: ...
metadata:
  sync:
    managed-by: sync-skills
    refactored: 2025-01-11T10:30:00Z
---

@.agents-common/skills/pr-review/SKILL.md
```

```markdown
# .agents-common/skills/pr-review/SKILL.md (created)

# PR Review
Full content...
```

### 4. Conflict Detection

Compare skill content across `.claude` and `.codex` by file hash:

```javascript
const hash1 = hashFile('.claude/skills/pr-review/SKILL.md');
const hash2 = hashFile('.codex/skills/pr-review/SKILL.md');

if (hash1 !== hash2) {
  // Conflict detected - prompt user
}
```

### 5. Conflict Resolution (Interactive)

```
⚠️  Conflict detected:
   .claude/skills/pr-review/SKILL.md has local changes
   .codex/skills/pr-review/SKILL.md has different content

Choose resolution:
  [1] Use .claude version (overwrite .codex)
  [2] Use .codex version (overwrite .claude)
  [3] Keep both unchanged
  [4] Show diff
  [q] Abort
```

### 6. Sync Phase

Copy files between directories based on resolution:

```javascript
fs.copyFileSync(source, destination);
```

## Implementation Details

### Parser Logic

```javascript
function parseSkillFile(content) {
  const matter = require('gray-matter');
  const parsed = matter(content);

  return {
    frontmatter: parsed.data,
    body: parsed.content,
    hasAtReference: parsed.content.trim().startsWith('@')
  };
}
```

### Refactor Logic

```javascript
function refactorSkill(sourcePath, targetAgent) {
  const content = fs.readFileSync(sourcePath, 'utf8');
  const parsed = parseSkillFile(content);

  if (!parsed || parsed.hasAtReference) return;

  const skillName = path.basename(path.dirname(sourcePath));
  const commonPath = `.agents-common/skills/${skillName}/SKILL.md`;

  // 1. Write body to .agents-common
  fs.mkdirSync(path.dirname(commonPath), { recursive: true });
  fs.writeFileSync(commonPath, parsed.body);

  // 2. Add metadata to frontmatter
  parsed.frontmatter.metadata = parsed.frontmatter.metadata || {};
  parsed.frontmatter.metadata.sync = {
    managed-by: 'sync-skills',
    refactored: new Date().toISOString()
  };

  // 3. Replace body with @ reference in source
  const matter = require('gray-matter');
  const newContent = matter.stringify(`@${commonPath}\n`, parsed.frontmatter);
  fs.writeFileSync(sourcePath, newContent);
}
```

## Metadata Schema

Skills managed by sync-skills include a `metadata.sync` field in their frontmatter:

```yaml
metadata:
  sync:
    managed-by: sync-skills    # Identifier for the tool
    refactored: string          # ISO 8601 timestamp of last refactor
```

This metadata:
- Identifies files under sync-skills management
- Tracks when content was extracted to `.agents-common/`
- Reserved for future enhancements (hash, version, etc.)

## Future Enhancements

Potential additions to the metadata schema:

```yaml
metadata:
  sync:
    managed-by: sync-skills
    refactored: 2025-01-11T10:30:00Z
    content-hash: abc123...    # Hash of .agents-common content
    version: 1.0               # Schema version
```
