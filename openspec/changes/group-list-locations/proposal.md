# Proposal: Group locations in skill list

When listing skills with `--list`, the tool currently displays a separate line for each location where a skill is installed. This can lead to a long and repetitive list when many assistants are enabled.

This proposal changes the `--list` output to group all installation locations for the same skill into a single line.

## Why
- Improves readability by providing a more compact overview of the skill library.
- Makes it easier to see at a glance which assistants have a specific skill.

## What Changes
- The `listSkills` function in `src/index.ts` will be updated to aggregate results by skill name.
- The output format will show a comma-separated list of locations (e.g., `[common, claude, codex]`).
- File counts will be removed from the output to reduce complexity.
