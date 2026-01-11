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
