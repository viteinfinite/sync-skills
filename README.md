<div align="center">

# ⚡ sync-skills

**Synchronize AI agent skills across different platforms with a single command**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-20+-green.svg)](https://nodejs.org/)

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
```

That's it! The tool will:
1. Detect which AI assistants you use
2. Create a shared `.agents-common/` directory
3. Sync all your skills across platforms

---

## 💡 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Project                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  .agents-common/          ←  One place for all your skills   │
│  ├── skill-a/SKILL.md                                         │
│  └── skill-b/SKILL.md                                         │
│                                                               │
│  .claude/skills/           ←  References to common skills     │
│  ├── skill-a/SKILL.md     →  @.agents-common/skills/...      │
│  └── skill-b/SKILL.md                                        │
│                                                               │
│  .codex/skills/            ←  Same skills, same references    │
│  ├── skill-a/SKILL.md     →  @.agents-common/skills/...      │
│  └── skill-b/SKILL.md                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**The magic:** Edit once in `.agents-common/`, and all your AI assistants see the changes!

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
sync-skills

# 3. Done! All assistants now have access to this skill
```

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

- ✅ Skill body
- ✅ Frontmatter metadata (cf [Agent Skill Specs](https://agentskills.io/specification)):
  - name
  - description
  - allowed-tools
  - license
  - metadata
  - compatibility

---

## 🔧 Contributing & Debugging

### Custom Assistants

Easily add new AI assistants by extending the map in `src/types.ts`:

```typescript
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude',
  'codex': '.codex',
  'cursor': '.cursor',     // ← Add your own!
  'copilot': '.copilot'   // ← Add your own!
};
```

### Adding Skills via Script

Quickly create test skills:

```bash
npm run add-skill claude my-skill
npm run add-skill codex another-skill
```

## Contributions welcome!

---

<div align="center">

**Made with Claude Code**

</div>
