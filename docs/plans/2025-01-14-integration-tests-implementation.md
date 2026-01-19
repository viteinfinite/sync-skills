# Integration Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert TESTING.md manual testing procedures to automated integration tests with separate GitHub workflow job.

**Architecture:** Create `test/integration/` directory with test files mapping to TESTING.md scenarios, add test helpers, create separate GitHub workflow job, update package.json scripts.

**Tech Stack:** TypeScript, Node.js native test runner, sinon for stubbing

---

### Task 1: Create test helpers directory and utilities

**Files:**
- Create: `test/helpers/test-setup.ts`

**Step 1: Write test helper utilities**

```typescript
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import sinon from 'sinon';
import inquirer from 'inquirer';

/**
 * Create a temporary test fixture directory
 * @param name - Name for the test fixture
 * @param setup - Optional setup function to create files
 * @returns Absolute path to the test fixture directory
 */
export async function createTestFixture(
  name: string,
  setup?: (dir: string) => Promise<void>
): Promise<string> {
  const testDir = resolve(`./test/fixtures/${name}`);

  // Clean up any existing fixture
  await fs.rm(testDir, { recursive: true, force: true });

  // Create the directory
  await fs.mkdir(testDir, { recursive: true });

  // Run setup if provided
  if (setup) {
    await setup(testDir);
  }

  return testDir;
}

/**
 * Clean up a test fixture directory
 * @param dir - Absolute path to the test fixture directory
 */
export async function cleanupTestFixture(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/**
 * Stub inquirer.prompt to avoid interactive prompts
 * @param responses - Map of question names to resolved values
 * @returns Sinon stub that can be restored
 */
export function stubInquirer(responses: Record<string, unknown>): sinon.SinonStub {
  return sinon.stub(inquirer, 'prompt').callsFake(async (questions: unknown) => {
    const qs = questions as Array<{ name: string }>;
    const q = qs[0];
    if (q && q.name in responses) {
      return { [q.name]: responses[q.name] };
    }
    throw new Error(`No stub response for question: ${q.name}`);
  });
}

/**
 * Create a skill file with content
 * @param dir - Base directory
 * @param assistant - Assistant name (e.g., '.claude')
 * @param skillName - Name of the skill
 * @param content - Content of the skill file
 */
export async function createSkillFile(
  dir: string,
  assistant: string,
  skillName: string,
  content: string
): Promise<void> {
  const skillDir = join(dir, assistant, 'skills', skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');
}

/**
 * Read a skill file content
 * @param dir - Base directory
 * @param assistant - Assistant name (e.g., '.claude')
 * @param skillName - Name of the skill
 * @returns Content of the skill file
 */
export async function readSkillFile(
  dir: string,
  assistant: string,
  skillName: string
): Promise<string> {
  const skillPath = join(dir, assistant, 'skills', skillName, 'SKILL.md');
  return await fs.readFile(skillPath, 'utf-8');
}

/**
 * Create a common skill file in .agents-common
 * @param dir - Base directory
 * @param skillName - Name of the skill
 * @param content - Content of the skill file
 */
export async function createCommonSkill(
  dir: string,
  skillName: string,
  content: string
): Promise<void> {
  const skillDir = join(dir, '.agents-common/skills', skillName);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');
}
```

**Step 2: Commit**

```bash
git add test/helpers/
git commit -m "test: add test helper utilities for integration tests

Add test-setup.ts with utilities for:
- Creating and cleaning up test fixtures
- Stubbing inquirer prompts
- Creating skill files for testing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create auto-config integration test

**Files:**
- Create: `test/integration/auto-config.test.ts`

**Step 1: Write auto-config test**

```typescript
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, cleanupTestFixture, stubInquirer } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer>;

test.beforeEach(() => {
  promptStub = stubInquirer({});
});

test.afterEach(async () => {
  promptStub.restore();
  await fs.rm(resolve('.agents-common'), { recursive: true, force: true });
});

test('Integration: Auto-configuration - should auto-create config when folders exist', async () => {
  const testDir = await createTestFixture('auto-config-folders-exist', async (dir) => {
    // Create .claude folder with skills
    await createSkillFile(dir, '.claude', 'test-skill', '@test');
  });

  // Import after setup to ensure fresh module
  const { run } = await import('../../src/index.js');

  // Run sync (should auto-create config)
  await run({ baseDir: testDir });

  // Check config was created
  const { readConfig } = await import('../../src/config.js');
  const config = await readConfig(testDir);

  assert.ok(config);
  assert.deepEqual(config?.assistants, ['claude']);

  await cleanupTestFixture(testDir);
});

