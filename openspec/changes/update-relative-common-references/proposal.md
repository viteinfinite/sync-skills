# Change: Update common skill @ references to relative paths

## Why
Current @ references use `.agents/...` paths that assume a fixed root. We need nesting-aware references that work reliably across all platforms and locations.

## What Changes
- **BREAKING**: New @ references point to `.agents` via a relative path from each platform skill file (e.g., `@../../../.agents/skills/<skill>/SKILL.md`).
- Sync operations that create platform skill files use the nesting-aware relative reference.
- Out-of-sync detection compares against the new relative reference format; no backward compatibility for the old format.

## Impact
- Affected specs: `common-skill-references` (new capability)
- Affected code: reference generation and detection in sync/refactor flows, tests, and docs
