# Bidirectional Skill Sync Design

**Date:** 2025-01-12
**Author:** Claude Code
**Status:** Approved

## Overview

Extend the sync-skills tool to support bidirectional skill synchronization between multiple AI assistants (Claude, Codex, and future assistants). The current implementation only supports `.claude` → `.codex` direction (Scenarios 1 & 2). This design adds support for Scenarios 3, 4, & 5 and makes the codebase modular and extensible.

## Test Scenarios Summary

| Scenario | Source | Target | Behavior |
|----------|--------|--------|----------|
| 1 | `.claude/skills` exists | `.codex` missing | Prompt user, create if yes |
| 2 | `.claude/skills` exists | `.codex` exists | Auto-create without prompt |
| 3 | No skills anywhere | N/A | Exit silently |
| 4 | `.codex/skills` exists | `.claude` missing | Prompt user, create if yes |
| 5 | `.codex/skills` exists | `.claude` exists | Auto-create without prompt |

## Architecture

### Core Principle: Direction-Agnostic Sync Logic

Extract sync logic into reusable functions that work with any assistant type through a convention-based configuration.

### Assistant Configuration Convention

```typescript
interface AssistantConfig {
  name: string;      // e.g., 'claude', 'codex'
  dir: string;       // e.g., '.claude', '.codex'
  skillsDir: string; // e.g., '.claude/skills', '.codex/skills'
}

const ASSISTANTS: AssistantConfig[] = [
  { name: 'claude', dir: '.claude', skillsDir: '.claude/skills' },
  { name: 'codex', dir: '.codex', skillsDir: '.codex/skills' }
];
```

### Three-Phase Execution

1. **Discover Phase** - Scan all assistant directories and find skills
2. **Sync Phase** - For each assistant without skills, check if others have skills and offer to create mirrored versions
3. **Refactor Phase** - Convert non-@reference skills to use common skills

## Core Functions (New `assistants.ts` Module)

### `discoverAssistants(baseDir: string): Promise<AssistantState[]>`

Returns the state of all configured assistants:
```typescript
interface AssistantState {
  config: AssistantConfig;
  hasDir: boolean;
  hasSkills: boolean;
  skills: SkillFile[];
}

// Example return:
[
  { config: {...}, hasDir: true, hasSkills: true, skills: [...] },
  { config: {...}, hasDir: false, hasSkills: false, skills: [] }
]
```

### `shouldOfferSync(source: AssistantState, target: AssistantState): boolean`

Determines if sync should be offered:
- Source has skills, target doesn't
- Returns true regardless of whether target dir exists (caller decides to prompt or auto-sync)

### `needsPrompt(source: AssistantState, target: AssistantState): boolean`

Determines if user prompt is needed:
- Returns `true` if target directory doesn't exist
- Returns `false` if target directory exists (auto-sync)

### `cloneAssistantSkills(baseDir: string, sourceSkills: SkillFile[], targetConfig: AssistantConfig): Promise<void>`

Generic version of `cloneCodexSkills` that works for any target assistant.

### `promptForSync(targetName: string): Promise<boolean>`

Reusable prompt function: "`.claude` folder does not exist. Would you like to create `.claude/skills` with references to common skills?"

## Data Flow

```
                    ┌─────────────────────┐
                    │   run() in          │
                    │   index.ts          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   discoverAssistants│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   For each pair:    │
                    │   shouldOfferSync?  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
    ┌───────────────────┐           ┌───────────────────┐
    │ needsPrompt?      │           │ Auto-sync         │
    │ → prompt user     │           │ → create skills   │
    └───────────────────┘           └───────────────────┘
              │                                 │
              └────────────────┬────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Refactor phase    │
                    │   (existing logic)  │
                    └─────────────────────┘
```

## TypeScript Migration

### Type Definitions

```typescript
interface AssistantConfig {
  name: string;
  dir: string;
  skillsDir: string;
}

interface AssistantState {
  config: AssistantConfig;
  hasDir: boolean;
  hasSkills: boolean;
  skills: SkillFile[];
}

interface SkillFile {
  path: string;
  skillName: string;
}

interface SyncPair {
  source: AssistantState;
  target: AssistantState;
}

type SyncAction = 'abort' | 'create' | 'skip';
```

### Migration Strategy

1. Add `tsconfig.json` with strict mode
2. Rename all `.js` files to `.ts`
3. Add proper type annotations
4. Update imports/extensions
5. Add build step to `package.json`:
   ```json
   "scripts": {
     "build": "tsc",
     "prepublishOnly": "npm run build"
   }
   ```

## Error Handling & Edge Cases

| Case | Handling |
|------|----------|
| Directory access errors | Gracefully skip assistant |
| Empty skills directories | Treat as `hasSkills: false` |
| Prompt rejection | Exit cleanly without errors |
| File write failures | Report error and exit |
| Both assistants have skills | No sync offered, proceed to refactor |
| Existing target skills | Don't overwrite, skip sync |

## Scenario Mapping

All 5 scenarios emerge from the generic logic:

| Scenario | State | Action |
|----------|-------|--------|
| 1 | source=`claude`, target=`codex`, targetDir missing | Prompt user |
| 2 | source=`claude`, target=`codex`, targetDir exists | Auto-sync |
| 3 | No source has skills | Exit (no sync pairs) |
| 4 | source=`codex`, target=`claude`, targetDir missing | Prompt user |
| 5 | source=`codex`, target=`claude`, targetDir exists | Auto-sync |

## File Changes

### New Files
- `src/assistants.ts` - Core assistant abstractions
- `src/types.ts` - Shared type definitions
- `tsconfig.json` - TypeScript configuration

### Modified Files
- `src/index.js` → `src/index.ts` - Use new assistant abstractions
- `src/syncer.js` → `src/syncer.ts` - Add types, generic `cloneAssistantSkills`
- `src/scanner.js` → `src/scanner.ts` - Add types
- `src/parser.js` → `src/parser.ts` - Add types
- `src/detector.js` → `src/detector.ts` - Add types
- `src/resolver.js` → `src/resolver.ts` - Add types
- `src/propagator.js` → `src/propagator.ts` - Add types
- `bin/sync-skills.js` → `bin/sync-skills.ts` - Update extension
- `test/integration.test.js` → `test/integration.test.ts` - Add scenario 3, 4, 5 tests

## Implementation Checklist

- [ ] Add tsconfig.json
- [ ] Create src/types.ts
- [ ] Create src/assistants.ts
- [ ] Rename .js → .ts files
- [ ] Implement discoverAssistants()
- [ ] Implement shouldOfferSync()
- [ ] Implement needsPrompt()
- [ ] Implement cloneAssistantSkills()
- [ ] Implement promptForSync()
- [ ] Refactor index.ts to use new abstractions
- [ ] Add tests for Scenario 3
- [ ] Add tests for Scenario 4
- [ ] Add tests for Scenario 5
- [ ] Run all tests to verify
- [ ] Update package.json build scripts
