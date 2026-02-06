## ADDED Requirements
### Requirement: Ignore Symlinked Platform Skills
The system SHALL treat any platform skill directory that is a symlink to `.sync-skills/skills/<skill>` as unmanaged and exclude it from sync/refactor processing.

#### Scenario: Sync skips symlinked skill directories
Given `.codex/skills/notes` is a symlink to `.sync-skills/skills/notes`
When I run `sync-skills`
Then the tool SHALL output `ignored notes because it was symlinked` and SHALL NOT refactor or sync `notes` into `.sync-skills`.
