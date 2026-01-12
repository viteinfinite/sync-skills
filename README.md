# sync-skills

Synchronize agent skill definitions between `.claude` and `.codex` directories.

## Features

- **Bidirectional sync** - Skills can flow from `.claude` → `.codex` OR `.codex` → `.claude`
- **Modular architecture** - Easy to add support for new AI assistants
- **TypeScript** - Fully typed for better development experience
- **Conflict detection** - Interactive resolution when skills differ

## Usage

```bash
sync-skills              # Interactive sync
sync-skills --fail-on-conflict    # Fail on conflicts
sync-skills --dry-run            # Show changes without applying
```

## Behavior

When running `sync-skills`:

1. **Skills without `@` references** are refactored to use `.agents-common/skills`
2. **Bidirectional auto-creation** - For any assistant type (claude, codex, etc.):
   - If source has skills and target folder doesn't exist: Prompts to create target skills
   - If source has skills and target folder exists: Automatically creates target skills
   - If no skills exist anywhere: Exits silently
3. **Conflicts** are detected and resolved interactively when skills differ between agents

## Test Scenarios

The implementation is verified against these test scenarios:

| Scenario | Condition | Behavior |
|----------|-----------|----------|
| 1 | `.claude/skills` exists, `.codex` missing | Prompt user, create if yes |
| 2 | `.claude/skills` exists, `.codex` exists | Auto-create without prompt |
| 3 | No skills exist anywhere | Exit silently |
| 4 | `.codex/skills` exists, `.claude` missing | Prompt user, create if yes |
| 5 | `.codex/skills` exists, `.claude` exists | Auto-create without prompt |
