# Tasks: Group locations in skill list

- [x] Update `listSkills` in `src/index.ts`:
    - [x] Change `allSkills` to a Map-based grouping structure.
    - [x] Update `processSkill` to merge results into the grouped structure.
    - [x] Implement site sorting logic (common first, then alphabetical).
    - [x] Update the console output loop to use the grouped data.
    - [x] Remove file counting logic and display.
- [x] Update `test/list.test.ts`:
    - [x] Update existing tests to expect grouped output without file counts.
- [x] Verify `--home` works with grouped output.
