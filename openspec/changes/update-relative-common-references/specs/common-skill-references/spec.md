## ADDED Requirements
### Requirement: Relative @ references to common skills
When creating or updating platform skill files, the system SHALL write the @ reference as a relative path from the platform skill file location to the corresponding `.agents-common/skills/<skill>/SKILL.md` file.

#### Scenario: Refactor writes a nesting-aware reference
- **WHEN** a platform skill at `.claude/skills/example/SKILL.md` is refactored into `.agents-common/skills/example/SKILL.md`
- **THEN** the platform skill body SHALL be `@../../../.agents-common/skills/example/SKILL.md`

### Requirement: No backward compatibility for old references
The system SHALL treat `@.agents-common/skills/<skill>/SKILL.md` references as out-of-sync with the expected relative reference format.

#### Scenario: Detecting an old-format reference
- **GIVEN** a platform skill body is `@.agents-common/skills/example/SKILL.md`
- **WHEN** out-of-sync detection runs
- **THEN** the skill SHALL be marked as out of sync due to a reference mismatch
