# Change: Add npm publish workflow

## Why
Publishing is manual and version metadata is date-based, which makes releases harder to track and automate.

## What Changes
- Add a GitHub Actions workflow to publish to npm on version tags.
- Update version generation to use tag version plus commit short hash.
- Update package.json version during publish to match the tag without committing.

## Impact
- Affected specs: release-publish (new)
- Affected code: scripts/generate-version.mjs, .github/workflows/
