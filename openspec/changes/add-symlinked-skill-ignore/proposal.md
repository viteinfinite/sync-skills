# Change: Ignore symlinked platform skills pointing to .sync-skills

## Why
Teams sometimes place skills in assistant folders as symlinks to `.sync-skills/skills`, which should not be managed by sync-skills. Today those symlinked skills are treated as real platform skills, leading to incorrect sync/refactor behavior and misleading `--list` output.

## What Changes
- Detect skill directories that are symlinks to `.sync-skills/skills/<skill>` and treat them as unmanaged.
- Skip those symlinked skills during sync/refactor flows and emit a stdout message: `ignored <skill> because it was symlinked`.
- In `--list` mode, surface those symlinked skills as unmanaged while still listing them.
- Add integration tests that create and clean up these symlinks.

## Impact
- Affected specs: `specs/list-mode/spec.md` (modify), new capability for symlinked-skill ignore behavior.
- Affected code: scanning and list output, sync/refactor flows, integration tests.
