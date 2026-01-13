# Configuration System Design

**Date:** 2026-01-13
**Status:** Approved

## Overview

Add a persistent configuration system to track which AI assistants are enabled for sync in each project, along with a reconfigure command and home directory support.

## Requirements

1. **Configuration file** - Save enabled assistants in JSON inside a dot folder
2. **Reconfigure command** - Interactive command to change enabled assistants
3. **Home folder support** - Optional `--home` flag to sync `~/.claude`, `~/.codex`

## Configuration File

**Location:** `.agents-common/config.json`

**Schema:**
```json
{
  "version": 1,
  "assistants": ["claude", "codex"]
}
```

- `version`: Integer for future schema migrations
- `assistants`: Array of assistant names to sync (subset of available types)

## CLI Interface

```bash
# Default sync (uses existing config or auto-detects)
sync-skills

# Use home directories instead of project-local
sync-skills --home

# Reconfigure which assistants to sync (interactive)
sync-skills --reconfigure

# Existing flags still work
sync-skills --fail-on-conflict --dry-run

# Combined
sync-skills --home --reconfigure
sync-skills --home --dry-run
```

## Assistant Map

**Location:** `src/types.ts`

A configurable JSON map for easily adding new assistants:

```typescript
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude',
  'codex': '.codex',
  // Add more: 'cursor': '.cursor', 'copilot': '.copilot'
};
```

## Behavior

### Auto-Create Config (First Run)

| Condition | Behavior |
|-----------|----------|
| Folders exist (`.claude`, `.codex`) | Auto-create config with detected assistants |
| No folders exist | Interactive prompt to select assistants |
| Config exists | Use existing config |

### Reconfigure Command

1. Reads current config (or shows all available assistants if no config)
2. Uses inquirer checkbox prompt showing all assistant types from `ASSISTANT_MAP`
3. Pre-checks assistants that either: have existing folders, or are in current config
4. Saves new selection to `.agents-common/config.json`
5. Exits (no sync performed)
6. Validation: At least one assistant must be selected

### Home Flag

- Overrides `baseDir` from `process.cwd()` to user's home directory
- All operations happen in `~/.claude`, `~/.codex`, `~/.agents-common`
- **NOT saved to config** - must be specified each run
- Fails explicitly if `HOME` environment variable is not set

## Implementation

### New Module: `src/config.ts`

```typescript
interface Config {
  version: number;
  assistants: string[];
}

// Read config or return null if doesn't exist
async function readConfig(baseDir: string): Promise<Config | null>

// Write config to .agents-common/config.json
async function writeConfig(baseDir: string, config: Config): Promise<void>

// Auto-detect assistants based on existing folders
async function detectAvailableAssistants(baseDir: string): Promise<string[]>

// Ensure config exists, create if needed
async function ensureConfig(baseDir: string): Promise<Config>

// Interactive reconfiguration
async function reconfigure(baseDir: string): Promise<void>

// Get enabled AssistantConfig[] from Config
function getEnabledAssistants(config: Config): AssistantConfig[]
```

### Updated Types: `src/types.ts`

```typescript
// Add to existing exports
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude',
  'codex': '.codex',
};

// Derive ASSISTANTS from map dynamically
export function getAssistantConfigs(names?: string[]): AssistantConfig[] {
  const enabled = names || Object.keys(ASSISTANT_MAP);
  return enabled.map(name => ({
    name,
    dir: ASSISTANT_MAP[name],
    skillsDir: `${ASSISTANT_MAP[name]}/skills`
  }));
}

// Update RunOptions
export interface RunOptions {
  baseDir?: string;
  failOnConflict?: boolean;
  dryRun?: boolean;
  homeMode?: boolean;      // NEW
  reconfigure?: boolean;   // NEW
  targets?: string[];
}
```

### Updated Index: `src/index.ts`

```typescript
export async function run(options: RunOptions = {}): Promise<void> {
  let {
    baseDir = process.cwd(),
    failOnConflict = false,
    dryRun = false,
    homeMode = false,
    reconfigure = false
  } = options;

  // Apply --home flag
  if (homeMode) {
    if (!process.env.HOME) {
      console.error('Error: HOME environment variable not set');
      process.exit(1);
    }
    baseDir = process.env.HOME;
    console.log(`Using home directory: ${baseDir}`);
  }

  // Handle --reconfigure
  if (reconfigure) {
    await reconfigure(baseDir);
    return;
  }

  // Ensure config exists (auto-create if needed)
  const config = await ensureConfig(baseDir);

  // Get enabled assistant configs from config
  const enabledConfigs = getEnabledAssistants(config);

  // Continue with rest of sync using enabledConfigs...
  // (existing logic)
}
```

### Updated Assistants: `src/assistants.ts`

- Accept `targets: string[]` parameter instead of using hard-coded `ASSISTANTS`
- `discoverAssistants()` filters by enabled list from config

### CLI Parsing: `bin/sync-skills.ts`

```typescript
const args = minimist(process.argv.slice(2), {
  boolean: ['fail-on-conflict', 'dry-run', 'home', 'reconfigure']
});

await run({
  baseDir: args._[0], // optional path argument
  failOnConflict: args['fail-on-conflict'],
  dryRun: args['dry-run'],
  homeMode: args.home,
  reconfigure: args.reconfigure
});
```

## Error Handling

| Error | Behavior |
|-------|----------|
| HOME not set with --home | Fail with error message |
| Config JSON is malformed | Recreate from detected folders |
| Write permission denied | Clear error message |
| Unknown assistant name in config | Log warning, skip unknown |

## Test Scenarios

| Scenario | Condition | Behavior |
|----------|-----------|----------|
| No config, folders exist | `.claude` exists, no config.json | Auto-create config with detected assistants |
| No config, no folders | No assistant folders, no config.json | Prompt user to select assistants |
| Config exists | config.json with `["claude"]` | Only sync claude, ignore codex |
| --reconfigure | Any state | Show interactive checkbox, save selection |
| --home without HOME | HOME not set | Fail with error |
| --home valid | HOME set | Operate in ~/.claude, ~/.codex |
| Config has unknown assistant | config.json has `["unknown"]` | Log warning, skip unknown |
| Invalid JSON | config.json is malformed | Recreate from detected folders |
