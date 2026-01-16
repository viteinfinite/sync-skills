/**
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 *
 * Use getAssistantConfigs() to convert this map into AssistantConfig[] objects.
 *
 * Sources for configuration paths:
 * - Claude: [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
 * - Codex: [Agent Skills - OpenAI Codex Docs](https://developers.openai.com/codex/skills/)
 * - Kilo: [Agent Skills - r/kilocode](https://www.reddit.com/r/kilocode/comments/1q91luh/agent_skills/)
 * - Cursor: [Cursor AI Guide 2025](https://medium.com/@hilalkara.dev/cursor-ai-complete-guide-2025-real-experiences-pro-tips-mcps-rules-context-engineering-6de1a776a8af)
 * - Windsurf: [Cascade Memories - Windsurf Docs](https://docs.windsurf.com/windsurf/cascade/memories)
 */
export const ASSISTANT_MAP = {
    'claude': '.claude/skills',
    'codex': '.codex/skills',
    'kilo': '.kilocode/skills',
    'cursor': '.cursor/rules',
    'windsurf': '.codeium/windsurf/memories',
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