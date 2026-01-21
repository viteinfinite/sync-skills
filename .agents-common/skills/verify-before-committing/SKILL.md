---
name: verify-before-committing
description: Use when about to create a git commit in this project
metadata:
  sync:
    version: 2
    files: {}
    hash: sha256-f854efdbffa81ee3b8eca20a8ce8e871192bff55608ecc59fcdd4f75c7504c21
---
# Verify Before Committing

## Overview
CRITICAL: Always verify the following checklist before creating any git commit.

## Checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] `npm run build` has run and `./dist/` is up to date

## Common Mistakes
- Committing without running tests first
- Forgetting to build before committing TypeScript changes
- Committing with outdated dist folder
