## 1. Implementation
- [x] 1.1 Add a publish workflow that triggers on version tags, runs tests, builds, and publishes via npm trusted publishing.
- [x] 1.2 Update version generation to emit <tag>-<shortsha> in src/version.ts and remove date-based suffixing.
- [x] 1.3 Ensure package.json version is updated to match the tag during publish without committing.
- [x] 1.4 Add/adjust tests if needed for version generation logic.

## 2. Validation
- [x] 2.1 Run unit tests.
- [x] 2.2 Run integration tests.
- [x] 2.3 Run npm run build and confirm dist is updated.