test('Integration: Auto-configuration - should prompt when no folders exist', async () => {
  // Create empty directory
  const testDir = await createTestFixture('auto-config-no-folders');

  // Stub inquirer to select claude
  promptStub = stubInquirer({ assistants: ['claude'] });

  // This should prompt and create config
  try {
    await run({ baseDir: testDir });
  } catch (e) {
    // May exit if no config
  }

  const { readConfig } = await import('../../src/config.js');
  const config = await readConfig(testDir);

  assert.ok(config);
  assert.deepEqual(config?.assistants, ['claude']);

  await cleanupTestFixture(testDir);
});
```

**Step 2: Run test to verify it works**

Run: `npx tsx --test test/integration/auto-config.test.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add test/integration/auto-config.test.ts
git commit -m "test: add auto-config integration tests

Add tests for:
- Auto-configuration when assistant folders exist
- Prompting user when no folders exist

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create sync workflow integration test

**Files:**
- Create: `test/integration/sync-workflow.test.ts`

**Step 1: Write sync workflow test**

```typescript
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, createCommonSkill, readSkillFile, cleanupTestFixture, stubInquirer } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer>;

test.beforeEach(() => {
  promptStub = stubInquirer({ action: 'keep-both' });
});

test.afterEach(() => {
  promptStub.restore();
});

test('Integration: Full Sync Workflow - should refactor skills to .agents-common', async () => {
  const testDir = await createTestFixture('sync-full', async (dir) => {
    // Create skills in both assistants
    await createSkillFile(dir, '.claude', 'my-skill', `---
name: my-skill
description: A test skill
---

# My Skill

Claude version`);
    await createSkillFile(dir, '.codex', 'my-skill', `---
name: my-skill
description: A test skill
---

# My Skill

Codex version`);
  });

  await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

  // Verify .claude skill was refactored
  const claudeContent = await readSkillFile(testDir, '.claude', 'my-skill');
  assert.ok(claudeContent.includes('@.agents-common/skills/my-skill/SKILL.md'));
  assert.ok(claudeContent.includes('managed-by: sync-skills'));

  // Verify .codex skill was refactored
  const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
  assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  // Verify common skill exists with frontmatter
  const commonContent = await fs.readFile(join(testDir, '.agents-common/skills/my-skill/SKILL.md'), 'utf8');
  assert.ok(commonContent.includes('---'));
  assert.ok(commonContent.includes('name: my-skill'));

  await cleanupTestFixture(testDir);
});

test('Integration: Sync - should detect conflicts between skills', async () => {
  const testDir = await createTestFixture('sync-conflict', async (dir) => {
    await createSkillFile(dir, '.claude', 'conflicting-skill', 'Claude content');
    await createSkillFile(dir, '.codex', 'conflicting-skill', 'Codex content');
  });

  // Run with conflict detection
  await run({ baseDir: testDir, failOnConflict: false });

  // Verify conflict was handled
  const claudeContent = await readSkillFile(testDir, '.claude', 'conflicting-skill');
  assert.ok(claudeContent.includes('@.agents-common'));

  await cleanupTestFixture(testDir);
});
```

**Step 2: Run test to verify it works**

Run: `npx tsx --test test/integration/sync-workflow.test.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add test/integration/sync-workflow.test.ts
git commit -m "test: add sync workflow integration tests

Add tests for:
- Full sync workflow refactoring skills to .agents-common
- Conflict detection between assistant skills

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Create scenarios integration test

**Files:**
- Create: `test/integration/scenarios.test.ts`

**Step 1: Write scenarios test**

```typescript
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { run } from '../../src/index.js';
import { createTestFixture, createSkillFile, createCommonSkill, cleanupTestFixture, stubInquirer } from '../helpers/test-setup.js';

let promptStub: ReturnType<typeof stubInquirer>;

test.beforeEach(() => {
  promptStub = stubInquirer({});
});

test.afterEach(() => {
  promptStub.restore();
});

