import { promises as fs } from 'fs';
import { join } from 'path';
import { ASSISTANT_MAP, getAssistantConfigs } from './types.js';

/**
 * Configuration file structure
 */
export interface Config {
  /** Schema version for migrations */
  version: number;
  /** Enabled assistant names */
  assistants: string[];
}

/** Path to config file relative to base directory */
export const CONFIG_PATH = '.agents-common/config.json';

/**
 * Read configuration file
 * @param baseDir - Base directory to read from
 * @returns Config object or null if file doesn't exist
 */
export async function readConfig(baseDir: string): Promise<Config | null> {
  const configPath = join(baseDir, CONFIG_PATH);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content) as Config;

    // Validate structure
    if (typeof config.version !== 'number') {
      console.warn('Invalid config: version must be a number');
      return null;
    }

    if (config.version !== 1) {
      console.warn(`Invalid config: unsupported version ${config.version} (expected 1)`);
      return null;
    }

    if (!Array.isArray(config.assistants)) {
      console.warn('Invalid config: assistants must be an array');
      return null;
    }

    if (config.assistants.length === 0) {
      console.warn('Invalid config: assistants array cannot be empty');
      return null;
    }

    for (const assistant of config.assistants) {
      if (typeof assistant !== 'string' || assistant.trim() === '') {
        console.warn(`Invalid config: assistant name must be a non-empty string`);
        return null;
      }
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist
      return null;
    }

    // JSON parse error or other
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Config file is corrupted: ${errorMessage}, will recreate`);
    return null;
  }
}

/**
 * Write configuration file
 * @param baseDir - Base directory to write to
 * @param config - Config object to write
 */
export async function writeConfig(baseDir: string, config: Config): Promise<void> {
  const configPath = join(baseDir, CONFIG_PATH);
  const configDir = join(baseDir, '.agents-common');

  // Ensure .agents-common directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write config with pretty formatting
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
