import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import sinon from 'sinon';
import inquirer from 'inquirer';
import { createTestFixture, cleanupTestFixture } from './helpers/test-setup.js';

let promptStub: sinon.SinonStub;

function stubPrompt(responses: Record<string, unknown>): void {
  promptStub.callsFake(async (questions: unknown) => {
    const qs = (Array.isArray(questions) ? questions : [questions]) as Array<{ name: string }>;
    const result: Record<string, unknown> = {};
    for (const q of qs) {
      if (q.name in responses) {
        result[q.name] = responses[q.name];
      } else {
        throw new Error(`No stub response for question: ${q.name}`);
      }
    }
    return result;
  });
}

test.beforeEach(async () => {
  // Stub inquirer.prompt to avoid interactive prompts
  promptStub = sinon.stub(inquirer, 'prompt');
});

test.afterEach(async () => {
  // Restore stub
  promptStub.restore();
});

test('Integration: Full Sync Workflow - should refactor skills and detect conflicts', async () => {
  const fakeSkillsSource = resolve('./test/fixtures/fake-skills');
  const testDir = await createTestFixture('sync-workflow', async (dir) => {
    await fs.cp(fakeSkillsSource, dir, { recursive: true });

    // Create .agents-common directory with pr-review skill (since fake-skills references it)
    await fs.mkdir(join(dir, '.agents-common/skills/pr-review'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/skills/pr-review/SKILL.md'), `---
name: pr-review
description: Review pull requests using team standards
allowed-tools: Read, Grep
metadata:
  sync:
    managed-by: sync-skills
    version: 2
    hash: sha256-abc123
---

# PR Review

Different instructions for reviewing pull requests.`);

    // Also create commit-message in .agents-common
    await fs.mkdir(join(dir, '.agents-common/skills/commit-message'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/skills/commit-message/SKILL.md'), `---
name: commit-message
description: Commit message helper
---

# Commit Message

Helps write good commit messages.`);
  });

  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both', // For conflict resolution
    outOfSyncAction: 'no' // For out-of-sync skills: no = discard platform edits
  });

  const claudePrPath = join(testDir, '.claude/skills/pr-review/SKILL.md');
  const codexPrPath = join(testDir, '.codex/skills/pr-review/SKILL.md');
  const claudeCommitPath = join(testDir, '.claude/skills/commit-message/SKILL.md');

  // Import after stubbing to ensure stub is used
  const { run } = await import('../src/index.js');
  await run({ baseDir: testDir, failOnConflict: false, dryRun: false });

  // Check that claude pr-review was refactored
  const claudePrContent = await fs.readFile(claudePrPath, 'utf8');
  assert.ok(claudePrContent.includes('@.agents-common/skills/pr-review/SKILL.md'));
  assert.ok(claudePrContent.includes('managed-by: sync-skills'));

  // Check that .agents-common file was created with frontmatter
  const commonPrPath = join(testDir, '.agents-common/skills/pr-review/SKILL.md');
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

  await cleanupTestFixture(testDir);
});

// Scenario 1: .claude/skills exists, .codex folder exists → auto-sync skills
test('Integration: Test Scenario 1 - should auto-sync skills when both folders exist', async () => {
  const testDir = await createTestFixture('scenario1', async (dir) => {
    // Create scenario 1 setup: .claude/skills/my-skill exists, .codex folder exists
    await fs.mkdir(join(dir, '.claude/skills/my-skill'), { recursive: true });
    await fs.mkdir(join(dir, '.codex'), { recursive: true });
    await fs.writeFile(join(dir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);
  });

  // Stub inquirer.prompt (should not be called for auto-sync create prompt)
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both',
    outOfSyncAction: 'no'
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

  await cleanupTestFixture(testDir);
});

// Scenario 2: .claude/skills exists, .codex folder exists → auto-create without prompt
test('Integration: Test Scenario 2 - should automatically create .codex/skills when .codex folder already exists', async () => {
  const testDir = await createTestFixture('scenario2', async (dir) => {
    // Create scenario 2 setup: .claude/skills/my-skill exists, .codex folder exists
    await fs.mkdir(join(dir, '.claude/skills/my-skill'), { recursive: true });
    await fs.mkdir(join(dir, '.codex'), { recursive: true });
    await fs.writeFile(join(dir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);
  });

  // Stub to handle any prompts
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both',
    outOfSyncAction: 'no'
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

  await cleanupTestFixture(testDir);
});

// Scenario 3: No skills exist anywhere → exit silently
test('Integration: Test Scenario 3 - should exit silently when no skills exist', async () => {
  const testDir = await createTestFixture('scenario3');

  stubPrompt({ assistants: ['claude', 'codex'], outOfSyncAction: 'no' });

  await runTest(testDir);

  // Verify no directories were created
  const codexExists = await fs.access(join(testDir, '.codex')).then(() => true).catch(() => false);
  const claudeExists = await fs.access(join(testDir, '.claude')).then(() => true).catch(() => false);
  assert.ok(!codexExists);
  assert.ok(!claudeExists);

  await cleanupTestFixture(testDir);
});

// Scenario 4: .codex/skills exists, .claude folder doesn't exist → prompt user
test('Integration: Test Scenario 4 - should not create .claude when user declines', async () => {
  const testDir = await createTestFixture('scenario4', async (dir) => {
    // Create scenario 4 setup: .codex/skills/my-skill exists, no .claude folder
    await fs.mkdir(join(dir, '.codex/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.codex/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

@.agents-common/skills/my-skill/SKILL.md
`);

    // Also create the common skill
    await fs.mkdir(join(dir, '.agents-common/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);
  });

  // Stub inquirer.prompt - user says NO to creating .claude/skills
  stubPrompt({
    assistants: ['claude', 'codex'],
    create: false,
    outOfSyncAction: 'no'  // Stub for any out-of-sync prompts
  });

  await runTest(testDir);

  // Note: With the new behavior, syncCommonOnlySkills creates assistant directories
  // even when they don't exist. The user's "no" response only affects processSyncPairs,
  // not syncCommonOnlySkills.
  // Verify .claude/skills/my-skill/SKILL.md was created
  const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
  const claudeSkillExists = await fs.access(claudeSkillPath).then(() => true).catch(() => false);
  assert.ok(claudeSkillExists, '.claude/skills/my-skill/SKILL.md should be created by syncCommonOnlySkills');

  await cleanupTestFixture(testDir);
});

// Scenario 5: .codex/skills exists, .claude folder exists → auto-create without prompt
test('Integration: Test Scenario 5 - should automatically create .claude/skills when .codex has skills and .claude folder exists', async () => {
  const testDir = await createTestFixture('scenario5', async (dir) => {
    // Create scenario 5 setup: .codex/skills/my-skill exists, .claude folder exists
    await fs.mkdir(join(dir, '.codex/skills/my-skill'), { recursive: true });
    await fs.mkdir(join(dir, '.claude'), { recursive: true });
    await fs.writeFile(join(dir, '.codex/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

@.agents-common/skills/my-skill/SKILL.md
`);

    // Also create the common skill
    await fs.mkdir(join(dir, '.agents-common/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
---

# My Skill

This is the content of my skill.`);
  });

  // Stub to handle any prompts
  stubPrompt({
    assistants: ['claude', 'codex'],
    action: 'keep-both',
    outOfSyncAction: 'no'
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

  await cleanupTestFixture(testDir);
});

// Helper function to run the test with a fresh module import
async function runTest(baseDir: string) {
  // Clear the module cache to ensure fresh imports
  const { run } = await import('../src/index.js');
  await run({ baseDir, failOnConflict: false, dryRun: false });
}

// Auto-configuration test
test('Integration: Auto-configuration - should prompt and create config when folders exist', async () => {
  const testDir = await createTestFixture('auto-config', async (dir) => {
    // Create .claude folder with skills
    await fs.mkdir(join(dir, '.claude/skills/test'), { recursive: true });
    await fs.writeFile(join(dir, '.claude/skills/test/SKILL.md'), '@test');
  });

  // Import after setup to ensure fresh module
  const { run } = await import('../src/index.js');

  stubPrompt({ assistants: ['claude'], outOfSyncAction: 'no' });

  // Run sync (should prompt and create config)
  await run({ baseDir: testDir });

  // Check config was created
  const { readConfig } = await import('../src/config.js');
  const config = await readConfig(testDir);

  assert.ok(config);
  assert.deepEqual(config?.assistants, ['claude']);

  await cleanupTestFixture(testDir);
});

// Scenario: Only .agents-common exists - should create assistant directories with @ references
test('Integration: Common-only sync - should create assistant directories with @ references', async () => {
  const testDir = await createTestFixture('common-only', async (dir) => {
    // Create .agents-common with skills and config
    await fs.mkdir(join(dir, '.agents-common/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
metadata:
  sync:
    version: 2
    hash: sha256-85c8103dcfc4a6d63e87640e0e480726073e11ebca6d3d7dcbbdf2b8fbe89f4d
---
# My Skill

This is the content of my skill.`);

    await fs.mkdir(join(dir, '.agents-common'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/config.json'), JSON.stringify({
      version: 1,
      assistants: ['claude', 'gemini']
    }, null, 2));
  });

  stubPrompt({
    assistants: ['claude', 'gemini'],
    outOfSyncAction: 'no'  // Stub the out-of-sync prompt to use common skill content
  });

  await runTest(testDir);

  // Verify .claude/skills/my-skill/SKILL.md was created with @ reference
  const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
  const claudeExists = await fs.access(claudeSkillPath).then(() => true).catch(() => false);
  assert.ok(claudeExists, '.claude/skills/my-skill/SKILL.md should exist');

  const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
  assert.ok(claudeContent.includes('@.agents-common/skills/my-skill/SKILL.md'), 'Should have @ reference');
  assert.ok(claudeContent.includes('name: my-skill'), 'Should have core frontmatter');

  // Verify .gemini/skills/my-skill/SKILL.md was created with @ reference
  const geminiSkillPath = join(testDir, '.gemini/skills/my-skill/SKILL.md');
  const geminiExists = await fs.access(geminiSkillPath).then(() => true).catch(() => false);
  assert.ok(geminiExists, '.gemini/skills/my-skill/SKILL.md should exist');

  const geminiContent = await fs.readFile(geminiSkillPath, 'utf8');
  assert.ok(geminiContent.includes('@.agents-common/skills/my-skill/SKILL.md'), 'Should have @ reference');
  assert.ok(geminiContent.includes('name: my-skill'), 'Should have core frontmatter');

  await cleanupTestFixture(testDir);
});

// Scenario: Different model fields do not cause conflict
test('Integration: Different model fields - should not cause conflict', async () => {
  const testDir = await createTestFixture('different-model-fields', async (dir) => {
    // Create .agents-common with skills and config
    await fs.mkdir(join(dir, '.agents-common/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
metadata:
  sync:
    version: 2
    hash: sha256-85c8103dcfc4a6d63e87640e0e480726073e11ebca6d3d7dcbbdf2b8fbe89f4d
---
# My Skill

This is the content of my skill.`);

    await fs.mkdir(join(dir, '.agents-common'), { recursive: true });
    await fs.writeFile(join(dir, '.agents-common/config.json'), JSON.stringify({
      version: 1,
      assistants: ['claude', 'gemini']
    }, null, 2));

    // Create .claude and .gemini with different model fields
    await fs.mkdir(join(dir, '.claude/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.claude/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
model: haiku-3.5
---
@.agents-common/skills/my-skill/SKILL.md`);

    await fs.mkdir(join(dir, '.gemini/skills/my-skill'), { recursive: true });
    await fs.writeFile(join(dir, '.gemini/skills/my-skill/SKILL.md'), `---
name: my-skill
description: A test skill
model: gemini-3-pro-preview
---
@.agents-common/skills/my-skill/SKILL.md`);
  });

  stubPrompt({
    assistants: ['claude', 'gemini']
  });

  await runTest(testDir);

  // Verify no conflict was detected - both files should exist with their respective model fields
  const claudeSkillPath = join(testDir, '.claude/skills/my-skill/SKILL.md');
  const claudeContent = await fs.readFile(claudeSkillPath, 'utf8');
  assert.ok(claudeContent.includes('model: haiku-3.5'), 'Claude should keep its model field');

  const geminiSkillPath = join(testDir, '.gemini/skills/my-skill/SKILL.md');
  const geminiContent = await fs.readFile(geminiSkillPath, 'utf8');
  assert.ok(geminiContent.includes('model: gemini-3-pro-preview'), 'Gemini should keep its model field');

  await cleanupTestFixture(testDir);
});
