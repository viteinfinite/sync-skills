/**
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 *
 * Use getAssistantConfigs() to convert this map into AssistantConfig[] objects.
 */
export const ASSISTANT_MAP = {
    'amp': '.agents/skills',
    'claude': '.claude/skills',
    'cline': '.cline/skills',
    'codex': '.codex/skills',
    'cursor': '.cursor/skills',
    'gemini': '.gemini/skills',
    'github': '.github/skills',
    'kilo': '.kilocode/skills',
    'opencode': { project: '.opencode/skill', home: '.config/opencode/skill' },
    'roo': '.roo/skills',
    'windsurf': { project: '.windsurf/skills', home: '.codeium/windsurf/skills' },
};
/**
 * Get AssistantConfig[] from assistant names
 * @param names - Optional array of assistant names. If omitted, returns all.
 * @param homeMode - If true, use home paths; if false, use project paths (default: false)
 * @returns Array of AssistantConfig objects for valid assistant names only
 */
export function getAssistantConfigs(names, homeMode = false) {
    const requested = names || Object.keys(ASSISTANT_MAP);
    const valid = [];
    const invalid = [];
    for (const name of requested) {
        if (name in ASSISTANT_MAP) {
            const config = ASSISTANT_MAP[name];
            // Handle both string and AssistantPathConfig types
            let skillsPath;
            if (typeof config === 'string') {
                skillsPath = config;
            }
            else {
                // AssistantPathConfig: use project or home path based on mode
                skillsPath = homeMode ? config.home : config.project;
            }
            // Extract the folder name (first path segment)
            const folder = skillsPath.split('/')[0];
            const assistantConfig = {
                name,
                dir: folder,
                skillsDir: skillsPath
            };
            // Add home properties if in home mode and config has home path
            if (homeMode && typeof config === 'object') {
                const homeFolder = config.home.split('/')[0];
                assistantConfig.homeDir = homeFolder;
                assistantConfig.homeSkillsDir = config.home;
            }
            valid.push(assistantConfig);
        }
        else {
            invalid.push(name);
        }
    }
    if (invalid.length > 0) {
        console.warn(`Warning: Invalid assistant names ignored: ${invalid.join(', ')}`);
        console.warn(`Valid assistants: ${Object.keys(ASSISTANT_MAP).join(', ')}`);
    }
    return valid;
}
//# sourceMappingURL=types.js.map