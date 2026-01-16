import { getAssistantConfigs } from './types.js';
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
export declare const CONFIG_PATH = ".agents-common/config.json";
/**
 * Read configuration file
 * @param baseDir - Base directory to read from
 * @returns Config object or null if file doesn't exist
 */
export declare function readConfig(baseDir: string): Promise<Config | null>;
/**
 * Write configuration file
 * @param baseDir - Base directory to write to
 * @param config - Config object to write
 * @throws Error if validation fails
 */
export declare function writeConfig(baseDir: string, config: Config): Promise<void>;
/**
 * Detect which assistant folders exist in the directory
 * @param baseDir - Base directory to scan
 * @returns Array of assistant names that have folders present
 */
export declare function detectAvailableAssistants(baseDir: string): Promise<string[]>;
/**
 * Interactive reconfiguration flow
 * @param baseDir - Base directory for config
 */
export declare function reconfigure(baseDir: string): Promise<void>;
/**
 * Ensure config exists, create if needed
 * @param baseDir - Base directory for config
 * @returns Config object
 */
export declare function ensureConfig(baseDir: string): Promise<Config>;
/**
 * Get AssistantConfig[] from Config
 * @param config - Config object
 * @param homeMode - If true, use home paths; if false, use project paths (default: false)
 * @returns Array of AssistantConfig for enabled assistants
 */
export declare function getEnabledAssistants(config: Config, homeMode?: boolean): ReturnType<typeof getAssistantConfigs>;
//# sourceMappingURL=config.d.ts.map