---
name: verify-after-pushing
description: Use when after pushing commits to remote repository
---

# Verify After Pushing

## Overview
CRITICAL: Always verify the following checklist after pushing to remote.

## Checklist

- [ ] `./scripts/npx-test.sh` does not produce failures
- [ ] `./scripts/npm-install-test.sh` does not produce failures

## Why This Matters
Git push succeeding does not mean the package actually works. These scripts verify the package is installable and functional.

## Common Mistakes
- Assuming successful push means package works
- Skipping verification after "git push succeeded"
- Closing work without testing package installation
