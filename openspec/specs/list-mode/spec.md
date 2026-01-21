# list-mode Specification

## Purpose
TBD - created by archiving change list-installed-skills. Update Purpose after archive.
## Requirements
### Requirement: CLI List Flag
The CLI SHALL support a `--list` (alias `-l`) flag to display installed skills.

#### Scenario: Listing skills in the current directory
Given a project with skills in `.claude/skills/my-skill` and `.agents-common/skills/my-skill`
When I run `sync-skills --list`
Then I should see a list containing both `my-skill` entries with their descriptions and file counts.

#### Scenario: Listing skills in the home directory
Given skills installed in the home directory assistant folders
When I run `sync-skills --list --home`
Then I should see the skills installed in the home directory.

### Requirement: Skill Detail Display
Each listed skill SHALL show its name, trimmed description, installation location, and file count.

#### Scenario: Displaying skill details
Given a skill `weather` with description "Shows weather info" and 3 files in `.codex/skills/weather`
When I run `sync-skills --list`
Then the output for `weather` should include:
- Name: `weather`
- Description: `Shows weather info`
- Site: `codex`
- Files: `3`

### Requirement: Non-Interactive List
The list mode SHALL NOT trigger sync operations or interactive configuration.

#### Scenario: Listing without config
Given a directory with assistant folders but no `.agents-common/config.json`
When I run `sync-skills --list`
Then the skills should be listed without prompting for configuration.

