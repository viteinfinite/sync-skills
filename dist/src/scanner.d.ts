import type { AssistantConfig } from './types.js';
interface WalkDirResult {
    agent: string;
    skillName: string;
    path: string;
    relativePath: string;
}
interface ScanResult {
    /** Map of assistant name to their skills (e.g., { claude: [...], codex: [...], kilo: [...] }) */
    platforms: Record<string, WalkDirResult[]>;
    /** Skills in .agents-common */
    common: WalkDirResult[];
}
/**
 * Scan for skills in all enabled assistant directories and .agents-common
 * @param baseDir - Base directory to scan
 * @param assistantConfigs - Array of assistant configs to scan
 * @returns ScanResult with platform skills map and common skills
 */
export declare function scanSkills(baseDir?: string, assistantConfigs?: AssistantConfig[]): Promise<ScanResult>;
export {};
//# sourceMappingURL=scanner.d.ts.map