import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import sinon from 'sinon';
import inquirer from 'inquirer';

const fakeSkillsDir = resolve('./test/fixtures/fake-skills');
const backupDir = resolve('./test/fixtures/fake-skills-backup');
let promptStub: sinon.SinonStub;

function stubPrompt(responses: Record<string, unknown>): void {
  promptStub.callsFake(async (questions: unknown) => {
    const question = questions as Array<{ name: string }>;
    const q = question[0];
    if (q && q.name in responses) {
      return { [q.name]: responses[q.name] };
    }
    throw new Error(`No stub response for question: ${q?.name}`);
  });
}

test.beforeEach(async () => {
  // Backup original files
  await fs.cp(fakeSkillsDir, backupDir, { recursive: true })
    .catch(() => {}); // Ignore if backup source doesn't exist

  // Stub inquirer.prompt to avoid interactive prompts
  promptStub = sinon.stub(inquirer, 'prompt');
});

test.afterEach(async () => {
  // Restore stub
  promptStub.restore();

  // Restore original files
  await fs.rm(fakeSkillsDir, { recursive: true, force: true });
  await fs.cp(backupDir, fakeSkillsDir, { recursive: true })
    .catch(() => {}); // Ignore if restore source doesn't exist
  await fs.rm(backupDir, { recursive: true, force: true });
  await fs.rm(resolve('.agents-common'), { recursive: true, force: true });
});

test('Integration: Full Sync Workflow - should refactor skills and detect conflicts', async () => {
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both'
  });

  const claudePrPath = join(fakeSkillsDir, '.claude/skills/pr-review/SKILL.md');
  const codexPrPath = join(fakeSkillsDir, '.codex/skills/pr-review/SKILL.md');
  const claudeCommitPath = join(fakeSkillsDir, '.claude/skills/commit-message/SKILL.md');

  // Import after stubbing to ensure stub is used
  const { run } = await import('../src/index.js');
  await run({ baseDir: fakeSkillsDir, failOnConflict: false, dryRun: false });

  // Check that claude pr-review was refactored
  const claudePrContent = await fs.readFile(claudePrPath, 'utf8');
  assert.ok(claudePrContent.includes('@.agents-common/skills/pr-review/SKILL.md'));
  assert.ok(claudePrContent.includes('managed-by: sync-skills'));

  // Check that .agents-common file was created with frontmatter
  const commonPrPath = join(fakeSkillsDir, '.agents-common/skills/pr-review/SKILL.md');
  const commonPrContent = await fs.readFile(commonPrPath, 'utf8');
  assert.ok(commonPrContent.includes('Different instructions'));
  assert.ok(commonPrContent.includes('---'));
  assert.ok(commonPrContent.includes('name: pr-review'));

  // Check that codex pr-review was also refactored
  const codexPrContent = await fs.readFile(codexPrPath, 'utf8');
  assert.ok(codexPrContent.includes('@.agents-common/skills/pr-review/SKILL.md'));

  // Check that commit-message was refactored
  const claudeCommitContent = await fs.readFile(claudeCommitPath, 'utf8');
  assert.ok(claudeCommitContent.includes('@.agents-common/skills/commit-message/SKILL.md'));
});

// Scenario 1: .claude/skills exists, .codex folder exists → auto-sync skills
test('Integration: Test Scenario 1 - should auto-sync skills when both folders exist', async () => {
  const testDir = resolve('./test/fixtures/scenario1');

  // Clean up first
  await fs.rm(testDir, { recursive: true, force: true });
  await fs.rm(resolve(testDir, '.agents-common'), { recursive: true, force: true });

  // Create scenario 1 setup: .claude/skills/my-skill exists, .codex folder exists
  await fs.mkdir(join(testDir, '.claude/skills/my-skill'), { recursive: true });
  await fs.mkdir(join(testDir, '.codex'), { recursive: true });
  await fs.writeFile(join(testDir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);

  // Stub inquirer.prompt (should not be called for auto-sync create prompt)
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both'
  });

  await runTest(testDir);

  // Verify the create prompt was NOT called (auto-sync)
  const createCalls = promptStub.getCalls().filter(call =>
    call.args[0] && call.args[0][0] && call.args[0][0].name === 'create'
  );
  assert.strictEqual(createCalls.length, 0);

  // Verify .codex/skills was created automatically
  const codexSkillPath = join(testDir, '.codex/skills/my-skill/SKILL.md');
  const codexExists = await fs.access(codexSkillPath).then(() => true).catch(() => false);
  assert.ok(codexExists);

  // Verify .codex/skills has @ reference to common skills
  const codexContent = await fs.readFile(codexSkillPath, 'utf8');
  assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  // Verify .claude skill was also refactored to use @ reference
  const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
  const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
  assert.ok(claudeContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});

