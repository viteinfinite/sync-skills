## ADDED Requirements
### Requirement: Publish on Version Tag
The system SHALL publish the npm package when a version tag is pushed.

#### Scenario: Tag-triggered publish
- **WHEN** a Git tag matching a version (for example, `v1.2.3`) is pushed
- **THEN** the workflow runs tests, builds the package, and publishes to npm

### Requirement: Authenticated npm Publish
The system SHALL use npm trusted publishing with GitHub Actions for registry authentication.

#### Scenario: Trusted publisher authentication
- **WHEN** the publish workflow runs
- **THEN** it authenticates using npm trusted publishing without registry tokens

### Requirement: Tag-Based Version Metadata
The system SHALL generate version metadata using the tag version and the commit short hash in the format `1.2.3-<shortsha>`.

#### Scenario: Version metadata generation
- **WHEN** the publish workflow runs for tag `v1.2.3`
- **THEN** the generated version metadata is `1.2.3-<shortsha>`

### Requirement: Tag-Matched Package Version
The system SHALL update `package.json` to the tag version prior to publishing without committing the change.

#### Scenario: Package version update without commit
- **WHEN** the publish workflow runs for tag `v1.2.3`
- **THEN** `package.json` version is set to `1.2.3` for the publish step without creating a commit
