# sync-skills

Synchronize agent skill definitions between `.claude` and `.codex` directories.

## Usage

```bash
sync-skills              # Interactive sync
sync-skills --fail-on-conflict    # Fail on conflicts
sync-skills --dry-run            # Show changes without applying
```

## Behavior

When running `sync-skills`:

1. **Skills without `@` references** are refactored to use `.agents-common/skills`
2. **`.codex/skills` auto-creation**: If `.claude/skills` contains skills but `.codex/skills` doesn't exist:
   - If `.codex` folder doesn't exist: Prompts to create `.codex/skills` with references to common skills
   - If `.codex` folder exists: Automatically creates `.codex/skills` with references to common skills
3. **Conflicts** are detected and resolved interactively when skills differ between agents
