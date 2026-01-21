# Design: Skill Listing Mode

## Architecture

The listing mode will be implemented as a separate branch in the `run` function in `src/index.ts`. When `listMode` is enabled in `RunOptions`, the tool will perform a scan and display results instead of proceeding with the sync logic.

### Data Gathering
1. **Scanning**: Use `scanSkills` with all supported assistant configurations (obtained via `getAssistantConfigs(undefined, homeMode)`) to find all `SKILL.md` files.
2. **Parsing**: For each found `SKILL.md`:
   - Read the file content.
   - Use `parseSkillFile` to extract frontmatter.
   - If the body starts with an `@` reference (e.g., `@.agents-common/skills/...`), attempt to read the referenced file to get the actual description if it's missing from the platform file's frontmatter.
3. **File Counting**:
   - For each skill, identify its directory (parent of `SKILL.md`).
   - Recursively count all files in that directory.
4. **Site Identification**:
   - Use the `agent` property from `WalkDirResult` to identify the where it's installed (e.g., `claude`, `codex`, `common`).

### Output Formatting
The output will be a formatted list (likely a simple table or structured lines) showing:
- **Name**: The skill name.
- **Description**: Trimmed description from frontmatter.
- **Site**: Where the skill is installed.
- **Files**: Total number of files in the skill directory.

### Performance Considerations
- Scanning many directories and reading many `SKILL.md` files might be slow on large collections. Parallelize where possible.
- File counting should be efficient.

## Alternatives Considered
- **Group by skill name**: Instead of listing each install location separately, group all install locations for a single skill.
  - *Pros*: More compact if many duplicates.
  - *Cons*: Harder to show location-specific file counts if they differ.
  - *Decision*: List each install location separately to be explicit about what exists where.
