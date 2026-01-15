export declare function refactorSkill(sourcePath: string): Promise<string | null>;
export declare function copySkill(sourcePath: string, targetPath: string): Promise<void>;
/**
 * Compute hash of skill state (frontmatter + body + dependent files)
 * @param coreFrontmatter - CORE_FIELDS from skill
 * @param bodyContent - SKILL.md body content
 * @param dependentFiles - Array of dependent files with hashes
 * @returns Hash in format "sha256-{hex}"
 */
export declare function computeSkillHash(coreFrontmatter: Record<string, unknown>, bodyContent: string, dependentFiles?: Array<{
    path: string;
    hash: string;
}>): string;
//# sourceMappingURL=syncer.d.ts.map