# Spec: Common-Only Skills Sync

## ADDED Requirements

### Requirement: Create assistant directories from common-only skills

When `.agents-common` contains skills that are referenced in the config but the corresponding assistant directories do not exist, the tool SHALL create those directories with @ references to the common skills.

#### Scenario: Project mode - only .agents-common exists

**GIVEN**:
- `.agents-common/skills/my-skill/SKILL.md` exists with content
- `.agents-common/config.json` contains `{ "assistants": ["claude", "gemini"] }`
- `.claude/` directory does NOT exist
- `.gemini/` directory does NOT exist

**WHEN** the user runs `sync-skills`

**THEN**:
- `.claude/skills/my-skill/SKILL.md` SHALL be created with an @ reference to `.agents-common/skills/my-skill/SKILL.md`
- `.gemini/skills/my-skill/SKILL.md` SHALL be created with an @ reference to `.agents-common/skills/my-skill/SKILL.md`
- Both created files SHALL include core frontmatter from the common skill

#### Scenario: Home mode - only .agents-common exists

**GIVEN**:
- `~/.agents-common/skills/my-skill/SKILL.md` exists with content
- `~/.agents-common/config.json` contains `{ "assistants": ["claude", "gemini"] }`
- `~/.claude/` directory does NOT exist
- `~/.gemini/` directory does NOT exist

**WHEN** the user runs `sync-skills --home`

**THEN**:
- `~/.claude/skills/my-skill/SKILL.md` SHALL be created with an @ reference to `~/.agents-common/skills/my-skill/SKILL.md`
- `~/.gemini/skills/my-skill/SKILL.md` SHALL be created with an @ reference to `~/.agents-common/skills/my-skill/SKILL.md`
- Both created files SHALL include core frontmatter from the common skill

### Requirement: Dependent files cleanup only for platforms that originally had files

When cleaning up dependent files from platform folders, the tool SHALL only attempt to delete files from platforms that originally had those files. Platforms that were newly created during the sync should not have cleanup attempted on them.

#### Scenario: Dependent files cleanup with newly created platform

**GIVEN**:
- `.claude/skills/new-suffixer/SKILL.md` exists with an @ reference to `.agents-common`
- `.claude/skills/new-suffixer/SUFFIX.txt` exists (a dependent file)
- `.agents-common/skills/new-suffixer/SKILL.md` exists with frontmatter tracking `SUFFIX.txt`
- `.agents-common/skills/new-suffixer/SUFFIX.txt` exists
- `.codex/` directory does NOT exist
- `.agents-common/config.json` contains `{ "assistants": ["claude", "codex"] }`

**WHEN** the user runs `sync-skills` and confirms creation of `.codex/skills`

**THEN**:
- `.codex/skills/new-suffixer/SKILL.md` SHALL be created with an @ reference
- `.codex/skills/new-suffixer/SUFFIX.txt` SHALL NOT be created (dependent files are centralized)
- NO warning SHALL be logged about failing to delete `.codex/skills/new-suffixer/SUFFIX.txt`
- The dependent file SHALL remain in `.agents-common/skills/new-suffixer/SUFFIX.txt`

### Requirement: Non-core frontmatter fields do not cause conflicts

When detecting conflicts between platform skill files, the tool SHALL only compare `CORE_FIELDS` (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`). Non-core fields like `model` are platform-specific and should be ignored.

#### Scenario: Different model fields do not cause conflict

**GIVEN**:
- `.claude/skills/my-skill/SKILL.md` exists with:
  ```yaml
  name: my-skill
  description: A test skill
  model: haiku-3.5
  @.agents-common/skills/my-skill/SKILL.md
  ```
- `.gemini/skills/my-skill/SKILL.md` exists with:
  ```yaml
  name: my-skill
  description: A test skill
  model: gemini-3-pro-preview
  @.agents-common/skills/my-skill/SKILL.md
  ```
- Both files have the same `name` and `description` (core fields)
- Both files reference the same common skill

**WHEN** the user runs `sync-skills`

**THEN**:
- NO conflict SHALL be detected
- The different `model` fields SHALL be ignored (not a core field)

### Requirement: Detect platform skills modified outside of sync-skills

When a platform skill file has been modified directly (outside of sync-skills), the tool SHALL detect the hash mismatch between the stored `metadata.sync.hash` and the calculated hash of the current file content. The tool SHALL warn the user and ask how to proceed.

#### Scenario: Platform skill modified externally - user applies edits to common

**GIVEN**:
- `.agents-common/skills/my-skill/SKILL.md` exists with content "Original content" and hash `sha256-abc123`
- `.claude/skills/my-skill/SKILL.md` exists with:
  - An @ reference to `.agents-common/skills/my-skill/SKILL.md`
  - `metadata.sync.hash: sha256-abc123` (matches common)
- User directly edits `.claude/skills/my-skill/SKILL.md` to change the body content from "@.agents-common/skills/my-skill/SKILL.md" to actual new content "Modified content"

**WHEN** the user runs `sync-skills`

**THEN**:
- A warning SHALL be displayed: "Skill `my-skill` in `.claude/skills/` has been modified outside of sync-skills"
- User SHALL be prompted: "Do you want to apply these edits to the common skill? (Yes/No/Skip)"
- When user selects "Yes":
  - The modified content SHALL be copied to `.agents-common/skills/my-skill/SKILL.md`
  - The hash SHALL be recalculated and updated in both common and platform files
  - Sync SHALL continue
- When user selects "No":
  - The common skill content SHALL be used (overwrites platform edits)
  - Sync SHALL continue
- When user selects "Skip":
  - The skill SHALL be left as-is
  - Sync SHALL continue with other skills

#### Scenario: Platform skill modified externally - user declines

**GIVEN**:
- Same setup as above, user modified `.claude/skills/my-skill/SKILL.md`

**WHEN** the user runs `sync-skills` and selects "No" at the prompt

**THEN**:
- The common skill content SHALL be preserved
- `.claude/skills/my-skill/SKILL.md` SHALL be updated to match the common skill (user's edits are discarded)
- Sync SHALL continue normally
