# Change: Add project and home path modes for assistant skill directories

## Why

Some AI assistants use different skill directory paths for project-local vs home/global configuration:
- **Windsurf**: `.windsurf/skills` (project) vs `~/.codeium/windsurf/skills` (home)
- **OpenCode**: `.opencode/skill` (project) vs `~/.config/opencode/skill` (home)

The current `ASSISTANT_MAP` only supports a single path string, which forces choosing one location. The `--home` mode flag exists but there's no way to configure separate paths per mode.

## What Changes

- **MODIFIED**: `ASSISTANT_MAP` type from `Record<string, string>` to `Record<string, string | { project: string, home: string }>`
- **MODIFIED**: `AssistantConfig` interface to include `homeDir` and `homeSkillsDir` properties
- **MODIFIED**: `getAssistantConfigs()` to resolve correct paths based on `homeMode` parameter
- **MODIFIED**: `detectAvailableAssistants()` to detect both project and home directories
- **BREAKING**: Existing string values in `ASSISTANT_MAP` will be treated as project path only (home path will be inferred or left empty)

## Impact

- Affected specs: `assistant-config` (new capability)
- Affected code:
  - `src/types.ts` - ASSISTANT_MAP type, AssistantConfig interface, getAssistantConfigs function
  - `src/config.ts` - detectAvailableAssistants function
  - All consumers of `getAssistantConfigs()` will need to pass `homeMode` parameter
