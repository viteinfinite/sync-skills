## MODIFIED Requirements
### Requirement: Skill Detail Display
Each listed skill SHALL show its name, trimmed description, installation location, file count, and unmanaged status when the skill directory is a symlink to `.agents/skills/<skill>`.

#### Scenario: Displaying skill details
Given a skill `weather` with description "Shows weather info" and 3 files in `.codex/skills/weather`
When I run `sync-skills --list`
Then the output for `weather` should include:
- Name: `weather`
- Description: `Shows weather info`
- Site: `codex`
- Files: `3`

#### Scenario: Displaying unmanaged symlinked skills
Given `.claude/skills/weather` is a symlink to `.agents/skills/weather`
When I run `sync-skills --list`
Then the output SHALL indicate `weather` is unmanaged and include the line `ignored weather because it was symlinked`.
