# sync-skills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an npm package that synchronizes agent skill definitions between `.claude/` and `.codex/` directories, extracting shared content to `.agents-common/` using `@`-based static linking.

**Architecture:** A CLI tool that scans skill files, parses frontmatter, detects conflicts via hash comparison, refactors content to `.agents-common/`, and provides interactive conflict resolution. The `@` reference syntax is handled natively by the agent system - this tool only manages file structure and metadata.

**Tech Stack:** Node.js, gray-matter (frontmatter parsing), inquirer (interactive prompts), chalk (terminal colors), ora (spinners), minimist (CLI args), mocha/chai (testing)

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `README.md`
- Create: `.gitignore`
- Create: `bin/sync-skills.js`

**Step 1: Create package.json**

```bash
cat > package.json << 'EOF'
{
  "name": "sync-skills",
  "version": "0.1.0",
  "description": "Synchronize agent skills between .claude and .codex directories",
  "main": "src/index.js",
  "bin": {
    "sync-skills": "./bin/sync-skills.js"
  },
  "scripts": {
    "test": "mocha test/**/*.test.js"
  },
  "dependencies": {
    "chalk": "^5.3",
    "gray-matter": "^4.0",
    "inquirer": "^9.2",
    "minimist": "^1.2",
    "ora": "^7.0"
  },
  "devDependencies": {
    "chai": "^5.0",
    "mocha": "^10.0"
  },
  "type": "module"
}
EOF
```

**Step 2: Create README.md**

```bash
cat > README.md << 'EOF'
# sync-skills

Synchronize agent skill definitions between `.claude/` and `.codex/` directories.

## Installation

```bash
npm install
npm link
```

## Usage

```bash
sync-skills              # Interactive sync
sync-skills --fail-on-conflict    # Fail on conflicts
sync-skills --dry-run            # Show changes without applying
```
EOF
```

**Step 3: Create .gitignore**

```bash
cat > .gitignore << 'EOF'
node_modules/
*.log
.DS_Store
EOF
```

**Step 4: Create bin directory and entry point**

```bash
mkdir -p bin
cat > bin/sync-skills.js << 'EOF'
#!/usr/bin/env node

import { run } from '../src/index.js';

run();
EOF

chmod +x bin/sync-skills.js
```

**Step 5: Commit**

```bash
git add package.json README.md .gitignore bin/sync-skills.js
git commit -m "feat: initial project setup"
```

---

## Task 2: Parser Module (Frontmatter Split)

**Files:**
- Create: `src/parser.js`
- Create: `test/parser.test.js`

**Step 1: Write the failing test**

```bash
mkdir -p src test
cat > test/parser.test.js << 'EOF'
import { expect } from 'chai';
import { parseSkillFile } from '../src/parser.js';

describe('parseSkillFile', () => {
  it('should split frontmatter and body', () => {
    const content = `---
name: pr-review
description: Review PRs
---

# PR Review

Some content`;

    const result = parseSkillFile(content);

    expect(result.frontmatter).to.deep.equal({
      name: 'pr-review',
      description: 'Review PRs'
    });
    expect(result.body).to.equal('# PR Review\n\nSome content');
    expect(result.hasAtReference).to.be.false;
  });

  it('should detect @ reference in body', () => {
    const content = `---
name: pr-review
---

@.agents-common/skills/pr-review/SKILL.md`;

    const result = parseSkillFile(content);

    expect(result.hasAtReference).to.be.true;
  });

  it('should handle file without frontmatter', () => {
    const content = `# Just content

No frontmatter here`;

    const result = parseSkillFile(content);

    expect(result).to.be.null;
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find import '../src/parser.js'"

**Step 3: Write minimal implementation**

```bash
cat > src/parser.js << 'EOF'
import matter from 'gray-matter';

