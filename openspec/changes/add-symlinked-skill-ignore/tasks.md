## 1. Implementation
- [x] 1.1 Detect symlinked skill directories during scans (directory-level symlink to `.sync-skills/skills/<skill>`).
- [x] 1.2 Skip symlinked skills in sync/refactor flows and emit `ignored <skill> because it was symlinked` to stdout.
- [x] 1.3 Update list mode output to surface symlinked skills as unmanaged.

## 2. Tests
- [x] 2.1 Add integration tests that create `.claude/.codex` skill-dir symlinks to `.sync-skills/skills/<skill>`, assert ignore behavior and list output, and clean up symlinks.
- [x] 2.2 Run integration tests from `./test-dir` (`npm test:integration`).
