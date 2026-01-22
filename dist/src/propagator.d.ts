interface FrontmatterConflict {
    field: string;
    commonValue: unknown;
    targetValue: unknown;
}
interface PropagateOptions {
    failOnConflict?: boolean;
    resolver?: (conflict: FrontmatterConflict, targetPath: string) => Promise<string>;
}
/**
 * Propagate frontmatter from common skill to target skills
 */
export declare function propagateFrontmatter(commonPath: string, targetPaths: string[], options?: PropagateOptions): Promise<void>;
export {};
//# sourceMappingURL=propagator.d.ts.map