import { test } from 'node:test';
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { readConfig, writeConfig, detectAvailableAssistants, CONFIG_PATH } from '../src/config.js';
import { getAssistantConfigs, ASSISTANT_MAP } from '../src/types.js';

const TEST_DIR = 'test/fixtures/config-test';

describe('config', () => {
  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('readConfig', () => {
    it('should read existing config file', async () => {
      const testConfig = { version: 1, assistants: ['claude', 'codex'] };
      await fs.mkdir(join(TEST_DIR, '.agents-common'), { recursive: true });
      await fs.writeFile(join(TEST_DIR, CONFIG_PATH), JSON.stringify(testConfig));

      const result = await readConfig(TEST_DIR);

      assert.deepEqual(result, testConfig);
    });

    it('should return null when config does not exist', async () => {
      const result = await readConfig(TEST_DIR);
      assert.strictEqual(result, null);
    });
  });

  describe('writeConfig', () => {
    it('should write config file and create directory', async () => {
      const testConfig = { version: 1, assistants: ['claude'] };

      await writeConfig(TEST_DIR, testConfig);

      const configPath = join(TEST_DIR, CONFIG_PATH);
      const content = await fs.readFile(configPath, 'utf-8');
      const result = JSON.parse(content);

      assert.deepEqual(result, testConfig);
    });
  });

  describe('detectAvailableAssistants', () => {
    it('should detect existing assistant folders', async () => {
      await fs.mkdir(join(TEST_DIR, '.claude'), { recursive: true });

      const result = await detectAvailableAssistants(TEST_DIR);

      assert.deepEqual(result, ['claude']);
    });

    it('should return empty array when no folders exist', async () => {
      const result = await detectAvailableAssistants(TEST_DIR);

      assert.deepEqual(result, []);
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
  const testDir = './test/fixtures/detect-test';

  // Create .claude folder (no skills subfolder needed for detection)
  await fs.mkdir(join(testDir, '.claude'), { recursive: true });

  const detected = await detectAvailableAssistants(testDir);

  assert.ok(detected.includes('claude'));
  assert.ok(!detected.includes('codex'));

  // Cleanup
  await fs.rm(testDir, { recursive: true, force: true });
});
