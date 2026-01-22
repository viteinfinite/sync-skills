## 1. CLI Implementation

- [x] 1.1 Add `installSelfSkill` boolean property to `RunOptions` interface in `src/types.ts`
- [x] 1.2 Add `--install-self-skill` and `-s` flags to minimist config in `bin/sync-skills.ts`
- [x] 1.3 Add help text for `--install-self-skill` in the `--help` output
- [x] 1.4 Pass `installSelfSkill` option to `run()` function call

## 2. Core Implementation

- [x] 2.1 Add `installSelfSkill` parameter handling in `run()` function in `src/index.ts`
- [x] 2.2 Create `installSyncSkillsSkill()` function to handle skill installation
- [x] 2.3 Implement directory creation logic for `.agents-common/skills/sync-skills/`
- [x] 2.4 Create skill content template with sync-skills documentation
- [x] 2.5 Implement user prompt after installation: "Skill installed. Would you like to run sync now?"
- [x] 2.6 If user confirms prompt, run the sync operation; otherwise exit

## 3. Skill Content

- [x] 3.1 Write skill frontmatter (name: "sync-skills", description)
- [x] 3.2 Document basic sync operation (default behavior)
- [x] 3.3 Document `--list` / `-l` option
- [x] 3.4 Document `--home` / `-H` option
- [x] 3.5 Document `--reconfigure` / `-r` option
- [x] 3.6 Document `--fail-on-conflict` / `-f` option
- [x] 3.7 Keep documentation brief and agent-focused

## 4. Testing

- [ ] 4.1 Add unit tests for `installSyncSkillsSkill()` function
- [ ] 4.2 Add unit tests for directory creation logic
- [ ] 4.3 Add integration test for `--install-self-skill` flag
- [ ] 4.4 Add integration test for idempotent installation (overwriting existing)
- [ ] 4.5 Add integration test for installation in new project (no .agents-common)
- [ ] 4.6 Add integration test: user declines prompt, no sync occurs
- [ ] 4.7 Add integration test: user accepts prompt, sync runs successfully

## 5. Validation

- [x] 5.1 Run `npm run build` to verify TypeScript compilation
- [x] 5.2 Run existing test suite to ensure no regressions
- [x] 5.3 Manual test: Run `sync-skills --install-self-skill` and verify skill file creation
- [x] 5.4 Manual test: Verify installed skill file has correct content
- [ ] 5.5 Manual test: Run flag twice and verify idempotent behavior
- [x] 5.6 Manual test: Run `sync-skills --help` and verify flag is documented
- [ ] 5.7 Manual test: Accept the sync prompt and verify sync runs
- [ ] 5.8 Manual test: Decline the sync prompt and verify tool exits without syncing
