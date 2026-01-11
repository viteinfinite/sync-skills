# sync-skills

Synchronize agent skill definitions between `.claude/` and `.codex/` directories.

## Installation

```bash
npm install -g sync-skills
```

## Usage

```bash
# Sync skills from .claude/ to .codex/
sync-skills

# Sync skills from .codex/ to .claude/
sync-skills --reverse

# Specify custom directories
sync-skills --source .claude/ --target .codex/
```

## Features

- Bidirectional synchronization between `.claude/` and `.codex/` directories
- Preserves frontmatter metadata
- Handles skill definition files
- Interactive CLI with prompts
- Colored output and spinners for better UX

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test
```

## License

MIT
