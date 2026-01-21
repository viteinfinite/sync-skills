---
name: before-pushing
description: Use when about to push commits to remote repository
metadata:
  sync:
    version: 2
    files: {}
    hash: sha256-421c4d99d991b3fe43b5caf55f847cc4138e03c9291c8b3ea603e509b5210405
---
# Before Pushing

## Overview
CRITICAL: Always verify the following checklist before pushing to remote.

## Checklist

- [ ] `npm run build` has run and `./dist/` is up to date
- [ ] Ensure the dist folder is committed

## Common Mistakes
- Pushing without committing the built dist folder
- Forgetting to run build before pushing
- Having uncommitted dist changes
