# Configuration System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add persistent configuration, reconfigure command, and home directory support to sync-skills

**Architecture:**
- New `src/config.ts` module for config read/write and reconfigure flow
- `ASSISTANT_MAP` in `src/types.ts` for extensible assistant definitions
- Updated CLI in `bin/sync-skills.ts` to parse `--home` and `--reconfigure` flags
- Modified `src/index.ts` to handle flags and load config before sync

**Tech Stack:**
- TypeScript with ES modules
- inquirer for interactive prompts
- Node.js fs promises for file operations

---

### Task 1: Add ASSISTANT_MAP to types.ts

**Files:**
- Modify: `src/types.ts`

**Step 1: Add ASSISTANT_MAP constant**

Add after the `ASSISTANTS` constant export (around line 108):

```typescript
/**
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 */
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude',
  'codex': '.codex',
};
```

**Step 2: Add getAssistantConfigs helper function**

Add after the ASSISTANT_MAP constant:

```typescript
/**
 * Get AssistantConfig[] from assistant names
 * @param names - Optional array of assistant names. If omitted, returns all.
 * @returns Array of AssistantConfig objects
 */
export function getAssistantConfigs(names?: string[]): AssistantConfig[] {
  const enabled = names || Object.keys(ASSISTANT_MAP);
  return enabled.map(name => ({
    name,
    dir: ASSISTANT_MAP[name],
    skillsDir: `${ASSISTANT_MAP[name]}/skills`
  }));
}
```

**Step 3: Update RunOptions interface**

Add to the `RunOptions` interface (around line 55):

```typescript
/** Use home directory instead of cwd (default: false) */
homeMode?: boolean;
/** Run reconfiguration flow (default: false) */
reconfigure?: boolean;
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add ASSISTANT_MAP and getAssistantConfigs helper

Add configurable map for easy assistant extension and update RunOptions
for --home and --reconfigure flags."
```

---

### Task 2: Create config.ts module with config interfaces and basic functions

**Files:**
- Create: `src/config.ts`

**Step 1: Create file with types and basic imports**

```typescript
import { promises as fs } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import { ASSISTANT_MAP, getAssistantConfigs } from './types.js';

/**
 * Configuration file structure
 */
export interface Config {
  /** Schema version for migrations */
  version: number;
  /** Enabled assistant names */
  assistants: string[];
}

/** Path to config file relative to base directory */
export const CONFIG_PATH = '.agents-common/config.json';
```

**Step 2: Add readConfig function**

```typescript
/**
 * Read configuration file
 * @param baseDir - Base directory to read from
 * @returns Config object or null if file doesn't exist
 */
export async function readConfig(baseDir: string): Promise<Config | null> {
  const configPath = join(baseDir, CONFIG_PATH);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as Config;

    // Validate structure
    if (!Array.isArray(config.assistants)) {
      throw new Error('Invalid config: assistants must be an array');
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist
      return null;
    }
    // JSON parse error or other - return null to trigger recreation
    console.warn('Config file is corrupted, will recreate');
    return null;
  }
}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add config module with readConfig function"
```

---

### Task 3: Add writeConfig function

**Files:**
- Modify: `src/config.ts`

**Step 1: Add writeConfig function**

Add after readConfig function:

```typescript
/**
 * Write configuration file
 * @param baseDir - Base directory to write to
 * @param config - Config object to write
 */
export async function writeConfig(baseDir: string, config: Config): Promise<void> {
  const configPath = join(baseDir, CONFIG_PATH);
  const configDir = join(baseDir, '.agents-common');

  // Ensure .agents-common directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write config with pretty formatting
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add writeConfig function"
```

---

### Task 4: Add detectAvailableAssistants function

**Files:**
- Modify: `src/config.ts`

**Step 1: Add detectAvailableAssistants function**

Add after writeConfig function:

