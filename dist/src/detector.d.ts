import type { Conflict, SkillFile, OutOfSyncSkill } from './types.js';
declare function formatDiff(contentA: string, contentB: string): string;
export declare function detectConflicts(skillsA: SkillFile[], skillsB: SkillFile[], platformA?: string, platformB?: string): Promise<Conflict[]>;
/**
 * Detect platform skills that are out of sync with their common skills
 * @param platformSkills - Array of platform skill files
 * @param commonSkills - Array of common skill files
 * @param platformName - Name of the platform (e.g., 'claude')
 * @returns Array of out-of-sync skills
 */
export declare function detectOutOfSyncSkills(platformSkills: SkillFile[], commonSkills: SkillFile[], platformName: string): Promise<OutOfSyncSkill[]>;
export { formatDiff };
//# sourceMappingURL=detector.d.ts.map