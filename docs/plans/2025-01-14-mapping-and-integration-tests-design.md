# Mapping Format & Integration Tests Design

**Date:** 2025-01-14

## Overview

This document describes two features:
1. Change the assistant mapping format to include full skills folder path
2. Convert TESTING.md to automated integration tests with separate GitHub workflow job

## Feature 1: Mapping Format Change

### Current State

```typescript
// src/types.ts
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude',
  'codex': '.codex',
};

// getAssistantConfigs appends /skills
skillsDir: `${ASSISTANT_MAP[name]}/skills`
```

### New Design

```typescript
// src/types.ts
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude/skills',
  'codex': '.codex/skills',
  // Supports non-standard paths:
  // 'custom': '.custom-agent/prompts',
  // 'another': '.another/abilities',
};

// getAssistantConfigs now parses the path
function parseAssistantPath(name: string, path: string): AssistantConfig {
  const parts = path.split('/');
  const dir = parts[0]; // e.g., '.claude'
  const skillsDir = path; // full path, e.g., '.claude/skills'
  return { name, dir, skillsDir };
}
```

### Changes Required

1. **src/types.ts**: Update `ASSISTANT_MAP` values to include `/skills`
2. **src/types.ts**: Update `getAssistantConfigs()` to parse full path instead of appending
3. **src/config.ts**: Update `detectAvailableAssistants()` to check folder portion (before `/skills`)
4. No migration needed (app not yet released)

## Feature 2: Integration Tests

### New Test Structure

```
test/
├── integration/
│   ├── auto-config.test.ts      # Auto-configuration scenarios
│   ├── sync-workflow.test.ts    # Full sync workflow (refactor, conflicts)
│   ├── scenarios.test.ts        # Edge cases (missing folders, no skills)
│   └── reconfigure.test.ts      # Reconfiguration flow
├── helpers/
│   └── test-setup.ts            # Test utilities
└── config.test.ts              # Existing unit tests
```

### Test Content Mapping

| TESTING.md Section | Test File | Key Scenarios |
|-------------------|-----------|---------------|
| Auto-Configuration | `auto-config.test.ts` | Folders exist → auto-create config; No folders → prompt user |
| Run Sync (Phases 1-5) | `sync-workflow.test.ts` | Refactor skills, detect conflicts, propagate frontmatter |
| Test Scenarios 1-5 | `scenarios.test.ts` | Missing folders, empty skills, bidirectional sync |
| Test Reconfiguration | `reconfigure.test.ts` | `--reconfigure` flag updates config |

### Test Utilities

```typescript
// test/helpers/test-setup.ts
export async function createTestFixture(name: string, setup: (dir: string) => Promise<void>): Promise<string>
export async function cleanupTestFixture(dir: string): Promise<void>
export function stubInquirer(responses: Record<string, unknown>): sinon.SinonStub
```

## Feature 3: GitHub Workflow

### New Workflow Structure

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node
      - npm ci
      - run: npm test  # runs test/config.test.ts only

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node
      - npm ci
      - run: npx tsx --test test/integration/*.test.ts
```

### Updated package.json Scripts

```json
{
  "scripts": {
    "test": "tsx --test test/config.test.ts",
    "test:integration": "tsx --test test/integration/*.test.ts",
    "test:all": "npm test && npm run test:integration"
  }
}
```

### Benefits

- Parallel execution of unit and integration tests
- Easy to identify which test suite is failing
- Developers can run integration tests separately when needed
