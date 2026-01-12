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

    // Check that .agents-common file was created with frontmatter
    const commonPrPath = join(testDir, '.agents-common/skills/pr-review/SKILL.md');
    const commonPrContent = await fs.readFile(commonPrPath, 'utf8');
    expect(commonPrContent).to.include('Different instructions');
    expect(commonPrContent).to.include('---');
    expect(commonPrContent).to.include('name: pr-review');

    // Check that codex pr-review was also refactored
    const codexPrContent = await fs.readFile(codexPrPath, 'utf8');
    expect(codexPrContent).to.include('@.agents-common/skills/pr-review/SKILL.md');

    // Check that commit-message was refactored
    const claudeCommitContent = await fs.readFile(claudeCommitPath, 'utf8');
    expect(claudeCommitContent).to.include('@.agents-common/skills/commit-message/SKILL.md');
  });
});

describe('Integration: Test Scenario 1', () => {
  const testDir = resolve('./test/fixtures/scenario1');
  let promptStub;

  beforeEach(async () => {
    // Create scenario 1 setup: .claude/skills/my-skill exists, no .codex folder
    await fs.mkdir(join(testDir, '.claude/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(testDir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);

    // Stub inquirer.prompt to return yes (user wants to create .codex/skills)
    promptStub = sinon.stub(inquirer, 'prompt').resolves({ createCodex: true });
  });

  afterEach(async () => {
    promptStub.restore();
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm(resolve('.agents-common'), { recursive: true, force: true });
  });

  it('should ask user and create .codex/skills when .codex folder does not exist', async () => {
    // Dynamic import with cache busting
    const { run } = await import(`../src/index.js?t=${Date.now()}`);

    await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

    // Verify inquirer.prompt was called with the right message
    expect(promptStub.called).to.be.true;
    const promptCall = promptStub.getCalls().find(call =>
      call.args[0] && call.args[0][0] && call.args[0][0].message && call.args[0][0].message.includes('.codex folder does not exist')
    );
    expect(promptCall).to.not.be.undefined;

    // Verify .codex/skills was created
    const codexSkillPath = join(testDir, '.codex/skills/my-skill/SKILL.md');
    const codexExists = await fs.access(codexSkillPath).then(() => true).catch(() => false);
    expect(codexExists).to.be.true;

    // Verify .codex/skills has @ reference to common skills
    const codexContent = await fs.readFile(codexSkillPath, 'utf8');
    expect(codexContent).to.include('@.agents-common/skills/my-skill/SKILL.md');

    // Verify .claude skill was also refactored to use @ reference
    const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
    const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
    expect(claudeContent).to.include('@.agents-common/skills/my-skill/SKILL.md');
  });
});

describe('Integration: Test Scenario 2', () => {
  const testDir = resolve('./test/fixtures/scenario2');
  let promptStub;

  beforeEach(async () => {
    // Create scenario 2 setup: .claude/skills/my-skill exists, .codex folder exists
    await fs.mkdir(join(testDir, '.claude/skills/my-skill'), { recursive: true });
    await fs.mkdir(join(testDir, '.codex'), { recursive: true });
    await fs.writeFile(join(testDir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);

    // Stub all prompts (including conflict resolution prompts)
    promptStub = sinon.stub(inquirer, 'prompt');
  });

  afterEach(async () => {
    promptStub.restore();
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.rm(resolve('.agents-common'), { recursive: true, force: true });
  });

  it('should automatically create .codex/skills when .codex folder already exists', async () => {
    // Set up the stub to not call the createCodex prompt, but handle other prompts
    promptStub.callsFake(async (questions) => {
      const question = questions[0];
      if (question.name === 'createCodex') {
        // This should NOT be called in scenario 2
        return { createCodex: false };
      }
      // Handle conflict resolution prompts
      if (question.name === 'action') {
        return { action: 'keep-both' };
      }
      return {};
    });

    // Dynamic import with cache busting
    const { run } = await import(`../src/index.js?t=${Date.now()}`);

    await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

    // Verify the createCodex prompt was NOT called
    const createCodexCalls = promptStub.getCalls().filter(call =>
      call.args[0] && call.args[0][0] && call.args[0][0].name === 'createCodex'
    );
    expect(createCodexCalls.length).to.equal(0);

    // Verify .codex/skills was created automatically
    const codexSkillPath = join(testDir, '.codex/skills/my-skill/SKILL.md');
    const codexExists = await fs.access(codexSkillPath).then(() => true).catch(() => false);
    expect(codexExists).to.be.true;

    // Verify .codex/skills has @ reference to common skills
    const codexContent = await fs.readFile(codexSkillPath, 'utf8');
    expect(codexContent).to.include('@.agents-common/skills/my-skill/SKILL.md');

    // Verify .claude skill was also refactored to use @ reference
    const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
    const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
    expect(claudeContent).to.include('@.agents-common/skills/my-skill/SKILL.md');
  });
});
