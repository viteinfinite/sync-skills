import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { readConfig, writeConfig, detectAvailableAssistants, CONFIG_PATH } from '../src/config.js';

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
