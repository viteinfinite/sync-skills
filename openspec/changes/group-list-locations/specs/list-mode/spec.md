# list-mode Specification Delta

## MODIFIED Requirements

### Requirement: Skill Detail Display
Each listed skill SHALL show its name, trimmed description, and grouped installation locations.

#### Scenario: Displaying grouped skill details
Given a skill `weather` installed in:
- `.agents-common/skills/weather`
- `.claude/skills/weather`
When I run `sync-skills --list`
Then the output for `weather` should show:
- Name: `weather`
- Sites: `[common, claude]`
- Description: `Shows weather info` (if present)

## REMOVED Requirements

### Requirement: File Count Display
The `--list` feature SHALL NOT display file counts for skills.