test('Integration: Scenario 1 - .codex folder missing should prompt user', async () => {
  promptStub = stubInquirer({ create: true });

  const testDir = await createTestFixture('scenario1', async (dir) => {
    await createSkillFile(dir, '.claude', 'my-skill', '@test');
  });

  await run({ baseDir: testDir });

  // Verify .codex/skills was created
  const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
  assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  await cleanupTestFixture(testDir);
});

test('Integration: Scenario 2 - .codex folder exists should auto-create', async () => {
  const testDir = await createTestFixture('scenario2', async (dir) => {
    await createSkillFile(dir, '.claude', 'my-skill', '@test');
    await fs.mkdir(join(dir, '.codex'), { recursive: true });
  });

  await run({ baseDir: testDir });

  // Verify .codex/skills was created without prompt
  const codexContent = await readSkillFile(testDir, '.codex', 'my-skill');
  assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  await cleanupTestFixture(testDir);
});

test('Integration: Scenario 3 - no skills should exit silently', async () => {
  const testDir = await createTestFixture('scenario3', async (dir) => {
    // Empty directory
  });

  await run({ baseDir: testDir });

  // Verify no directories were created
  const codexExists = await fs.access(join(testDir, '.codex')).then(() => true).catch(() => false);
  const claudeExists = await fs.access(join(testDir, '.claude')).then(() => true).catch(() => false);
  assert.ok(!codexExists);
  assert.ok(!claudeExists);

  await cleanupTestFixture(testDir);
});

test('Integration: Bidirectional - sync from .codex to .claude', async () => {
  promptStub = stubInquirer({ create: true });

  const testDir = await createTestFixture('bidirectional', async (dir) => {
    await createSkillFile(dir, '.codex', 'codex-skill', '@test');
    await createCommonSkill(dir, 'codex-skill', '# Codex Skill');
  });

  await run({ baseDir: testDir });

  // Verify .claude/skills was created
  const claudeContent = await readSkillFile(testDir, '.claude', 'codex-skill');
  assert.ok(claudeContent.includes('@.agents-common/skills/codex-skill/SKILL.md'));

  await cleanupTestFixture(testDir);
});
```

**Step 2: Run test to verify it works**

Run: `npx tsx --test test/integration/scenarios.test.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add test/integration/scenarios.test.ts
git commit -m "test: add scenarios integration tests

Add tests for edge cases:
- Missing assistant folders prompting user
- Auto-creation when folder exists
- Silent exit when no skills exist
- Bidirectional sync between assistants

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Update GitHub workflow with separate integration job

**Files:**
- Modify: `.github/workflows/test.yml`

**Step 1: Update workflow**

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

  integration-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npx tsx --test test/integration/*.test.ts
```

**Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add separate integration tests job in GitHub workflow

Split tests into two jobs:
- unit-tests: runs test/config.test.ts
- integration-tests: runs test/integration/*.test.ts

Jobs run in parallel for faster feedback.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Update package.json scripts

**Files:**
- Modify: `package.json`

**Step 1: Update scripts section**

```json
{
  "scripts": {
    "test": "tsx --test test/config.test.ts",
    "test:integration": "tsx --test test/integration/*.test.ts",
    "test:all": "npm test && npm run test:integration",
    "test:clean": "rm -rf test/fixtures/*/ .agents-common"
  }
}
```

**Step 2: Run all tests to verify**

Run: `npm run test:all`
Expected: All tests pass

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update npm scripts for integration tests

Add separate scripts for:
- test: unit tests only
- test:integration: integration tests only
- test:all: run both test suites

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Push and verify with gh

**Step 1: Push commits**

```bash
git push
```

**Step 2: Verify with gh**

```bash
gh run list --limit 5
gh run view
```

**Step 3: Check both jobs pass**

Wait for GitHub Actions to complete. Both `unit-tests` and `integration-tests` jobs should pass.

**Step 4: Observe workflow results**

```bash
gh run view --log
```

---

## Summary

This plan implements the integration tests in 7 commits:
1. Test helper utilities
2. Auto-config integration tests
3. Sync workflow integration tests
4. Scenarios integration tests
5. GitHub workflow with separate jobs
6. Updated package.json scripts
7. Push and verify

All tests run in parallel in CI for faster feedback.
