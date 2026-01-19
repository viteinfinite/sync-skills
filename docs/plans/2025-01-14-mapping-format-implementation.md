# Mapping Format Change Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change the assistant mapping format from `{assistant: folder}` to `{assistant: folder/skills}` to support assistants with non-standard skill folder names.

**Architecture:** Update `ASSISTANT_MAP` to include full skills path, modify `getAssistantConfigs()` to parse the path instead of appending `/skills`, and update `detectAvailableAssistants()` to extract the folder portion.

**Tech Stack:** TypeScript, Node.js native test runner

---

### Task 1: Update ASSISTANT_MAP with full skills paths

**Files:**
- Modify: `src/types.ts:128-131`

**Step 1: Update ASSISTANT_MAP values**

```typescript
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude/skills',
  'codex': '.codex/skills',
};
```

**Step 2: Run existing tests to verify breakage**

Run: `npm test`
Expected: Tests will fail because `getAssistantConfigs` still appends `/skills`

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: update ASSISTANT_MAP to include full skills paths

Change mapping format from 'folder' to 'folder/skills' to support
assistants with non-standard skill folder names.

This breaks getAssistantConfigs - will fix in next commit.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Update getAssistantConfigs to parse path

**Files:**
- Modify: `src/types.ts:138-161`
- Test: `test/config.test.ts`

**Step 1: Write test for new parsing behavior**

Create `test/config.test.ts` (or append to existing):

```typescript
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { getAssistantConfigs, ASSISTANT_MAP } from '../src/types.js';

test('getAssistantConfigs - parses full skills path correctly', () => {
  const configs = getAssistantConfigs(['claude']);

  assert.strictEqual(configs.length, 1);
  assert.strictEqual(configs[0].name, 'claude');
  assert.strictEqual(configs[0].dir, '.claude');  // folder before /skills
  assert.strictEqual(configs[0].skillsDir, '.claude/skills');  // full path
});

test('getAssistantConfigs - supports non-standard skill folder names', () => {
  // Add a custom assistant for testing
  const originalMap = { ...ASSISTANT_MAP };
  (ASSISTANT_MAP as Record<string, string>)['custom'] = '.custom-agent/prompts';

  const configs = getAssistantConfigs(['custom']);

  assert.strictEqual(configs[0].name, 'custom');
  assert.strictEqual(configs[0].dir, '.custom-agent');
  assert.strictEqual(configs[0].skillsDir, '.custom-agent/prompts');

  // Restore
  Object.assign(ASSISTANT_MAP, originalMap);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test test/config.test.ts`
Expected: FAIL - paths are wrong

**Step 3: Implement the parsing logic**

Replace `getAssistantConfigs` in `src/types.ts`:

```typescript
export function getAssistantConfigs(names?: string[]): AssistantConfig[] {
  const requested = names || Object.keys(ASSISTANT_MAP);
  const valid: AssistantConfig[] = [];
  const invalid: string[] = [];

  for (const name of requested) {
    if (name in ASSISTANT_MAP) {
      const skillsPath = ASSISTANT_MAP[name];
      // Extract the folder name (first path segment)
      const folder = skillsPath.split('/')[0];

      valid.push({
        name,
        dir: folder,
        skillsDir: skillsPath
      });
    } else {
      invalid.push(name);
    }
  }

  if (invalid.length > 0) {
    console.warn(`Warning: Invalid assistant names ignored: ${invalid.join(', ')}`);
    console.warn(`Valid assistants: ${Object.keys(ASSISTANT_MAP).join(', ')}`);
  }

  return valid;
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test test/config.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/types.ts test/config.test.ts
git commit -m "feat: parse full skills path in getAssistantConfigs

Update getAssistantConfigs to parse the folder and skillsDir from
the full path in ASSISTANT_MAP (e.g., '.claude/skills' -> dir='.claude',
skillsDir='.claude/skills').

This supports assistants with non-standard skill folder names like
'.custom-agent/prompts'.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Update detectAvailableAssistants to use folder portion

**Files:**
- Modify: `src/config.ts:119-136`
- Test: `test/config.test.ts`

**Step 1: Write test for folder detection**

```typescript
import { detectAvailableAssistants } from '../src/config.js';
import { promises as fs } from 'fs';
import { join } from 'path';

test('detectAvailableAssistants - detects by folder name not skills path', async () => {
  const testDir = './test/fixtures/detect-test';

  // Create .claude folder (no skills subfolder needed for detection)
  await fs.mkdir(join(testDir, '.claude'), { recursive: true });

  const detected = await detectAvailableAssistants(testDir);

  assert.ok(detected.includes('claude'));
  assert.ok(!detected.includes('codex'));

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});
```

**Step 2: Run test to verify current behavior**

Run: `npx tsx --test test/config.test.ts`
Expected: May pass or fail depending on current implementation

**Step 3: Update detectAvailableAssistants to extract folder**

Replace in `src/config.ts`:

```typescript
export async function detectAvailableAssistants(baseDir: string): Promise<string[]> {
  const available: string[] = [];

  for (const [name, skillsPath] of Object.entries(ASSISTANT_MAP)) {
    // Extract the folder name (first path segment before /)
    const folder = skillsPath.split('/')[0];
    const dir = join(baseDir, folder);

    try {
      await fs.access(dir);
      available.push(name);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error; // Re-throw unexpected errors
      }
      // Folder doesn't exist, skip
    }
  }

  return available;
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test test/config.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/config.ts test/config.test.ts
git commit -m "feat: detect assistants by folder name from skills path

Update detectAvailableAssistants to extract the folder name from
the full skills path (e.g., '.claude/skills' -> '.claude') when
checking for folder existence.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Update ASSISTANTS constant for consistency

**Files:**
- Modify: `src/types.ts:116-119`

**Step 1: Update deprecated ASSISTANTS constant**

```typescript
export const ASSISTANTS: readonly AssistantConfig[] = [
  { name: 'claude', dir: '.claude', skillsDir: '.claude/skills' },
  { name: 'codex', dir: '.codex', skillsDir: '.codex/skills' }
] as const;
```

**Step 2: Run tests**

Run: `npm test`
Expected: PASS (no changes to behavior, just consistency)

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "chore: update ASSISTANTS constant for consistency

Update the deprecated ASSISTANTS constant to match new format
though it should not be used.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Push and verify with gh

**Step 1: Push commits**

```bash
git push
```

**Step 2: Verify with gh**

```bash
gh pr status  # If on a branch
gh run list   # Check GitHub Actions status
```

**Step 3: Verify tests pass in CI**

Wait for GitHub Actions to complete. All tests should pass.

---

## Summary

This plan implements the mapping format change in 5 small commits:
1. Update ASSISTANT_MAP values (breaks tests intentionally)
2. Fix getAssistantConfigs parsing
3. Fix detectAvailableAssistants folder extraction
4. Update deprecated ASSISTANTS constant
5. Push and verify

Each commit is tested and can be pushed separately.