```typescript
/**
 * Detect which assistant folders exist in the directory
 * @param baseDir - Base directory to scan
 * @returns Array of assistant names that have folders present
 */
export async function detectAvailableAssistants(baseDir: string): Promise<string[]> {
  const available: string[] = [];

  for (const [name, folder] of Object.entries(ASSISTANT_MAP)) {
    const dir = join(baseDir, folder);
    try {
      await fs.access(dir);
      available.push(name);
    } catch {
      // Folder doesn't exist, skip
    }
  }

  return available;
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add detectAvailableAssistants function"
```

---

### Task 5: Add reconfigure function

**Files:**
- Modify: `src/config.ts`

**Step 1: Add reconfigure function**

Add after detectAvailableAssistants function:

```typescript
/**
 * Interactive reconfiguration flow
 * @param baseDir - Base directory for config
 */
export async function reconfigure(baseDir: string): Promise<void> {
  // Detect which folders exist for pre-selection
  const detected = await detectAvailableAssistants(baseDir);

  // Read existing config or default to detected folders
  const existingConfig = await readConfig(baseDir);
  const currentlyEnabled = existingConfig?.assistants || detected;

  // Build choices for all available assistants
  const choices = Object.keys(ASSISTANT_MAP).map(name => ({
    name: name,
    checked: currentlyEnabled.includes(name)
  }));

  // Interactive checkbox prompt
  const answer = await inquirer.prompt([{
    type: 'checkbox',
    name: 'assistants',
    message: 'Select assistants to sync:',
    choices: choices,
    validate: (input: string[]) => {
      return input.length > 0 || 'Please select at least one assistant';
    }
  }]);

  const selected = answer.assistants as string[];

  // Write new config
  await writeConfig(baseDir, {
    version: 1,
    assistants: selected
  });

  console.log(`Configured assistants: ${selected.join(', ')}`);
}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add reconfigure function for interactive setup"
```

---

### Task 6: Add ensureConfig function

**Files:**
- Modify: `src/config.ts`

**Step 1: Add ensureConfig function**

Add after reconfigure function:

```typescript
/**
 * Ensure config exists, create if needed
 * @param baseDir - Base directory for config
 * @returns Config object
 */
export async function ensureConfig(baseDir: string): Promise<Config> {
  // Check if config already exists
  const existing = await readConfig(baseDir);
  if (existing) {
    return existing;
  }

  // Detect which assistant folders exist
  const detected = await detectAvailableAssistants(baseDir);

  let assistants: string[];

  if (detected.length === 0) {
    // No folders exist - prompt user to select
    console.log('No assistant folders found.');

    const answer = await inquirer.prompt([{
      type: 'checkbox',
      name: 'assistants',
      message: 'Select assistants to set up:',
      choices: Object.keys(ASSISTANT_MAP),
      validate: (input: string[]) => {
        return input.length > 0 || 'Please select at least one assistant';
      }
    }]);

    assistants = answer.assistants as string[];
  } else {
    // Folders exist - auto-create config
    assistants = detected;
    console.log(`Auto-configured assistants: ${detected.join(', ')}`);
  }

  // Create and save config
  const config: Config = { version: 1, assistants };
  await writeConfig(baseDir, config);

  return config;
}
```

**Step 2: Export getEnabledAssistants helper**

Add at end of file:

```typescript
/**
 * Get AssistantConfig[] from Config
 * @param config - Config object
 * @returns Array of AssistantConfig for enabled assistants
 */
export function getEnabledAssistants(config: Config): ReturnType<typeof getAssistantConfigs> {
  return getAssistantConfigs(config.assistants);
}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): add ensureConfig for auto-configuration"
```

---

### Task 7: Update index.ts to use config

**Files:**
- Modify: `src/index.ts`

**Step 1: Add new imports**

Add to existing imports at top:

```typescript
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
```

**Step 2: Update run function signature and destructure**

Update the `run` function (around line 12):

```typescript
export async function run(options: RunOptions = {}): Promise<void> {
  let {
    baseDir = process.cwd(),
    failOnConflict = false,
    dryRun = false,
    homeMode = false,
    reconfigure = false
  } = options;
```

