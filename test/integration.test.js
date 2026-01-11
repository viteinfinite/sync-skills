import { expect } from 'chai';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import sinon from 'sinon';
import inquirer from 'inquirer';

describe('Integration: Full Sync Workflow', () => {
  const testDir = resolve('./test/fixtures/fake-skills');
  const backupDir = resolve('./test/fixtures/fake-skills-backup');
  let promptStub;

  beforeEach(async () => {
    // Backup original files
    await fs.cp(testDir, backupDir, { recursive: true });

    // Stub inquirer.prompt to avoid interactive prompts
    promptStub = sinon.stub(inquirer, 'prompt').resolves({ action: 'keep-both' });
  });

  afterEach(async () => {
    // Restore stub
    promptStub.restore();

    // Restore original files
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.cp(backupDir, testDir, { recursive: true });
    await fs.rm(backupDir, { recursive: true, force: true });
    await fs.rm(resolve('.agents-common'), { recursive: true, force: true });
  });

  it('should refactor skills and detect conflicts', async () => {
    const claudePrPath = join(testDir, '.claude/skills/pr-review/SKILL.md');
    const codexPrPath = join(testDir, '.codex/skills/pr-review/SKILL.md');
    const claudeCommitPath = join(testDir, '.claude/skills/commit-message/SKILL.md');

    // Import after stubbing to ensure stub is used
    const { run } = await import('../src/index.js');
    await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

    // Check that claude pr-review was refactored
    const claudePrContent = await fs.readFile(claudePrPath, 'utf8');
    expect(claudePrContent).to.include('@.agents-common/skills/pr-review/SKILL.md');
    expect(claudePrContent).to.include('managed-by: sync-skills');

    // Check that .agents-common file was created
    const commonPrPath = join(testDir, '.agents-common/skills/pr-review/SKILL.md');
    const commonPrContent = await fs.readFile(commonPrPath, 'utf8');
    expect(commonPrContent).to.include('Different instructions');
    expect(commonPrContent).to.not.include('---');

    // Check that codex pr-review was also refactored
    const codexPrContent = await fs.readFile(codexPrPath, 'utf8');
    expect(codexPrContent).to.include('@.agents-common/skills/pr-review/SKILL.md');

    // Check that commit-message was refactored
    const claudeCommitContent = await fs.readFile(claudeCommitPath, 'utf8');
    expect(claudeCommitContent).to.include('@.agents-common/skills/commit-message/SKILL.md');
  });
});
