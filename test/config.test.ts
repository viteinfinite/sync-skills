import { test, describe, it } from 'node:test';
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import sinon from 'sinon';
import { readConfig, writeConfig, detectAvailableAssistants, ensureConfig, reconfigure, CONFIG_PATH } from '../src/config.js';
import { getAssistantConfigs, ASSISTANT_MAP } from '../src/types.js';
import { createTestFixture, cleanupTestFixture } from './helpers/test-setup.js';

describe('config', () => {
  let TEST_DIR: string;

  describe('readConfig', () => {
    it('should read existing config file', async () => {
      TEST_DIR = await createTestFixture('read-config');
      const testConfig = { version: 1, assistants: ['claude', 'codex'] };
      await fs.mkdir(join(TEST_DIR, '.sync-skills'), { recursive: true });
      await fs.writeFile(join(TEST_DIR, CONFIG_PATH), JSON.stringify(testConfig));

      const result = await readConfig(TEST_DIR);

      assert.deepEqual(result, testConfig);
      await cleanupTestFixture(TEST_DIR);
    });

    it('should return null when config does not exist', async () => {
      TEST_DIR = await createTestFixture('read-config-null');
      const result = await readConfig(TEST_DIR);
      assert.strictEqual(result, null);
      await cleanupTestFixture(TEST_DIR);
    });
  });

  describe('writeConfig', () => {
    it('should write config file and create directory', async () => {
      TEST_DIR = await createTestFixture('write-config');
      const testConfig = { version: 1, assistants: ['claude'] };

      await writeConfig(TEST_DIR, testConfig);

      const configPath = join(TEST_DIR, CONFIG_PATH);
      const content = await fs.readFile(configPath, 'utf-8');
      const result = JSON.parse(content);

      assert.deepEqual(result, testConfig);
      await cleanupTestFixture(TEST_DIR);
    });
  });

  describe('detectAvailableAssistants', () => {
    it('should detect existing assistant folders', async () => {
      TEST_DIR = await createTestFixture('detect-assistants');
      await fs.mkdir(join(TEST_DIR, '.claude'), { recursive: true });

      const result = await detectAvailableAssistants(TEST_DIR);

      assert.deepEqual(result, ['claude']);
      await cleanupTestFixture(TEST_DIR);
    });

    it('should return empty array when no folders exist', async () => {
      TEST_DIR = await createTestFixture('detect-none');
      const result = await detectAvailableAssistants(TEST_DIR);

      assert.deepEqual(result, []);
      await cleanupTestFixture(TEST_DIR);
    });
  });

  describe('ensureConfig', () => {
    it('should prompt with detected assistants preselected', async () => {
      TEST_DIR = await createTestFixture('ensure-config');
      await fs.mkdir(join(TEST_DIR, '.claude'), { recursive: true });

      const promptStub = sinon.stub(inquirer, 'prompt').callsFake(async (questions: unknown) => {
        const q = (questions as Array<{ choices: Array<{ name: string; checked?: boolean }> }>)[0];
        const claudeChoice = q.choices.find(choice => choice.name === 'claude');
        const codexChoice = q.choices.find(choice => choice.name === 'codex');

        assert.ok(claudeChoice?.checked, 'claude should be preselected');
        assert.ok(!codexChoice?.checked, 'codex should not be preselected');

        return { assistants: ['claude'] };
      });

      try {
        const config = await ensureConfig(TEST_DIR);
        assert.deepEqual(config.assistants, ['claude']);
      } finally {
        promptStub.restore();
        await cleanupTestFixture(TEST_DIR);
      }
    });
  });

  describe('reconfigure', () => {
    it('should preselect detected assistants when reconfiguring', async () => {
      TEST_DIR = await createTestFixture('reconfigure-test');
      await fs.mkdir(join(TEST_DIR, '.codex'), { recursive: true });

      const promptStub = sinon.stub(inquirer, 'prompt').callsFake(async (questions: unknown) => {
        const q = (questions as Array<{ choices: Array<{ name: string; checked?: boolean }> }>)[0];
        const codexChoice = q.choices.find(choice => choice.name === 'codex');
        const claudeChoice = q.choices.find(choice => choice.name === 'claude');

        assert.ok(codexChoice?.checked, 'codex should be preselected');
        assert.ok(!claudeChoice?.checked, 'claude should not be preselected');

        return { assistants: ['codex'] };
      });

      try {
        await reconfigure(TEST_DIR);
      } finally {
        promptStub.restore();
      }

      const config = await readConfig(TEST_DIR);
      assert.deepEqual(config?.assistants, ['codex']);
      await cleanupTestFixture(TEST_DIR);
    });
  });
});

