# Frontmatter Propagation Design

**Date**: 2025-01-12
**Status**: Design validated, ready for implementation

## Overview

When a skill in `.agents-common/skills/` has frontmatter, that frontmatter should be merged into the corresponding `.claude` and `.codex` skill frontmatters during sync operations. This enables central management of core skill metadata while allowing target-specific customization.

### Current Behavior

- `refactorSkill` copies only the **body** to `.agents-common`, leaving it without frontmatter
- `copySkill` performs raw file copies without frontmatter manipulation
- No frontmatter propagation exists

### New Behavior

1. **Refactor**: Copy core frontmatter fields to `.agents-common` along with the body
2. **Propagate**: Merge common frontmatter into target frontmatters after refactor and after conflict resolution
3. **Conflicts**: Prompt user interactively when both common and target define the same field with different values

## Frontmatter Categorization

### Copy to Common (Core Identity Fields)

These fields define what the skill IS and are shared across all targets:

| Field | Purpose |
|-------|---------|
| `name` | Skill identifier |
| `description` | When to invoke the skill |
| `license` | Legal terms |
| `compatibility` | Environment requirements |
| `metadata` | Custom metadata |
| `allowed-tools` | Tool permissions |

### Keep in Targets (Execution-Specific Fields)

These fields may differ between `.claude` and `.codex`:

| Field | Reason for target-specificity |
|-------|------------------------------|
| `sync` | Internal tracking, never copied to common |
| `model` | Target may need different models |
| `context` | Fork behavior may differ |
| `agent` | Agent type preference |
| `hooks` | Environment-specific |
| `user-invocable` | Visibility may differ |

## Merge Strategy

**Deep merge with conflict detection**:

1. Parse all frontmatters (common, claude, codex)
2. For each top-level field in common:
   - Field doesn't exist in target → copy from common
   - Field exists with identical values → no action
   - Field exists with different values → **conflict**, prompt user
3. Write merged frontmatter back to target

### Special Handling

- `sync` field → always preserved in target, never overwritten
- `allowed-tools` (list) → merge by union, don't prompt
- `hooks` (object) → deep merge by hook type
- `metadata` (object) → deep merge by key

### Conflict Prompt Format

```
Conflict in skill "{name}" for field "{field}":
  Common: {commonValue}
  Claude: {claudeValue}
Choose: (c)ommon, (l)aud[e], (s)kip all for this skill
```

## Implementation

### New Module: `src/propagator.js`

```javascript
import { promises as fs } from 'fs';
import matter from 'gray-matter';
import { parseSkillFile } from './parser.js';

const CORE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
const SKIP_FIELDS = ['sync'];

/**
 * Propagate frontmatter from common skill to target skills
 * @param {string} commonPath - Path to .agents-common skill
 * @param {string[]} targetPaths - Paths to target skills (.claude, .codex)
 * @param {object} options - { failOnConflict, dryRun, resolver }
 */
export async function propagateFrontmatter(commonPath, targetPaths, options = {}) {
  // Implementation details...
}

/**
 * Merge common frontmatter into target frontmatter
 * @returns { object } - Merged frontmatter and conflicts array
 */
function mergeFrontmatter(common, target) {
  // Implementation details...
}
```

### Changes to `src/syncer.js`

Update `refactorSkill` to copy core frontmatter to common:

```javascript
// Extract core frontmatter fields to copy to common
const coreFrontmatter = {};
for (const field of CORE_FIELDS) {
  if (parsed.data[field]) {
    coreFrontmatter[field] = parsed.data[field];
  }
}

// Write frontmatter + body to .agents-common
const commonContent = matter.stringify(parsed.content, coreFrontmatter);
await fs.writeFile(commonPath, commonContent);
```

### Changes to `src/index.js`

Call `propagateFrontmatter` after `refactorSkill` and after `copySkill`:

```javascript
// After refactorSkill
await propagateFrontmatter(commonPath, [skill.path], { failOnConflict, dryRun });

// After copySkill (conflict resolution)
await propagateFrontmatter(
  join(baseDir, '.agents-common/skills', conflict.skillName, 'SKILL.md'),
  [conflict.claudePath, conflict.codexPath],
  { failOnConflict, dryRun }
);
```

## Testing

### Unit Tests (`test/propagator.test.js`)

- Empty common frontmatter → targets unchanged
- New field in common → added to targets
- Conflicting field → user prompted (mock resolver)
- Special fields (`allowed-tools`, `hooks`) → merged correctly
- `sync` metadata → preserved in targets
- Core fields list respected (non-core fields not copied to common)

### Integration Test

- Create fake skills with frontmatter conflicts
- Run sync with dry-run
- Verify prompt is called for conflicts
- Verify merged frontmatter contains expected values

### Edge Cases

- Common file doesn't exist → silent no-op
- Target file doesn't exist → skip that target
- Invalid YAML in frontmatter → log error, skip file
- Common file has no frontmatter → targets unchanged

## Success Criteria

1. Core frontmatter fields are copied to `.agents-common` during refactor
2. Frontmatter propagates from common to targets on every sync
3. User is prompted for conflicting field values
4. Target-specific fields (`model`, `hooks`, etc.) are preserved
5. Dry-run mode reports changes without writing
