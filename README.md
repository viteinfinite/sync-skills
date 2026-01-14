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
sync-skills --reconfigure        # Change which assistants to sync
sync-skills --home               # Sync in home directory (~/.claude, ~/.codex)
```

## Configuration

`sync-skills` stores configuration in `.agents-common/config.json`:

```json
{
  "version": 1,
  "assistants": ["claude", "codex"]
}
```

The configuration is created automatically on first run based on which assistant folders exist in your project. Use `--reconfigure` to change which assistants are synced.

## Home Mode

Use the `--home` flag to sync skills in your home directory:

```bash
sync-skills --home
```

This syncs `~/.claude`, `~/.codex`, and `~/.agents-common` - useful for maintaining a personal skill collection that can be shared across projects.

## How It Works

`sync-skills` manages skill definitions across multiple AI assistants through a shared common directory.

### Architecture

```
.agents-common/skills/     ← Shared skill definitions (canonical source)
├── skill-a/SKILL.md
└── skill-b/SKILL.md

.claude/skills/             ← Claude-specific references
├── skill-a/SKILL.md       → Contains: @.agents-common/skills/skill-a/SKILL.md
└── skill-b/SKILL.md

.codex/skills/              ← Codex-specific references
├── skill-a/SKILL.md       → Contains: @.agents-common/skills/skill-a/SKILL.md
└── skill-b/SKILL.md
```

### Sync Flow

When running `sync-skills`:

1. **Auto-configuration** - Detects which assistant folders exist and creates `.agents-common/config.json`

2. **Bidirectional sync** - For each pair of assistants:
   - **Source**: Assistant that has skills (e.g., `.claude/skills/`)
   - **Target**: Assistant that needs those skills (e.g., `.codex/skills/`)
   - If target folder doesn't exist: Prompts to create it
   - If target folder exists: Automatically creates skill references

3. **Refactoring** - Skills without `@` references are moved to `.agents-common/skills/` and replaced with references

4. **Conflict resolution** - When skills have different content, prompts to choose which version to keep

### Test Scenarios

| Scenario | Condition | Behavior |
|----------|-----------|----------|
| 1 | `.claude/skills` exists, `.codex` missing | Prompt user, create `.codex` if yes |
| 2 | `.claude/skills` exists, `.codex` exists | Auto-create `.codex` skills without prompt |
| 3 | No skills exist anywhere | Exit silently |
| 4 | `.codex/skills` exists, `.claude` missing | Prompt user, create `.claude` if yes |
| 5 | `.codex/skills` exists, `.claude` exists | Auto-create `.claude` skills without prompt |
