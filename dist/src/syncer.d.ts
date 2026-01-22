export declare function refactorSkill(sourcePath: string): Promise<string | null>;
export declare function writePlatformReference(platformPath: string, commonPath: string): Promise<void>;
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
/**
 * Update the main hash in a skill's frontmatter
 * @param skillPath - Path to the SKILL.md file
 * @param newHash - New hash value
 */
export declare function updateMainHash(skillPath: string, newHash: string): Promise<void>;
//# sourceMappingURL=syncer.d.ts.map