**Step 3: Add --home flag handling**

Add after the destructuring (before "Phase 1: Discover assistants"):

```typescript
  // Handle --home flag
  if (homeMode) {
    if (!process.env.HOME) {
      console.error('Error: HOME environment variable not set');
      process.exit(1);
    }
    baseDir = process.env.HOME;
    console.log(`Using home directory: ${baseDir}`);
  }

  // Handle --reconfigure flag
  if (reconfigure) {
    await runReconfigure(baseDir);
    return;
  }

  // Ensure config exists
  const config = await ensureConfig(baseDir);
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(index): add --home and --reconfigure flag handling"
```

---

### Task 8: Use enabled assistants in index.ts sync flow

**Files:**
- Modify: `src/index.ts`

**Step 1: Replace discoverAssistants call**

Find the line `const states = await discoverAssistants(baseDir);` and replace the whole Phase 1 section:

```typescript
  // Phase 1: Get enabled assistants and find sync pairs
  const enabledConfigs = getEnabledAssistants(config);
  const states = await discoverAssistants(baseDir, enabledConfigs);
  const syncPairs = findSyncPairs(states);
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Error - discoverAssistants doesn't accept configs parameter

**Step 3: Update assistants.ts discoverAssistants signature**

This is expected - we'll fix in next task.

**Step 4: No commit yet - continue to next task**

---

### Task 9: Update assistants.ts to accept configs parameter

**Files:**
- Modify: `src/assistants.ts`

**Step 1: Update discoverAssistants function**

Update the function signature and implementation (around line 17):

```typescript
/**
 * Discover the state of configured assistants
 * @param baseDir - Base directory to scan
 * @param configs - Assistant configs to discover (defaults to all)
 */
export async function discoverAssistants(
  baseDir: string,
  configs: AssistantConfig[] = getAssistantConfigs()
): Promise<AssistantState[]> {
  const states: AssistantState[] = [];

  for (const config of configs) {
    const state = await discoverAssistant(baseDir, config);
    states.push(state);
  }

  return states;
}
```

**Step 2: Update imports**

Add to imports at top if not already present:

```typescript
import { getAssistantConfigs } from './types.js';
```

**Step 3: Remove old ASSISTANTS re-export**

Remove or comment out lines 202-203:

```typescript
// Re-export ASSISTANTS for convenience
// export const ASSISTANTS = await import('./types.js').then(m => m.ASSISTANTS);
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Run tests**

Run: `npm test`
Expected: All existing tests pass

**Step 6: Commit**

```bash
git add src/assistants.ts
git commit -m "refactor(assistants): accept configs parameter for filtering"
```

---

### Task 10: Update bin/sync-skills.ts CLI parsing

**Files:**
- Modify: `bin/sync-skills.ts`

**Step 1: Read current file**

First, check the current contents:

```bash
cat bin/sync-skills.ts
```

**Step 2: Update minimist options**

Update the minimist call to include new flags:

```typescript
const args = minimist(process.argv.slice(2), {
  boolean: ['fail-on-conflict', 'dry-run', 'home', 'reconfigure']
});
```

**Step 3: Update run() call**

Update the run() call to pass new options:

```typescript
await run({
  baseDir: args._[0],
  failOnConflict: args['fail-on-conflict'],
  dryRun: args['dry-run'],
  homeMode: args.home,
  reconfigure: args.reconfigure
});
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Test --help behavior**

Run: `./bin/sync-skills.ts --help 2>&1 || true`
Expected: No crash (minimist doesn't provide built-in help)

**Step 6: Commit**

```bash
git add bin/sync-skills.ts
git commit -m "feat(cli): add --home and --reconfigure flag parsing"
```

---

### Task 11: Write test for readConfig

**Files:**
- Create: `test/config.test.ts`

**Step 1: Create test file with imports**

```typescript
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { readConfig, writeConfig, CONFIG_PATH } from '../src/config.js';

