## ADDED Requirements

### Requirement: Dual Path Support for Assistants

The system SHALL support AI assistants that use different skill directory paths for project-local and home/global configurations.

#### Scenario: Assistant with single path

- **WHEN** an assistant has only one skill path
- **THEN** the system SHALL configure it as a simple string value
- **AND** the path SHALL be used for project mode by default

#### Scenario: Assistant with dual paths

- **WHEN** an assistant has different paths for project and home
- **THEN** the system SHALL configure it as an object with `project` and `home` properties
- **AND** the `project` path SHALL be used when not in home mode
- **AND** the `home` path SHALL be used when `--home` flag is provided

#### Scenario: Backward compatibility

- **WHEN** an existing assistant config uses a string value
- **THEN** the system SHALL continue to work without modification
- **AND** the string value SHALL be treated as the project path

### Requirement: Assistant Configuration Structure

The system SHALL provide a type-safe configuration structure for assistant skill paths.

#### Scenario: Simple string configuration

- **WHEN** configuring assistants with a single path
- **THEN** the configuration MAY use a string: `'.claude/skills'`

#### Scenario: Object configuration

- **WHEN** configuring assistants with separate project and home paths
- **THEN** the configuration SHALL use an object: `{ project: '.windsurf/skills', home: '.codeium/windsurf/skills' }`

#### Scenario: AssistantConfig type includes home properties

- **WHEN** the system resolves an assistant configuration
- **THEN** the `AssistantConfig` interface SHALL include optional `homeDir` and `homeSkillsDir` properties
- **AND** these properties SHALL be populated when home mode is active

### Requirement: Path Resolution Based on Mode

The system SHALL resolve the correct skill directory path based on the current mode (project or home).

#### Scenario: Project mode (default)

- **WHEN** the tool runs without `--home` flag
- **THEN** the system SHALL use the `project` path from the assistant configuration
- **AND** the resolved `skillsDir` SHALL point to the project-local directory

#### Scenario: Home mode

- **WHEN** the tool runs with `--home` flag
- **THEN** the system SHALL use the `home` path from the assistant configuration
- **AND** the resolved `skillsDir` SHALL point to the home directory

#### Scenario: Fallback for assistants without home path

- **WHEN** home mode is active but an assistant has no `home` path configured
- **THEN** the system SHALL skip that assistant
- **AND** a warning SHALL be logged
