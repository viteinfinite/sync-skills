import { promises as fs } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
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
    if (!Array.isArray(config.assistants)) {
      throw new Error('Invalid config: assistants must be an array');
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist
      return null;
    }
    // JSON parse error or other - return null to trigger recreation
    console.warn('Config file is corrupted, will recreate');
    return null;
  }
}