export function parseSkillFile(content) {
  const parsed = matter(content);

  // gray-matter returns empty object for no frontmatter
  // check if there was actual frontmatter by looking for --- in original
  const hasFrontmatter = content.startsWith('---');

  if (!hasFrontmatter || Object.keys(parsed.data).length === 0) {
    // Check if this is truly no frontmatter or just empty
    if (!content.trim().startsWith('---')) {
      return null;
    }
  }

  const body = parsed.content.trim();
  const hasAtReference = body.startsWith('@');

  return {
    frontmatter: parsed.data,
    body: parsed.content,
    hasAtReference
  };
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/parser.js test/parser.test.js
git commit -m "feat: add parser module for frontmatter splitting"
```

---

## Task 3: Scanner Module (File Discovery)

**Files:**
- Create: `src/scanner.js`
- Create: `test/scanner.test.js`

**Step 1: Write the failing test**

```bash
cat > test/scanner.test.js << 'EOF'
import { expect } from 'chai';
import { scanSkills } from '../src/scanner.js';
import { fs } from 'fs/promises';

describe('scanSkills', () => {
  const testDir = './test/fixtures/scan';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.codex/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.agents-common/skills/test-skill`, { recursive: true });

    await fs.writeFile(`${testDir}/.claude/skills/test-skill/SKILL.md`, 'content');
    await fs.writeFile(`${testDir}/.codex/skills/test-skill/SKILL.md`, 'content');
    await fs.writeFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'content');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should scan all skill files from target directories', async () => {
    const result = await scanSkills(testDir);

    expect(result.claude).to.have.lengthOf(1);
    expect(result.codex).to.have.lengthOf(1);
    expect(result.common).to.have.lengthOf(1);
  });

  it('should return skill metadata', async () => {
    const result = await scanSkills(testDir);

    expect(result.claude[0]).to.include({
      agent: 'claude',
      skillName: 'test-skill',
      path: `${testDir}/.claude/skills/test-skill/SKILL.md`
    });
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find import '../src/scanner.js'"

**Step 3: Write minimal implementation**

```bash
cat > src/scanner.js << 'EOF'
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function* walkDir(dir, baseDir = dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walkDir(fullPath, baseDir);
      } else if (entry.name === 'SKILL.md') {
        const relativePath = fullPath.substring(baseDir.length + 1);
        const parts = relativePath.split('/');
        const agent = parts[0].replace('.', '');
        const skillName = parts[2];

        yield {
          agent,
          skillName,
          path: fullPath,
          relativePath
        };
      }
    }
  } catch (e) {
    // Directory doesn't exist
  }
}

