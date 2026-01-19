import type { Conflict, SkillFile } from './types.js';
declare function formatDiff(contentA: string, contentB: string): string;
export declare function detectConflicts(skillsA: SkillFile[], skillsB: SkillFile[], platformA?: string, platformB?: string): Promise<Conflict[]>;
/**
 * Out-of-sync skill information
 */
export interface OutOfSyncSkill {
    /** Name of the skill */
    skillName: string;
    /** Platform name (e.g., 'claude') */
    platform: string;
    /** Path to the platform skill file */
    platformPath: string;
    /** Current hash of the platform skill */
    currentHash: string;
    /** Stored hash from metadata.sync.hash */
    storedHash: string;
}
/**
 * Detect platform skills that have been modified outside of sync-skills
 * @param platformSkills - Array of platform skill files
 * @returns Array of out-of-sync skills
 */
export declare function detectOutOfSyncSkills(platformSkills: SkillFile[]): Promise<OutOfSyncSkill[]>;
export { formatDiff };
//# sourceMappingURL=detector.d.ts.map