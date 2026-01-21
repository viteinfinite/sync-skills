# Tasks: Add --list mode

- [x] Update `src/types.ts`: Add `listMode?: boolean` to `RunOptions`.
- [x] Update `bin/sync-skills.ts`: Add `--list` and `-l` flags to `minimist` and handle them in the CLI entry point.
- [x] Implement `listSkills` logic in `src/index.ts`:
    - [x] Perform `scanSkills`.
    - [x] For each skill, extract description and count files.
    - [x] Format and print the list.
- [x] Add integration test or manual verification scenario:
    - [x] Create a dummy skill in a platform folder.
    - [x] Run `sync-skills --list` and verify output contains the skill.
- [x] Verify `--home` works with `--list`.
