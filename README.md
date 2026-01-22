<div align="center">

# ⚡ sync-skills

**Synchronize AI agent skills across different platforms with a single command**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-46%2F46-brightgreen.svg)](https://github.com/viteinfinite/sync-skills/actions)

</div>

---

## ✨ Why?

Managing the same AI agent skills across multiple platforms (Claude, Cursor Copilot, etc.) is **painful**. You end up duplicating files, keeping them in sync manually, and dealing with version conflicts.

**sync-skills** solves this by:
- 🔄 **Keep skills in sync** across all your AI assistants automatically
- 📦 **Single source of truth** in `.agents-common/` directory
- 🚀 **Auto-setup** on first run - just run and go
- ⚙️ **Reconfigure anytime** with interactive prompts

### Why not just use symlinks?

You might wonder: *"Why not just symlink `.claude/skills`, `.codex/skills`, etc. to a common directory?"*

While symlinks work for basic cases, **sync-skills** provides important advantages:

**1. Assistant-specific frontmatter values**

Different assistants may need different configurations for the same skill:

```yaml
---
name: my-skill
description: A useful skill
# Assistant-specific model selection:
model: claude-sonnet-4-5 # ← Claude-specific. With sync-skills, this will not get copied to other assistants
---
```

With symlinks, all assistants would share the same frontmatter. sync-skills maintains separate `SKILL.md` files per platform while keeping the skill body in sync, allowing per-assistant customization.

**2. Bring-your-own-assistant (BYOA) policies**

Many companies have policies allowing developers to use their preferred AI assistants. With sync-skills:

- Each developer can run with their own assistant set: `sync-skills --reconfigure`
- Skills sync across all configured assistants automatically
- No need to maintain separate skill sets or manually copy files
- Works seamlessly whether you use Claude, Cursor, Windsurf, or all of them

**3. Conflict resolution and safety**

- Hash-based conflict detection when dependent files change
- Interactive prompts before creating new directories

---

## 🚀 Quick Start

```bash
# Install
npm install -g @viteinfinite/sync-skills

# Run in your project
sync-skills
```

Note: this repo includes prebuilt `dist/` output so git installs work without running a build step.
If you change source files locally, run `npm run build` to refresh `dist/`.

That's it! The tool will:
1. Prompt you to select which AI assistants to configure (preselecting detected ones)
2. Create a shared `.agents-common/` directory
3. Sync all your skills across platforms

---

## 🤖 Supported Assistants

sync-skills supports the following AI assistants out of the box:

| Assistant | Project Directory | Home Directory | Description |
|-----------|-------------------|----------------|-------------|
| **amp** | `.agents/skills` | — | Amp |
| **claude** | `.claude/skills` | — | Claude Code |
| **cline** | `.cline/skills` | — | Cline |
| **codex** | `.codex/skills` | — | Codex |
| **cursor** | `.cursor/skills` | — | Cursor |
| **gemini** | `.gemini/skills` | — | Google Gemini |
| **github** | `.github/skills` | — | GitHub Copilot |
| **kilo** | `.kilocode/skills` | — | Kilo |
| **opencode** | `.opencode/skill` | `.config/opencode/skill` | OpenCode |
| **roo** | `.roo/skills` | — | Roo Code |
| **windsurf** | `.windsurf/skills` | `.codeium/windsurf/skills` | Codeium Windsurf |

*Some assistants have separate project and home directory configurations. Use `--home` flag to sync home directories.*

### Adding Custom Assistants

You can easily add support for additional AI assistants by editing `src/types.ts`:

```typescript
export const ASSISTANT_MAP: Record<string, string | AssistantPathConfig> = {
  // ... existing entries
  'your-assistant': '.your-folder/skills',  // ← Simple string

  // Or with separate project/home paths:
  'another-assistant': {
    project: '.project/skills',
    home: '.config/assistant/skills'
  },
};
```

Then rebuild and reinstall:

```bash
npm run build
npm install -g .
```

---

## 💡 How It Works

```
┌──────────────────────────────────────────────────────────────────┐
│                           Your Project                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  .agents-common/          ←  One place for all your skills       │
│  ├── skill-a/SKILL.md                                            │
│  ├── skill-a/util.js      ←  Supporting files also synced!       │
│  ├── skill-a/docs/guide.md                                       │
│  └── skill-b/SKILL.md                                            │
│                                                                  │
│  .claude/skills/          ←  References to common skills         │
│  ├── skill-a/SKILL.md     →  @../../../.agents-common/skills/... |
│  └── skill-b/SKILL.md     →  (dependent files removed)           │
│                                                                  │
│  .codex/skills/           ←  Same skills, same references        │
│  ├── skill-a/SKILL.md     →  @../../../.agents-common/skills/... │
│  └── skill-b/SKILL.md     →  (dependent files removed)           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**The magic:** Edit once in `.agents-common/`, and all your AI assistants see the changes!

**Dependent files** (scripts, docs, configs) are automatically centralized in `.agents-common/` with hash-based conflict resolution.

---

## 📖 Usage

### Basic Sync

```bash
sync-skills              # Sync all configured assistants
```

### List Installed Skills

Get an overview of all skills installed across your configured assistant platforms:

```bash
sync-skills --list       # Grouped list of installed skills
# or
sync-skills -l
```

Example output:
```
before-pushing           [common, claude, codex] - Use when about to push commits to remote repository
my-custom-skill          [common, gemini] - A custom workflow for my project
```

### Home Directory Mode

Keep your personal skill collection in `~/` and share across projects:

```bash
sync-skills --home       # Sync ~/.claude, ~/.codex, ~/.agents-common
```

### Reconfigure

Change which assistants to sync:

```bash
sync-skills --reconfigure    # Interactive checkbox prompt
```

### Strict Mode

```bash
sync-skills --fail-on-conflict    # Exit on conflicts without conflict resolution prompts
```

---

## 🎯 Common Workflows

### Adding a New Skill

```bash
# 1. Create skill in common directory
mkdir -p .agents-common/skills/my-new-skill
echo "# My Skill" > .agents-common/skills/my-new-skill/SKILL.md

# 2. Run sync
npx github:viteinfinite/sync-skills

# 3. ✅ Done! All assistants now have access to this skill
#    🔗 .claude/skills/ and .codex/skills/ both reference the common files
```

### Syncing Existing .claude Skills to .codex

```bash
# 1. Ensure you have existing skills in .claude/skills/
ls .claude/skills/

# 2. Run sync (auto-detects both .claude and .codex)
npx github:viteinfinite/sync-skills

# 3. ✅ Skills are now available in both assistants!
#    📁 .agents-common/ contains the source of truth
#    🔗 .claude/skills/ and .codex/skills/ both reference the common files
```

**What happens:**
- Existing `.claude` skills are moved to `.agents-common/`
- Both `.claude` and `.codex` get reference files pointing to common skills
- Future edits in `.agents-common/` sync to both platforms automatically

### Setting Up a New Project

```bash
cd my-new-project
sync-skills    # Auto-detects and sets up everything
```

---

## 🛠️ Configuration

Configuration is stored in `.agents-common/config.json`:

```json
{
  "version": 1,
  "assistants": ["claude", "codex"]
}
```

**Auto-created on first run** - no manual setup needed!

---

## 📚 What Gets Synced

### Skills (SKILL.md)
- ✅ Skill body
- ✅ Frontmatter metadata (cf [Agent Skill Specs](https://agentskills.io/specification)):
  - name
  - description
  - allowed-tools
  - license
  - metadata
  - compatibility

### Dependent Files
- ✅ **All non-SKILL.md files** in skill folders are also synced:
  - Documentation (`README.md`, `guide.md`, `docs/reference.md`)
  - Utility scripts (`scripts/util.js`, `helpers/*.ts`)
  - Config files (`config.json`, `schema.yaml`)
  - Any other supporting files

**How it works:**
1. Dependent files are centralized in `.agents-common/skills/{skill}/`
2. Platform folders contain only `SKILL.md` (with `@` references)
3. Hash-based conflict resolution detects changes (main hash includes all files)

---

## 🔧 Contributing & Debugging

> **💡 See [Supported Assistants](#-supported-assistants) above for how to add custom AI assistants.**

### Adding Skills via Script

Quickly create test skills:

```bash
npm run add-skill claude my-skill
npm run add-skill codex another-skill
```

---

## 🧪 Testing

The project uses a comprehensive test suite with separate unit and integration tests:

```bash
# Run unit tests only
npm test

# Run integration tests only
npm run test:integration

# Run all tests
npm run test:all

# Clean up test fixtures
npm run test:clean
```

**CI/CD Pipeline:**
- ✅ **unit-tests** - Fast configuration and parsing tests
- ✅ **integration-tests** - Full workflow validation with real file operations
- Both run in parallel for quick feedback

---

## Contributions welcome!

---

<div align="center">

**Made with Claude Code**

</div>
