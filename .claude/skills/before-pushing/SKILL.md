---
name: before-pushing
description: Use when about to push commits to remote repository
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
