## ADDED Requirements

### Requirement: Self-Documentation Skill Installation

The system SHALL provide a mechanism to install a sync-skills documentation skill that explains the tool's main options to AI agents.

#### Scenario: Install self-skill via CLI flag

- **WHEN** the user runs `sync-skills --install-self-skill`
- **THEN** the system SHALL create `.agents-common/skills/sync-skills/SKILL.md`
- **AND** the file SHALL contain documentation about sync-skills options
- **AND** the system SHALL ask the user if they want to run sync now

#### Scenario: Prompt to sync after installation

- **WHEN** the sync-skills skill installation completes
- **THEN** the system SHALL prompt the user: "Skill installed. Would you like to run sync now?"
- **AND** if the user confirms, the system SHALL run the sync operation
- **AND** if the user declines, the system SHALL exit without syncing

#### Scenario: Skill file contains main options documentation

- **WHEN** the sync-skills skill is installed
- **THEN** the skill SHALL document these main options:
  - Basic sync (default behavior)
  - `--list` / `-l` for listing installed skills
  - `--home` / `-H` for home directory mode
  - `--reconfigure` / `-r` for changing settings
  - `--fail-on-conflict` / `-f` for strict mode

#### Scenario: Skill follows Agent Skill specification

- **WHEN** the skill file is created
- **THEN** it SHALL include proper frontmatter (name, description)
- **AND** it SHALL follow the Agent Skill specification format

#### Scenario: Idempotent installation

- **WHEN** `--install-self-skill` is run multiple times
- **THEN** the system SHALL overwrite the existing skill file
- **AND** no error SHALL be raised if the file already exists

#### Scenario: Installation before .agents-common exists

- **WHEN** `--install-self-skill` is run in a project without `.agents-common/`
- **THEN** the system SHALL create the `.agents-common/skills/sync-skills/` directory structure
- **AND** the skill file SHALL be created successfully

### Requirement: CLI Flag Integration

The system SHALL integrate the `--install-self-skill` flag with existing CLI options.

#### Scenario: Flag is mutually exclusive with sync operation

- **WHEN** `--install-self-skill` is provided
- **THEN** the system SHALL NOT automatically perform the sync operation
- **AND** the system SHALL NOT perform list operation
- **AND** the skill installation SHALL occur first
- **AND** sync SHALL only run if the user confirms the prompt

#### Scenario: Flag aliases

- **WHEN** the user wants to install the self-skill
- **THEN** the flag `--install-self-skill` SHALL be available
- **AND** a short alias `-s` SHALL also be available

#### Scenario: Help text includes new flag

- **WHEN** the user runs `sync-skills --help`
- **THEN** the help output SHALL include the `--install-self-skill` option
- **AND** a brief description SHALL be provided