test('getAssistantConfigs - parses full skills path correctly', () => {
  const configs = getAssistantConfigs(['claude']);

  assert.strictEqual(configs.length, 1);
  assert.strictEqual(configs[0].name, 'claude');
  assert.strictEqual(configs[0].dir, '.claude');  // folder before /skills
  assert.strictEqual(configs[0].skillsDir, '.claude/skills');  // full path
});

test('getAssistantConfigs - includes kilo in ASSISTANT_MAP', () => {
  // Verify kilo is available in the assistant map
  assert.ok('kilo' in ASSISTANT_MAP);
  assert.strictEqual(ASSISTANT_MAP['kilo'], '.kilocode/skills');

  const configs = getAssistantConfigs(['kilo']);

  assert.strictEqual(configs.length, 1);
  assert.strictEqual(configs[0].name, 'kilo');
  assert.strictEqual(configs[0].dir, '.kilocode');
  assert.strictEqual(configs[0].skillsDir, '.kilocode/skills');
});

test('getAssistantConfigs - includes .agents, pi, openclaw, and hermes', () => {
  assert.strictEqual(ASSISTANT_MAP['agents'], '.agents/skills');
  assert.deepEqual(ASSISTANT_MAP['pi'], {
    project: '.pi/skills',
    home: '.pi/agent/skills'
  });
  assert.deepEqual(ASSISTANT_MAP['openclaw'], {
    home: '.openclaw/skills'
  });
  assert.deepEqual(ASSISTANT_MAP['hermes'], {
    home: '.hermes/skills'
  });
});

test('getAssistantConfigs - omits home-only assistants outside home mode', () => {
  const projectConfigs = getAssistantConfigs(['agents', 'openclaw', 'hermes', 'pi']);

  assert.deepEqual(
    projectConfigs.map(config => config.name),
    ['agents', 'pi']
  );
});

test('getAssistantConfigs - includes home-only assistants in home mode', () => {
  const homeConfigs = getAssistantConfigs(['agents', 'openclaw', 'hermes', 'pi'], true);

  assert.deepEqual(
    homeConfigs.map(config => ({
      name: config.name,
      dir: config.dir,
      skillsDir: config.skillsDir
    })),
    [
      { name: 'agents', dir: '.agents', skillsDir: '.agents/skills' },
      { name: 'openclaw', dir: '.openclaw', skillsDir: '.openclaw/skills' },
      { name: 'hermes', dir: '.hermes', skillsDir: '.hermes/skills' },
      { name: 'pi', dir: '.pi', skillsDir: '.pi/agent/skills' }
    ]
  );
});

test('getAssistantConfigs - supports non-standard skill folder names', () => {
  // Add a custom assistant for testing
  const originalMap = { ...ASSISTANT_MAP };
  (ASSISTANT_MAP as Record<string, string>)['custom'] = '.custom-agent/prompts';

  const configs = getAssistantConfigs(['custom']);

  assert.strictEqual(configs[0].name, 'custom');
  assert.strictEqual(configs[0].dir, '.custom-agent');
  assert.strictEqual(configs[0].skillsDir, '.custom-agent/prompts');

  // Restore
  Object.assign(ASSISTANT_MAP, originalMap);
});

test('detectAvailableAssistants - detects by folder name not skills path', async () => {
  const testDir = await createTestFixture('detect-test');

  // Create .claude folder (no skills subfolder needed for detection)
  await fs.mkdir(join(testDir, '.claude'), { recursive: true });

  const detected = await detectAvailableAssistants(testDir);

  assert.ok(detected.includes('claude'));
  assert.ok(!detected.includes('codex'));

  // Cleanup
  await cleanupTestFixture(testDir);
});

test('detectAvailableAssistants - detects home-only assistants in home mode', async () => {
  const testDir = await createTestFixture('detect-home-only');

  await fs.mkdir(join(testDir, '.hermes'), { recursive: true });
  await fs.mkdir(join(testDir, '.openclaw'), { recursive: true });

  const detected = await detectAvailableAssistants(testDir, true);

  assert.ok(detected.includes('hermes'));
  assert.ok(detected.includes('openclaw'));

  await cleanupTestFixture(testDir);
});