export async function scanSkills(baseDir = process.cwd()) {
  const claude = [];
  const codex = [];
  const common = [];

  for await (const skill of walkDir(join(baseDir, '.claude'))) {
    claude.push(skill);
  }

  for await (const skill of walkDir(join(baseDir, '.codex'))) {
    codex.push(skill);
  }

  for await (const skill of walkDir(join(baseDir, '.agents-common'))) {
    common.push(skill);
  }

  return { claude, codex, common };
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/scanner.js test/scanner.test.js
git commit -m "feat: add scanner module for file discovery"
```

---

## Task 4: Detector Module (Conflict Detection)

**Files:**
- Create: `src/detector.js`
- Create: `test/detector.test.js`

**Step 1: Write the failing test**

```bash
cat > test/detector.test.js << 'EOF'
import { expect } from 'chai';
import { detectConflicts } from '../src/detector.js';
import { promises as fs } from 'fs';

describe('detectConflicts', () => {
  const testDir = './test/fixtures/detect';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.codex/skills/test-skill`, { recursive: true });

    await fs.writeFile(`${testDir}/.claude/skills/test-skill/SKILL.md`, 'content A');
    await fs.writeFile(`${testDir}/.codex/skills/test-skill/SKILL.md`, 'content B');
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect conflicts when same skill has different content', async () => {
    const claudeSkills = [{ skillName: 'test-skill', path: `${testDir}/.claude/skills/test-skill/SKILL.md` }];
    const codexSkills = [{ skillName: 'test-skill', path: `${testDir}/.codex/skills/test-skill/SKILL.md` }];

    const conflicts = await detectConflicts(claudeSkills, codexSkills);

    expect(conflicts).to.have.lengthOf(1);
    expect(conflicts[0].skillName).to.equal('test-skill');
  });

  it('should not detect conflicts when content is identical', async () => {
    await fs.writeFile(`${testDir}/.codex/skills/test-skill/SKILL.md`, 'content A');

    const claudeSkills = [{ skillName: 'test-skill', path: `${testDir}/.claude/skills/test-skill/SKILL.md` }];
    const codexSkills = [{ skillName: 'test-skill', path: `${testDir}/.codex/skills/test-skill/SKILL.md` }];

    const conflicts = await detectConflicts(claudeSkills, codexSkills);

    expect(conflicts).to.have.lengthOf(0);
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find import '../src/detector.js'"

**Step 3: Write minimal implementation**

```bash
cat > src/detector.js << 'EOF'
import { promises as fs } from 'fs';
import { createHash } from 'crypto';

async function hashFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return createHash('sha256').update(content).digest('hex');
}

export async function detectConflicts(claudeSkills, codexSkills) {
  const conflicts = [];

  for (const claudeSkill of claudeSkills) {
    const codexSkill = codexSkills.find(s => s.skillName === claudeSkill.skillName);

    if (codexSkill) {
      const claudeHash = await hashFile(claudeSkill.path);
      const codexHash = await hashFile(codexSkill.path);

      if (claudeHash !== codexHash) {
        conflicts.push({
          skillName: claudeSkill.skillName,
          claudePath: claudeSkill.path,
          codexPath: codexSkill.path
        });
      }
    }
  }

  return conflicts;
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/detector.js test/detector.test.js
git commit -m "feat: add detector module for conflict detection"
```

---

## Task 5: Resolver Module (Interactive Prompts)

**Files:**
- Create: `src/resolver.js`
- Create: `test/resolver.test.js`

**Step 1: Write the failing test**

```bash
cat > test/resolver.test.js << 'EOF'
import { expect } from 'chai';
import sinon from 'sinon';
import { resolveConflict } from '../src/resolver.js';

describe('resolveConflict', () => {
  it('should return claude version when option 1 is chosen', async () => {
    const inquirerStub = sinon.stub().resolves({ action: 'use-claude' });

    const result = await resolveConflict(
      { skillName: 'test', claudePath: '/a', codexPath: '/b' },
      inquirerStub
    );

    expect(result.action).to.equal('use-claude');
    expect(inquirerStub).to.have.been.calledOnce;
  });

  it('should return keep-both when option 3 is chosen', async () => {
    const inquirerStub = sinon.stub().resolves({ action: 'keep-both' });

    const result = await resolveConflict(
      { skillName: 'test', claudePath: '/a', codexPath: '/b' },
      inquirerStub
    );

    expect(result.action).to.equal('keep-both');
  });
});
EOF
```

**Step 2: Install sinon and run test to verify it fails**

```bash
npm install --save-dev sinon
npm test
```

Expected: FAIL with "Cannot find import '../src/resolver.js'"

**Step 3: Write minimal implementation**

```bash
cat > src/resolver.js << 'EOF'
import inquirer from 'inquirer';

export async function resolveConflict(conflict, inquirerImpl = inquirer) {
  const { action } = await inquirerImpl.prompt([
    {
      type: 'list',
      name: 'action',
      message: `Conflict detected: ${conflict.skillName}`,
      choices: [
        { name: 'Use .claude version (overwrite .codex)', value: 'use-claude' },
        { name: 'Use .codex version (overwrite .claude)', value: 'use-codex' },
        { name: 'Keep both unchanged', value: 'keep-both' },
        { name: 'Show diff', value: 'show-diff' },
        { name: 'Abort', value: 'abort' }
      ]
    }
  ]);

  return { action, conflict };
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/resolver.js test/resolver.test.js package.json
git commit -m "feat: add resolver module for interactive prompts"
```

---

## Task 6: Syncer Module (Refactor + Copy)

**Files:**
- Create: `src/syncer.js`
- Create: `test/syncer.test.js`

**Step 1: Write the failing test**

```bash
cat > test/syncer.test.js << 'EOF'
import { expect } from 'chai';
import { refactorSkill } from '../src/syncer.js';
import { promises as fs } from 'fs';

describe('refactorSkill', () => {
  const testDir = './test/fixtures/refactor';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.agents-common/skills/test-skill`, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should extract body to .agents-common and replace with @ reference', async () => {
    const sourcePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    await fs.writeFile(sourcePath, `---
name: test-skill
description: Test skill
---

# Content

This is content`);

    await refactorSkill(sourcePath);

    const sourceContent = await fs.readFile(sourcePath, 'utf8');
    const commonPath = `${testDir}/.agents-common/skills/test-skill/SKILL.md`;
    const commonContent = await fs.readFile(commonPath, 'utf8');

    expect(sourceContent).to.include('@.agents-common/skills/test-skill/SKILL.md');
    expect(sourceContent).to.include('managed-by: sync-skills');
    expect(sourceContent).to.include('refactored:');
    expect(commonContent).to.equal('# Content\n\nThis is content');
  });

  it('should not refactor if @ reference already exists', async () => {
    const sourcePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    await fs.writeFile(sourcePath, `---
name: test-skill
---

@.agents-common/skills/test-skill/SKILL.md`);

    await fs.writeFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'original');

    await refactorSkill(sourcePath);

    const commonContent = await fs.readFile(`${testDir}/.agents-common/skills/test-skill/SKILL.md`, 'utf8');
    expect(commonContent).to.equal('original'); // Should not overwrite
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find import '../src/syncer.js'"

**Step 3: Write minimal implementation**

```bash
cat > src/syncer.js << 'EOF'
import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import matter from 'gray-matter';

export async function refactorSkill(sourcePath) {
  const content = await fs.readFile(sourcePath, 'utf8');
  const parsed = matter(content);

  // Skip if already has @ reference
  if (parsed.content.trim().startsWith('@')) {
    return;
  }

  // Extract skill name from path
  const skillName = basename(dirname(sourcePath));
  const commonPath = join('.agents-common/skills', skillName, 'SKILL.md');

  // Ensure .agents-common directory exists
  await fs.mkdir(dirname(commonPath), { recursive: true });

  // Write body to .agents-common
  await fs.writeFile(commonPath, parsed.content);

  // Add metadata to frontmatter
  parsed.data.sync = {
    'managed-by': 'sync-skills',
    'refactored': new Date().toISOString()
  };

  // Replace body with @ reference
  const newContent = matter.stringify(`@${commonPath}\n`, parsed.data);
  await fs.writeFile(sourcePath, newContent);
}

export async function copySkill(sourcePath, targetPath) {
  await fs.mkdir(dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/syncer.js test/syncer.test.js
git commit -m "feat: add syncer module for refactor and copy"
```

---

## Task 7: Main Index Module

**Files:**
- Create: `src/index.js`
- Create: `test/index.test.js`

**Step 1: Write the failing test**

```bash
cat > test/index.test.js << 'EOF'
import { expect } from 'chai';
import { run } from '../src/index.js';
import { promises as fs } from 'fs';

describe('run', () => {
  const testDir = './test/fixtures/integration';

  beforeEach(async () => {
    await fs.mkdir(`${testDir}/.claude/skills/test-skill`, { recursive: true });
    await fs.mkdir(`${testDir}/.codex/skills/test-skill`, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should refactor skills without @ references', async () => {
    const claudePath = `${testDir}/.claude/skills/test-skill/SKILL.md`;
    await fs.writeFile(claudePath, `---
name: test-skill
---

# Test

Content`);

    await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

    const content = await fs.readFile(claudePath, 'utf8');
    expect(content).to.include('@.agents-common/skills/test-skill/SKILL.md');
  });
});
EOF
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find import '../src/index.js'"

**Step 3: Write minimal implementation**

```bash
cat > src/index.js << 'EOF'
import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts } from './detector.js';
import { resolveConflict } from './resolver.js';
import { refactorSkill, copySkill } from './syncer.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function run(options = {}) {
  const {
    baseDir = process.cwd(),
    failOnConflict = false,
    dryRun = false,
    targets = ['claude', 'codex']
  } = options;

  // Scan for skills
  const { claude, codex, common } = await scanSkills(baseDir);

  // Refactor skills that don't have @ references
  for (const skill of claude) {
    const content = await fs.readFile(skill.path, 'utf8');
    const parsed = parseSkillFile(content);
    if (parsed && !parsed.hasAtReference) {
      if (!dryRun) {
        await refactorSkill(skill.path);
      }
    }
  }

  for (const skill of codex) {
    const content = await fs.readFile(skill.path, 'utf8');
    const parsed = parseSkillFile(content);
    if (parsed && !parsed.hasAtReference) {
      if (!dryRun) {
        await refactorSkill(skill.path);
      }
    }
  }

  // Detect conflicts
  const conflicts = await detectConflicts(claude, codex);

  if (conflicts.length > 0) {
    if (failOnConflict) {
      console.error(`Conflict detected in: ${conflicts.map(c => c.skillName).join(', ')}`);
      process.exit(1);
    }

    // Interactive resolution
    for (const conflict of conflicts) {
      const resolution = await resolveConflict(conflict);

      if (resolution.action === 'abort') {
        console.log('Aborted');
        process.exit(0);
      }

      if (resolution.action === 'use-claude' && !dryRun) {
        await copySkill(conflict.claudePath, conflict.codexPath);
      } else if (resolution.action === 'use-codex' && !dryRun) {
        await copySkill(conflict.codexPath, conflict.claudePath);
      }
    }
  }

  console.log('Sync complete');
}
EOF
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/index.js test/index.test.js
git commit -m "feat: add main run function"
```

---

## Task 8: CLI Entry Point with Argument Parsing

**Files:**
- Modify: `bin/sync-skills.js`

**Step 1: Update bin/sync-skills.js to parse arguments**

```bash
cat > bin/sync-skills.js << 'EOF'
#!/usr/bin/env node

import minimist from 'minimist';
import { run } from '../src/index.js';

const argv = minimist(process.argv.slice(2), {
  boolean: ['fail-on-conflict', 'dry-run', 'verbose', 'watch', 'help'],
  alias: {
    'fail-on-conflict': 'f',
    'dry-run': 'd',
    'verbose': 'v',
    'watch': 'w',
    'help': 'h'
  }
});

if (argv.help) {
  console.log(`
sync-skills - Synchronize agent skills

Usage:
  sync-skills [options]

Options:
  --fail-on-conflict, -f    Fail on conflicts instead of interactive mode
  --dry-run, -d             Show changes without applying
  --verbose, -v             Verbose output
  --watch, -w               Watch mode
  --targets <list>          Comma-separated list of targets (claude,codex)
  --help, -h                Show this help

Examples:
  sync-skills                              # Interactive sync
  sync-skills --fail-on-conflict           # Fail on conflicts
  sync-skills --dry-run                    # Preview changes
  `);
  process.exit(0);
}

await run({
  failOnConflict: argv['fail-on-conflict'],
  dryRun: argv['dry-run'],
  verbose: argv.verbose,
  watch: argv.watch,
  targets: argv.targets ? argv.targets.split(',') : ['claude', 'codex']
});
EOF
```

**Step 2: Test help flag**

```bash
node bin/sync-skills.js --help
```

Expected: Help message displayed

**Step 3: Commit**

```bash
git add bin/sync-skills.js
git commit -m "feat: add CLI argument parsing"
```

---

## Task 9: Integration Test with Fake Skills

**Files:**
- Create: `test/integration.test.js`
- Create: `test/fixtures/fake-skills/.claude/skills/pr-review/SKILL.md`
- Create: `test/fixtures/fake-skills/.codex/skills/pr-review/SKILL.md`
- Create: `test/fixtures/fake-skills/.claude/skills/commit-message/SKILL.md`
- Create: `test/fixtures/fake-skills/.codex/skills/commit-message/SKILL.md`

**Step 1: Create fake skill fixtures**

```bash
mkdir -p test/fixtures/fake-skills/.claude/skills/pr-review
mkdir -p test/fixtures/fake-skills/.codex/skills/pr-review
mkdir -p test/fixtures/fake-skills/.claude/skills/commit-message
mkdir -p test/fixtures/fake-skills/.codex/skills/commit-message
```

Create Claude pr-review skill:

```bash
cat > test/fixtures/fake-skills/.claude/skills/pr-review/SKILL.md << 'EOF'
---
name: pr-review
description: Review pull requests using team standards
allowed-tools: Read, Grep
---

# PR Review

## Instructions

Review pull requests by checking:
- Code quality
- Test coverage
- Documentation

Always provide constructive feedback.
EOF
```

Create Codex pr-review skill (different content for conflict):

```bash
cat > test/fixtures/fake-skills/.codex/skills/pr-review/SKILL.md << 'EOF'
---
name: pr-review
description: Review pull requests
tools: read, search
---

# PR Review for Codex

Different instructions here.
EOF
```

Create Claude commit-message skill:

```bash
cat > test/fixtures/fake-skills/.claude/skills/commit-message/SKILL.md << 'EOF'
---
name: commit-message
description: Generate commit messages
---

# Commit Message Generator

Create clear commit messages.
EOF
```

Create Codex commit-message skill (same content):

```bash
cat > test/fixtures/fake-skills/.codex/skills/commit-message/SKILL.md << 'EOF'
---
name: commit-message
description: Generate commit messages
---

# Commit Message Generator

Create clear commit messages.
EOF
```

**Step 2: Write integration test**

```bash
cat > test/integration.test.js << 'EOF'
import { expect } from 'chai';
import { promises as fs } from 'fs';
import { run } from '../src/index.js';

describe('Integration: Full Sync Workflow', () => {
  const testDir = './test/fixtures/fake-skills';
  const backupDir = './test/fixtures/fake-skills-backup';

  beforeEach(async () => {
    // Backup original files
    await fs.cp(testDir, backupDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore original files
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.cp(backupDir, testDir, { recursive: true });
    await fs.rm(backupDir, { recursive: true, force: true });
    await fs.rm('.agents-common', { recursive: true, force: true });
  });

  it('should refactor skills and detect conflicts', async () => {
    const claudePrPath = `${testDir}/.claude/skills/pr-review/SKILL.md`;
    const codexPrPath = `${testDir}/.codex/skills/pr-review/SKILL.md`;
    const claudeCommitPath = `${testDir}/.claude/skills/commit-message/SKILL.md`;

    await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

    // Check that claude pr-review was refactored
    const claudePrContent = await fs.readFile(claudePrPath, 'utf8');
    expect(claudePrContent).to.include('@.agents-common/skills/pr-review/SKILL.md');
    expect(claudePrContent).to.include('managed-by: sync-skills');

    // Check that .agents-common file was created
    const commonPrPath = `${testDir}/.agents-common/skills/pr-review/SKILL.md`;
    const commonPrContent = await fs.readFile(commonPrPath, 'utf8');
    expect(commonPrContent).to.include('Code quality');
    expect(commonPrContent).to.not.include('---');

    // Check that codex pr-review was also refactored
    const codexPrContent = await fs.readFile(codexPrPath, 'utf8');
    expect(codexPrContent).to.include('@.agents-common/skills/pr-review/SKILL.md');

    // Check that commit-message was refactored
    const claudeCommitContent = await fs.readFile(claudeCommitPath, 'utf8');
    expect(claudeCommitContent).to.include('@.agents-common/skills/commit-message/SKILL.md');
  });
});
EOF
```

**Step 3: Run integration test**

```bash
npm test
```

Expected: PASS (all tests including integration)

**Step 4: Commit**

```bash
git add test/integration.test.js test/fixtures/fake-skills/
git commit -m "test: add integration test with fake skills"
```

---

## Task 10: Update package.json Test Script

**Files:**
- Modify: `package.json`

**Step 1: Update test script to include fixtures cleanup**

```bash
cat > package.json << 'EOF'
{
  "name": "sync-skills",
  "version": "0.1.0",
  "description": "Synchronize agent skills between .claude and .codex directories",
  "main": "src/index.js",
  "bin": {
    "sync-skills": "./bin/sync-skills.js"
  },
  "scripts": {
    "test": "mocha test/**/*.test.js",
    "test:clean": "rm -rf test/fixtures/*/ .agents-common"
  },
  "dependencies": {
    "chalk": "^5.3",
    "gray-matter": "^4.0",
    "inquirer": "^9.2",
    "minimist": "^1.2",
    "ora": "^7.0"
  },
  "devDependencies": {
    "chai": "^5.0",
    "mocha": "^10.0",
    "sinon": "^17.0"
  },
  "type": "module"
}
EOF
```

**Step 2: Run all tests to verify**

```bash
npm test
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update test scripts"
```

---

## Summary

This plan builds the complete `sync-skills` package step by step:

1. Project setup with package.json and bin entry
2. Parser module for frontmatter splitting
3. Scanner module for file discovery
4. Detector module for conflict detection via hash
5. Resolver module for interactive prompts
6. Syncer module for refactoring (extract to .agents-common, add @ reference)
7. Main index orchestration
8. CLI argument parsing
9. Integration tests with fake skills

**Total tasks: 10**
**Total estimated steps: 50**
**Final commit count: ~10**
