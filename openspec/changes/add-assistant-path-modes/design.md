## Context

The sync-skills tool synchronizes AI assistant skills across different platforms. Each assistant has a local directory where skills are stored. The tool currently assumes a single path per assistant, but some platforms use different paths for project-local vs global (home) configuration.

**Current state:**
```typescript
export const ASSISTANT_MAP: Record<string, string> = {
  'windsurf': '.windsurf/skills',  // Only one path supported
};
```

**Problem:**
- Windsurf uses `.windsurf/skills` for project-local skills
- Windsurf uses `~/.codeium/windsurf/skills` for global skills
- Current implementation can't support both

## Goals / Non-Goals

- Goals:
  - Support separate project and home paths for assistants that need them
  - Maintain backward compatibility for assistants with single path
  - Use `--home` flag to select which path to use

- Non-Goals:
  - Syncing both project and home simultaneously (pick one per run)
  - Auto-detecting which mode to use (explicit flag required)

## Decisions

### Decision 1: Union type for ASSISTANT_MAP entries

Use a union type `string | { project: string, home: string }` to allow both simple and complex configurations.

**Alternatives considered:**
1. **Always use object** - `{ project: string, home?: string }`
   - More verbose for simple cases
   - Clearer semantics

2. **Separate maps** - `PROJECT_ASSISTANT_MAP` and `HOME_ASSISTANT_MAP`
   - Duplicates entries
   - Harder to maintain

3. **Union type (chosen)** - `string | { project: string, home: string }`
   - Backward compatible
   - Minimal changes for existing assistants
   - Clear when assistant has dual paths

### Decision 2: Path resolution at config lookup time

Resolve the correct path in `getAssistantConfigs()` based on `homeMode` parameter rather than storing resolved paths in `AssistantConfig`.

**Alternatives considered:**
1. **Store both paths in AssistantConfig** - Add `homeSkillsDir` property
   - More complex interface
   - Need to decide which to use throughout codebase

2. **Resolve at lookup time (chosen)** - Pass `homeMode` to `getAssistantConfigs()`
   - Single source of truth
   - `skillsDir` always points to correct location for current mode
   - Simpler consuming code

### Decision 3: Backward compatibility strategy

String values in `ASSISTANT_MAP` are treated as project path only. Home path is either:
- Inferred by common patterns (e.g., `~/.config/${assistant}/skills`)
- Left empty if no reasonable inference

This ensures existing configs continue working without modification.

## Risks / Trade-offs

- **Risk**: Breaking change for `getAssistantConfigs()` consumers (new parameter)
  - **Mitigation**: Make parameter optional with default `false` (project mode)

- **Risk**: Home path inference may be incorrect
  - **Mitigation**: Only infer when explicitly configured; otherwise empty

- **Trade-off**: More complex type definitions vs flexibility
  - **Decision**: Accept complexity for correctness

## Migration Plan

1. Update type definitions in `src/types.ts`
2. Update `getAssistantConfigs()` to accept `homeMode` parameter
3. Update `detectAvailableAssistants()` to check both directories
4. Update `ASSISTANT_MAP` entries for windsurf and opencode
5. Update all call sites of `getAssistantConfigs()` to pass mode

**Rollback**: Revert changes if home mode detection proves unreliable; can fall back to manual configuration.

## Open Questions

- Should we infer home paths for assistants without explicit configuration?
  - **Answer**: Start with no inference, add later if needed based on user feedback

- Should the `.agents-common/config.json` store the user's preferred mode?
  - **Answer**: Out of scope for this change; controlled via CLI flag only
