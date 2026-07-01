---
name: verify-after-pushing
description: Use when after pushing commits to remote repository
metadata:
  sync:
    version: 2
    files: {}
    hash: sha256-ccfb415996568b6714318dfc4937cc4b3a1ce2482b28226c8c54dfba26925e31
---
# Verify After Pushing

## Overview
CRITICAL: Always verify the following checklist after pushing to remote.

## Checklist

- [ ] `npx-test.sh` does not produce failures
- [ ] `npm-install-test.sh` does not produce failures

## Why This Matters
Git push succeeding does not mean the package actually works. These scripts verify the package is installable and functional.

## Common Mistakes
- Assuming successful push means package works
- Skipping verification after "git push succeeded"
- Closing work without testing package installation