const TEST_DIR = 'test/fixtures/config-test';
```

**Step 2: Add beforeEach/afterEach hooks**

```typescript
describe('config', () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });
```

**Step 3: Add test for readConfig with existing file**

```typescript
  describe('readConfig', () => {
    it('should read existing config file', async () => {
      const testConfig = { version: 1, assistants: ['claude', 'codex'] };
      await fs.mkdir(join(TEST_DIR, '.agents-common'), { recursive: true });
      await fs.writeFile(join(TEST_DIR, CONFIG_PATH), JSON.stringify(testConfig));

      const result = await readConfig(TEST_DIR);

      assert.deepEqual(result, testConfig);
    });
```

**Step 4: Run test**

Run: `tsx --test test/config.test.ts`
Expected: PASS

**Step 5: Add test for missing file**

```typescript
    it('should return null when config does not exist', async () => {
      const result = await readConfig(TEST_DIR);
      assert.strictEqual(result, null);
    });
```

**Step 6: Run test**

Run: `tsx --test test/config.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add test/config.test.ts
git commit -m "test(config): add readConfig tests"
```

---

### Task 12: Write test for writeConfig

**Files:**
- Modify: `test/config.test.ts`

**Step 1: Add test for writeConfig**

```typescript
  describe('writeConfig', () => {
    it('should write config file and create directory', async () => {
      const testConfig = { version: 1, assistants: ['claude'] };

      await writeConfig(TEST_DIR, testConfig);

      const configPath = join(TEST_DIR, CONFIG_PATH);
      const content = await fs.readFile(configPath, 'utf-8');
      const result = JSON.parse(content);

      assert.deepEqual(result, testConfig);
    });
```

**Step 2: Run test**

Run: `tsx --test test/config.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add test/config.test.ts
git commit -m "test(config): add writeConfig test"
```

---

### Task 13: Write test for detectAvailableAssistants

**Files:**
- Modify: `test/config.test.ts`

**Step 1: Add test for detectAvailableAssistants**

```typescript
  describe('detectAvailableAssistants', () => {
    it('should detect existing assistant folders', async () => {
      // Create .claude folder
      await fs.mkdir(join(TEST_DIR, '.claude'), { recursive: true });

      const { detectAvailableAssistants } = await import('../src/config.js');
      const result = await detectAvailableAssistants(TEST_DIR);

      assert.deepEqual(result, ['claude']);
    });

    it('should return empty array when no folders exist', async () => {
      const { detectAvailableAssistants } = await import('../src/config.js');
      const result = await detectAvailableAssistants(TEST_DIR);

      assert.deepEqual(result, []);
    });
```

**Step 2: Run test**

Run: `tsx --test test/config.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add test/config.test.ts
git commit -m "test(config): add detectAvailableAssistants tests"
```

---

### Task 14: Write integration test for --home flag

**Files:**
- Modify: `test/integration.test.ts`

**Step 1: Add test case**

```typescript
  describe('--home flag', () => {
    it('should fail when HOME is not set', async () => {
      const originalHome = process.env.HOME;
      delete process.env.HOME;

      try {
        await run({ baseDir: process.cwd(), homeMode: true });
        assert.fail('Should have thrown');
      } catch (error: unknown) {
        assert.ok((error as any).message);
      } finally {
        process.env.HOME = originalHome;
      }
    });
```

**Step 2: Run test**

Run: `npm test`
Expected: PASS (will exit with code 1, which the test catches)

**Actually, the run function calls process.exit()**, so we need to mock it or test differently. Let's adjust:

**Step 1 (revised): Add test case with mocked behavior**

Since `run()` calls `process.exit(1)`, we'll test the actual CLI behavior in a manual test instead. Add a note to the test file:

```typescript
  // Note: --home flag with missing HOME is tested manually via CLI
  // because run() calls process.exit() which cannot be easily tested
```

**Step 2: Skip this automated test, add to manual test checklist**

**Step 3: No commit - proceed to next task**

---

### Task 15: Write integration test for auto-config flow

**Files:**
- Modify: `test/integration.test.ts`

**Step 1: Add test for auto-config with existing folders**

```typescript
  describe('auto-configuration', () => {
    it('should auto-create config when folders exist', async () => {
      const testDir = 'test/fixtures/auto-config';

      // Cleanup first
      await fs.rm(testDir, { recursive: true, force: true });

      // Create .claude folder with skills
      await fs.mkdir(join(testDir, '.claude/skills/test'), { recursive: true });
      await fs.writeFile(join(testDir, '.claude/skills/test/SKILL.md', '@test');

      // Run sync (should auto-create config)
      await run({ baseDir: testDir });

      // Check config was created
      const { readConfig } = await import('../src/config.js');
      const config = await readConfig(testDir);

      assert.ok(config);
      assert.deepEqual(config?.assistants, ['claude']);
    });
```

**Step 2: Run test**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add test/integration.test.ts
git commit -m "test(integration): add auto-config test"
```

---

### Task 16: Manual testing checklist

**Files:**
- None (manual testing)

**Step 1: Test --reconfigure interactively**

Run: `./bin/sync-skills.ts --reconfigure`
Expected: Checkbox prompt appears, selections saved

**Step 2: Test --home flag**

Run: `./bin/sync-skills.ts --home`
Expected: Uses ~/.claude, ~/.codex

**Step 3: Test --home with missing HOME**

Run: `env -u HOME ./bin/sync-skills.ts --home 2>&1 || echo "Exit code: $?"`
Expected: Error message "HOME environment variable not set"

**Step 4: Test config persistence**

1. Run `./bin/sync-skills.ts --reconfigure`, select only "claude"
2. Check `.agents-common/config.json` has only "claude"
3. Run `./bin/sync-skills.ts` - should only process claude

**Step 5: Test auto-config with no folders**

In empty directory: `./bin/sync-skills.ts`
Expected: Prompt to select assistants

**Step 6: Document results**

Add a `TESTING.md` note with manual test results if any issues found.

---

### Task 17: Update README with new features

**Files:**
- Modify: `README.md`

**Step 1: Add new flags to usage section**

Update the Usage section:

```markdown
## Usage

```bash
sync-skills              # Interactive sync
sync-skills --fail-on-conflict    # Fail on conflicts
sync-skills --dry-run            # Show changes without applying
sync-skills --reconfigure        # Change which assistants to sync
sync-skills --home               # Sync in home directory (~/.claude, ~/.codex)
```
```

**Step 2: Add configuration section**

Add after the Usage section:

```markdown
## Configuration

`sync-skills` stores configuration in `.agents-common/config.json`:

```json
{
  "version": 1,
  "assistants": ["claude", "codex"]
}
```

The configuration is created automatically on first run based on which assistant folders exist in your project. Use `--reconfigure` to change which assistants are synced.
```

**Step 3: Update home mode section**

Add or update:

```markdown
## Home Mode

Use the `--home` flag to sync skills in your home directory:

```bash
sync-skills --home
```

This syncs `~/.claude`, `~/.codex`, and `~/.agents-common` - useful for maintaining a personal skill collection that can be shared across projects.
```

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with config and --home flag"
```

---

### Task 18: Final verification and cleanup

**Files:**
- Various

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Build check**

Run: `npm run build 2>&1 || echo "No build script - check tsx directly"`
Expected: No critical errors

**Step 4: Test CLI end-to-end**

Run: `./bin/sync-skills.ts --help 2>&1 || true`
Expected: No crash

**Step 5: Verify git status**

Run: `git status`
Expected: Only intended changes staged

**Step 6: Final commit if needed**

```bash
git add .
git commit -m "chore: final cleanup and verification"
```

---

## Implementation Complete

Verify:
- [x] Configuration file `.agents-common/config.json` is created automatically
- [x] `--reconfigure` flag opens interactive checkbox prompt
- [x] `--home` flag uses `~/.claude`, `~/.codex` directories
- [x] `ASSISTANT_MAP` allows easy extension of new assistants
- [x] All tests pass
- [x] README updated
