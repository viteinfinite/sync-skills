import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import inquirer from 'inquirer';
import { ASSISTANT_MAP, getAssistantConfigs } from './types.js';
/** Path to config file relative to base directory */
export const CONFIG_PATH = '.agents-common/config.json';
/**
 * Read configuration file
 * @param baseDir - Base directory to read from
 * @returns Config object or null if file doesn't exist
 */
export async function readConfig(baseDir) {
    const configPath = join(baseDir, CONFIG_PATH);
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(content);
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
    }
    catch (error) {
        if (error.code === 'ENOENT') {
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
 * @throws Error if validation fails
 */
export async function writeConfig(baseDir, config) {
    // Validate version
    if (config.version !== 1) {
        throw new Error(`Invalid config: unsupported version ${config.version} (expected 1)`);
    }
    // Validate assistants array
    if (!Array.isArray(config.assistants)) {
        throw new Error('Invalid config: assistants must be an array');
    }
    if (config.assistants.length === 0) {
        throw new Error('Invalid config: assistants array cannot be empty');
    }
    // Validate each assistant name exists in ASSISTANT_MAP
    for (const assistant of config.assistants) {
        if (typeof assistant !== 'string' || assistant.trim() === '') {
            throw new Error('Invalid config: assistant name must be a non-empty string');
        }
        if (!(assistant in ASSISTANT_MAP)) {
            throw new Error(`Invalid config: unknown assistant "${assistant}"`);
        }
    }
    const configPath = join(baseDir, CONFIG_PATH);
    const configDir = join(baseDir, dirname(CONFIG_PATH));
    // Ensure .agents-common directory exists
    await fs.mkdir(configDir, { recursive: true });
    // Write config with pretty formatting
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
/**
 * Detect which assistant folders exist in the directory
 * @param baseDir - Base directory to scan
 * @returns Array of assistant names that have folders present
 */
export async function detectAvailableAssistants(baseDir) {
    const available = [];
    for (const [name, config] of Object.entries(ASSISTANT_MAP)) {
        // Handle both string and AssistantPathConfig types
        let skillsPath;
        if (typeof config === 'string') {
            skillsPath = config;
        }
        else {
            // For assistants with dual paths, check the project path
            skillsPath = config.project;
        }
        // Extract the folder name (first path segment before /)
        const folder = skillsPath.split('/')[0];
        const dir = join(baseDir, folder);
        try {
            await fs.access(dir);
            available.push(name);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error; // Re-throw unexpected errors
            }
            // Folder doesn't exist, skip
        }
    }
    return available;
}
/**
 * Interactive reconfiguration flow
 * @param baseDir - Base directory for config
 */
export async function reconfigure(baseDir) {
    // Detect which folders exist for pre-selection
    const detected = await detectAvailableAssistants(baseDir);
    // Build choices for all available assistants
    const choices = Object.keys(ASSISTANT_MAP).map(name => ({
        name: name,
        checked: detected.includes(name)
    }));
    let selected;
    try {
        // Interactive checkbox prompt
        const answer = await inquirer.prompt([{
                type: 'checkbox',
                name: 'assistants',
                message: 'Select assistants to sync:',
                choices: choices,
                validate: (input) => {
                    return input.length > 0 || 'Please select at least one assistant';
                }
            }]);
        selected = answer.assistants;
    }
    catch (error) {
        // User cancelled (Ctrl+C)
        throw new Error('Configuration cancelled.');
    }
    try {
        // Write new config
        await writeConfig(baseDir, {
            version: 1,
            assistants: selected
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to write configuration: ${errorMessage}`);
        process.exit(1);
    }
    console.log(`Configured assistants: ${selected.join(', ')}`);
}
/**
 * Ensure config exists, create if needed
 * @param baseDir - Base directory for config
 * @returns Config object
 */
export async function ensureConfig(baseDir) {
    // Check if config already exists
    const existing = await readConfig(baseDir);
    if (existing) {
        return existing;
    }
    // Detect which assistant folders exist
    const detected = await detectAvailableAssistants(baseDir);
    if (detected.length === 0) {
        // No folders exist - prompt user to select
        console.log('No assistant folders found.');
    }
    let selected;
    const choices = Object.keys(ASSISTANT_MAP).map(name => ({
        name: name,
        checked: detected.includes(name)
    }));
    try {
        const answer = await inquirer.prompt([{
                type: 'checkbox',
                name: 'assistants',
                message: 'Select assistants to set up:',
                choices,
                validate: (input) => {
                    return input.length > 0 || 'Please select at least one assistant';
                }
            }]);
        selected = answer.assistants;
    }
    catch (error) {
        // User cancelled (Ctrl+C)
        throw new Error('Configuration cancelled.');
    }
    // Create and save config
    const config = { version: 1, assistants: selected };
    try {
        await writeConfig(baseDir, config);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to write configuration: ${errorMessage}`);
        process.exit(1);
    }
    return config;
}
/**
 * Get AssistantConfig[] from Config
 * @param config - Config object
 * @param homeMode - If true, use home paths; if false, use project paths (default: false)
 * @returns Array of AssistantConfig for enabled assistants
 */
export function getEnabledAssistants(config, homeMode = false) {
    return getAssistantConfigs(config.assistants, homeMode);
}
//# sourceMappingURL=config.js.map