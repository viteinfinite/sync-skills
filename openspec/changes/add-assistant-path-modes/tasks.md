## 1. Implementation

- [x] 1.1 Update `AssistantConfig` interface in `src/types.ts` to include optional `homeDir` and `homeSkillsDir` properties
- [x] 1.2 Update `ASSISTANT_MAP` type to `Record<string, string | AssistantPathConfig>`
- [x] 1.3 Create `AssistantPathConfig` interface with `project` and `home` string properties
- [x] 1.4 Update `getAssistantConfigs()` to accept `homeMode?: boolean` parameter
- [x] 1.5 Implement path resolution logic in `getAssistantConfigs()` - use `project` or `home` path based on mode
- [x] 1.6 Update `detectAvailableAssistants()` in `src/config.ts` to detect both project and home directories
- [x] 1.7 Update windsurf entry in `ASSISTANT_MAP` to use object form with both paths
- [x] 1.8 Update opencode entry in `ASSISTANT_MAP` to use object form with both paths
- [x] 1.9 Update all call sites of `getAssistantConfigs()` to pass appropriate mode

## 2. Testing

- [ ] 2.1 Add unit tests for `getAssistantConfigs()` with `homeMode` parameter
- [ ] 2.2 Add unit tests for string-form entries (backward compatibility)
- [ ] 2.3 Add unit tests for object-form entries (project and home modes)
- [ ] 2.4 Add unit tests for `detectAvailableAssistants()` detecting both directories
- [ ] 2.5 Add integration tests for windsurf project mode
- [ ] 2.6 Add integration tests for windsurf home mode
- [ ] 2.7 Add integration tests for opencode project mode
- [ ] 2.8 Add integration tests for opencode home mode

## 3. Validation

- [x] 3.1 Run existing test suite to ensure no regressions
- [x] 3.2 Run `npm run build` to verify TypeScript compilation
- [ ] 3.3 Manual test: sync skills in project mode for windsurf
- [ ] 3.4 Manual test: sync skills in home mode for windsurf using `--home` flag
