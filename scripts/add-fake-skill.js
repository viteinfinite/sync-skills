#!/usr/bin/env node
/**
 * Add a fake skill for testing purposes
 *
 * Usage: node scripts/add-fake-skill.js <assistant> <skill-name>
 *
 * Examples:
 *   node scripts/add-fake-skill.js claude my-skill
 *   node scripts/add-fake-skill.js codex another-skill
 *   npm run add-skill claude my-skill
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Assistant map - must match src/types.ts
const ASSISTANT_MAP = {
  'claude': '.claude',
  'codex': '.codex'
};

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/add-fake-skill.js <assistant> <skill-name>');
  console.error('   or: npm run add-skill <assistant> <skill-name>');
  console.error('');
  console.error('Assistants: ' + Object.keys(ASSISTANT_MAP).join(', '));
  process.exit(1);
}

const [assistant, skillName] = args;

// Validate assistant
if (!(assistant in ASSISTANT_MAP)) {
  console.error(`Error: Unknown assistant "${assistant}"`);
  console.error(`Valid assistants: ${Object.keys(ASSISTANT_MAP).join(', ')}`);
  process.exit(1);
}

// Create the skill directory and file
const assistantDir = ASSISTANT_MAP[assistant];
const projectRoot = join(__dirname, '..');
const skillDir = join(projectRoot, assistantDir, 'skills', skillName);
const skillFile = join(skillDir, 'SKILL.md');

// Create directory structure
await fs.mkdir(skillDir, { recursive: true });

// Create a fake SKILL.md file
const skillContent = `---
name: ${skillName}
description: A fake skill for testing
---

# ${skillName}

This is a fake skill created for testing purposes.

## Usage

\`\`\`
${skillName} --help
\`\`\`

## Example

\`\`\`
${skillName} do something
\`\`\`
`;

await fs.writeFile(skillFile, skillContent, 'utf-8');

console.log(`✅ Created fake skill: ${skillFile}`);
console.log(`   Assistant: ${assistant}`);
console.log(`   Skill: ${skillName}`);
