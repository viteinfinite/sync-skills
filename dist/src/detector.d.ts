import type { Conflict, SkillFile } from './types.js';
declare function formatDiff(claudeContent: string, codexContent: string): string;
export declare function detectConflicts(claudeSkills: SkillFile[], codexSkills: SkillFile[]): Promise<Conflict[]>;
export { formatDiff };
//# sourceMappingURL=detector.d.ts.map