// Scenario 2: .claude/skills exists, .codex folder exists → auto-create without prompt
test('Integration: Test Scenario 2 - should automatically create .codex/skills when .codex folder already exists', async () => {
  const testDir = resolve('./test/fixtures/scenario2');

  // Create scenario 2 setup: .claude/skills/my-skill exists, .codex folder exists
  await fs.mkdir(join(testDir, '.claude/skills/my-skill'), { recursive: true });
  await fs.mkdir(join(testDir, '.codex'), { recursive: true });
  await fs.writeFile(join(testDir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);

  // Stub to handle any prompts
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both'
  });

  await runTest(testDir);

  // Verify the create prompt was NOT called
  const createCalls = promptStub.getCalls().filter(call =>
    call.args[0] && call.args[0][0] && call.args[0][0].name === 'create'
  );
  assert.strictEqual(createCalls.length, 0);

  // Verify .codex/skills was created automatically
  const codexSkillPath = join(testDir, '.codex/skills/my-skill/SKILL.md');
  const codexExists = await fs.access(codexSkillPath).then(() => true).catch(() => false);
  assert.ok(codexExists);

  // Verify .codex/skills has @ reference to common skills
  const codexContent = await fs.readFile(codexSkillPath, 'utf8');
  assert.ok(codexContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});

// Scenario 3: No skills exist anywhere → exit silently
test('Integration: Test Scenario 3 - should exit silently when no skills exist', async () => {
  const testDir = resolve('./test/fixtures/scenario3');

  // Create scenario 3 setup: No skills exist anywhere
  await fs.mkdir(testDir, { recursive: true });

  stubPrompt({ assistants: ['claude', 'codex'] });

  await runTest(testDir);

  // Verify no directories were created
  const codexExists = await fs.access(join(testDir, '.codex')).then(() => true).catch(() => false);
  const claudeExists = await fs.access(join(testDir, '.claude')).then(() => true).catch(() => false);
  assert.ok(!codexExists);
  assert.ok(!claudeExists);

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});

// Scenario 4: .codex/skills exists, .claude folder doesn't exist → prompt user
test('Integration: Test Scenario 4 - should not create .claude when user declines', async () => {
  const testDir = resolve('./test/fixtures/scenario4');

  // Clean up first
  await fs.rm(testDir, { recursive: true, force: true });

  // Create scenario 4 setup: .codex/skills/my-skill exists, no .claude folder
  await fs.mkdir(join(testDir, '.codex/skills/my-skill'), { recursive: true });
  await fs.writeFile(join(testDir, '.codex/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

@.agents-common/skills/my-skill/SKILL.md
`);

  // Also create the common skill
  await fs.mkdir(join(testDir, '.agents-common/skills/my-skill'), { recursive: true });
  await fs.writeFile(join(testDir, '.agents-common/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);

  // Stub inquirer.prompt - user says NO to creating .claude/skills
  stubPrompt({
    assistants: ['claude', 'codex'],
    create: false
  });

  await runTest(testDir);

  // Verify .claude/skills was NOT created (user said no)
  const claudeExists = await fs.access(join(testDir, '.claude')).then(() => true).catch(() => false);
  assert.ok(!claudeExists);

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});

// Scenario 5: .codex/skills exists, .claude folder exists → auto-create without prompt
test('Integration: Test Scenario 5 - should automatically create .claude/skills when .codex has skills and .claude folder exists', async () => {
  const testDir = resolve('./test/fixtures/scenario5');

  // Create scenario 5 setup: .codex/skills/my-skill exists, .claude folder exists
  await fs.mkdir(join(testDir, '.codex/skills/my-skill'), { recursive: true });
  await fs.mkdir(join(testDir, '.claude'), { recursive: true });
  await fs.writeFile(join(testDir, '.codex/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

@.agents-common/skills/my-skill/SKILL.md
`);

  // Also create the common skill
  await fs.mkdir(join(testDir, '.agents-common/skills/my-skill'), { recursive: true });
  await fs.writeFile(join(testDir, '.agents-common/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);

  // Stub to handle any prompts
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both'
  });

  await runTest(testDir);

  // Verify the create prompt was NOT called
  const createCalls = promptStub.getCalls().filter(call =>
    call.args[0] && call.args[0][0] && call.args[0][0].name === 'create'
  );
  assert.strictEqual(createCalls.length, 0);

  // Verify .claude/skills was created automatically
  const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
  const claudeExists = await fs.access(claudeSkillPath).then(() => true).catch(() => false);
  assert.ok(claudeExists);

  // Verify .claude/skills has @ reference to common skills
  const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
  assert.ok(claudeContent.includes('@.agents-common/skills/my-skill/SKILL.md'));

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});

// Helper function to run the test with a fresh module import
async function runTest(baseDir: string) {
  // Clear the module cache to ensure fresh imports
  const { run } = await import('../src/index.js');
  await run({ baseDir, failOnConflict: false, dryRun: false });
}

// Auto-configuration test
test('Integration: Auto-configuration - should prompt and create config when folders exist', async () => {
  const testDir = resolve('./test/fixtures/auto-config');

  // Cleanup first
  await fs.rm(testDir, { recursive: true, force: true });

  // Create .claude folder with skills
  await fs.mkdir(join(testDir, '.claude/skills/test'), { recursive: true });
  await fs.writeFile(join(testDir, '.claude/skills/test/SKILL.md'), '@test');

  // Import after setup to ensure fresh module
  const { run } = await import('../src/index.js');

  stubPrompt({ assistants: ['claude'] });

  // Run sync (should prompt and create config)
  await run({ baseDir: testDir });

  // Check config was created
  const { readConfig } = await import('../src/config.js');
  const config = await readConfig(testDir);

  assert.ok(config);
  assert.deepEqual(config?.assistants, ['claude']);

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});
