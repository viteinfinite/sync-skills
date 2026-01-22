# Change: Update common skill @ references to relative paths

## Why
Current @ references use `.agents-common/...` paths that assume a fixed root. We need nesting-aware references that work reliably across all platforms and locations.

## What Changes
- **BREAKING**: New @ references point to `.agents-common` via a relative path from each platform skill file (e.g., `@../../../.agents-common/skills/<skill>/SKILL.md`).
- Sync operations that create platform skill files use the nesting-aware relative reference.
- Out-of-sync detection compares against the new relative reference format; no backward compatibility for the old format.

## Impact
- Affected specs: `common-skill-references` (new capability)
- Affected code: reference generation and detection in sync/refactor flows, tests, and docs
