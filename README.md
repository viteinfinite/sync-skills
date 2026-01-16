<div align="center">

# ⚡ sync-skills

**Synchronize AI agent skills across different platforms with a single command**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-35%2F35-brightgreen.svg)](https://github.com/viteinfinite/sync-skills/actions)

</div>

---

## ✨ Why?

Managing the same AI agent skills across multiple platforms (Claude, Cursor Copilot, etc.) is **painful**. You end up duplicating files, keeping them in sync manually, and dealing with version conflicts.

**sync-skills** solves this by:
- 🔄 **Keep skills in sync** across all your AI assistants automatically
- 📦 **Single source of truth** in `.agents-common/` directory
- 🚀 **Auto-setup** on first run - just run and go
- ⚙️ **Reconfigure anytime** with interactive prompts

---

## 🚀 Quick Start

```bash
# Install
npm install -g sync-skills

# Run in your project
sync-skills

# Or using npx
npx viteinfinite/sync-skills
```

That's it! The tool will:
1. Detect which AI assistants you use
2. Create a shared `.agents-common/` directory
3. Sync all your skills across platforms

---

## 🤖 Supported Assistants

sync-skills supports the following AI assistants out of the box:

| Assistant | Directory | Description |
|-----------|-----------|-------------|
| **claude** | `.claude/skills` | Claude Code / Anthropic Claude |
| **codex** | `.codex/skills` | Cursor Copilot / Codex |
| **kilo** | `.kilocode/skills` | Kilocode AI assistant |

### Custom Assistants

You can easily add support for additional AI assistants by editing `src/types.ts`:

```typescript
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude/skills',
  'codex': '.codex/skills',
  'kilo': '.kilocode/skills',
  'your-assistant': '.your-folder/skills',  // ← Add your own!
};
```

Then rebuild and reinstall:

```bash
npm run build
npm link  # or npm install -g .
```

---

## 💡 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Project                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  .agents-common/          ←  One place for all your skills  │
│  ├── skill-a/SKILL.md                                       │
│  ├── skill-a/util.js      ←  Supporting files also synced!  │
│  ├── skill-a/docs/guide.md                                  │
│  └── skill-b/SKILL.md                                       │
│                                                             │
│  .claude/skills/          ←  References to common skills    │
│  ├── skill-a/SKILL.md     →  @.agents-common/skills/...     │
│  └── skill-b/SKILL.md     →  (dependent files removed)      │
│                                                             │
│  .codex/skills/           ←  Same skills, same references   │
│  ├── skill-a/SKILL.md     →  @.agents-common/skills/...     │
│  └── skill-b/SKILL.md     →  (dependent files removed)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**The magic:** Edit once in `.agents-common/`, and all your AI assistants see the changes!

**Dependent files** (scripts, docs, configs) are automatically centralized in `.agents-common/` with hash-based conflict resolution.

---

## 📖 Usage

### Basic Sync

```bash
sync-skills              # Sync all configured assistants
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

### Preview Changes

```bash
sync-skills --dry-run        # Show what would change
```

### Strict Mode

```bash
sync-skills --fail-on-conflict    # Exit on conflicts (for CI/CD)
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
3. Hash-based conflict resolution detects changes
4. File hashes stored in `metadata.sync.files` frontmatter

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
