## Context
Platform skills currently embed `@.agents-common/skills/<skill>/SKILL.md`, which assumes a root-relative resolution. We need references that are correct relative to each platform skill file regardless of nesting depth and platform directory layout.

## Goals / Non-Goals
- Goals:
  - Generate @ references that are relative to the platform skill file location.
  - Support all assistants and both project/home paths.
  - Treat old `@.agents-common/...` references as out-of-sync (no backward compatibility).
- Non-Goals:
  - Auto-migrate or rewrite existing platform skills that already use the old reference format.
  - Introduce new config flags or user prompts.

## Decisions
- Decision: Compute the @ reference by taking the relative path from the platform skill directory to the common skill file, then prefix with `@`.
  - Rationale: This produces a correct path regardless of nesting depth or assistant directory structure.
- Decision: Normalize path separators to `/` in the reference string.
  - Rationale: Skill files are text and should use a consistent separator across platforms.

## Alternatives considered
- Keep `@.agents-common/...` and add lookup logic in consumers.
  - Rejected: Does not address the nesting issue and delays the needed breaking change.
- Convert to absolute paths.
  - Rejected: Less portable across machines and repositories.

## Risks / Trade-offs
- Existing platform skills with the old reference will be flagged as out-of-sync and require manual resolution.
- Some documentation and tests must be updated to reflect the new format.

## Migration Plan
- Update reference generation to use relative paths.
- Update out-of-sync detection to compute expected relative references.
- Update tests and docs to reflect the new reference format.

## Open Questions
- None.
