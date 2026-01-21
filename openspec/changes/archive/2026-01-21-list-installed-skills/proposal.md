# Proposal: Add --list mode to sync-skills

This proposal adds a `--list` (or `-l`) mode to the `sync-skills` CLI. This mode allows users to see all skills installed across supported assistant platforms and the common repository, providing a quick overview of their skill library.

## Goals
- Provide a `--list` command to display installed skills.
- Show skill name, description, installation location, and file count for each skill.
- Support `--home` flag to list skills in the home directory.
- Avoid triggering full sync or configuration flow when listing skills.

## Scope
- CLI argument parsing in `bin/sync-skills.ts`.
- `RunOptions` update in `src/types.ts`.
- Logic for scanning, parsing, and counting files in `src/index.ts` (or helper).
- Output formatting for the skill list.
