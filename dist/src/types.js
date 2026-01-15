/**
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 *
 * Use getAssistantConfigs() to convert this map into AssistantConfig[] objects.
 */
export const ASSISTANT_MAP = {
    'claude': '.claude/skills',
    'codex': '.codex/skills',
};
/**
 * Get AssistantConfig[] from assistant names
 * @param names - Optional array of assistant names. If omitted, returns all.
 * @returns Array of AssistantConfig objects for valid assistant names only
 */
export function getAssistantConfigs(names) {
    const requested = names || Object.keys(ASSISTANT_MAP);
    const valid = [];
    const invalid = [];
    for (const name of requested) {
        if (name in ASSISTANT_MAP) {
            const skillsPath = ASSISTANT_MAP[name];
            // Extract the folder name (first path segment)
            const folder = skillsPath.split('/')[0];
            valid.push({
                name,
                dir: folder,
                skillsDir: skillsPath
            });
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