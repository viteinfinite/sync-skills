---
name: verify-before-committing
description: Use when about to create a git commit in this project
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
