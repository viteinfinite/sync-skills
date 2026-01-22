# Change: Add sync-skills self-documentation skill installation

## Why

AI agents working on projects using sync-skills need to understand how the tool works to effectively use it. Currently, there is no built-in way for agents to learn about sync-skills capabilities and options.

This change adds a `--install-self-skill` option that installs a sync-skills documentation skill at `.agents-common/skills/sync-skills/SKILL.md`, explaining the main options of the software to AI agents.

## What Changes

- **ADDED**: New `--install-self-skill` CLI flag to `sync-skills` command
- **ADDED**: Function to install sync-skills documentation skill to `.agents-common/skills/sync-skills/SKILL.md`
- **ADDED**: The sync-skills skill file explaining main options (sync, list, home, reconfigure, fail-on-conflict)

## Impact

- Affected specs: `sync-skills-self-documentation` (new capability)
- Affected code:
  - `bin/sync-skills.ts` - Add CLI flag and handler
  - `src/index.ts` - Add `installSelfSkill` option to `RunOptions` and implement installation logic
  - `src/types.ts` - Add `installSelfSkill` to `RunOptions` interface
  - New skill content: `.agents-common/skills/sync-skills/SKILL.md` template

## Non-Goals

- Automatic installation on every run (user must explicitly opt-in with the flag)
- Dynamic content generation (skill content is static)
- Syncing the skill across platforms (it lives only in `.agents-common/`)
