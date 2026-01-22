## 1. Implementation
- [x] 1.1 Add a helper to compute nesting-aware @ references from a platform skill path to the common skill path.
- [x] 1.2 Update refactor/write paths to use the helper when creating platform skill references.
- [x] 1.3 Update sync flows that create skills from common (assistant cloning and common-only sync) to use the helper.
- [x] 1.4 Update out-of-sync detection to compare against the computed relative reference.

## 2. Tests
- [x] 2.1 Update unit tests for reference generation and out-of-sync detection.
- [x] 2.2 Update integration tests and fixtures that assert `@.agents-common/...` to the new relative format.

## 3. Docs
- [x] 3.1 Update README and TESTING docs to show the new reference format.

## 4. Validation
- [x] 4.1 Run `openspec validate update-relative-common-references --strict`.
- [x] 4.2 Run `npm run test:all`.
