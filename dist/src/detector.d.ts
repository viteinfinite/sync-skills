import type { Conflict, SkillFile } from './types.js';
declare function formatDiff(contentA: string, contentB: string): string;
export declare function detectConflicts(skillsA: SkillFile[], skillsB: SkillFile[], platformA?: string, platformB?: string): Promise<Conflict[]>;
export { formatDiff };
//# sourceMappingURL=detector.d.ts.map