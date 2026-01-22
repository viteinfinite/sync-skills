import type { DependentFile, DependentConflict, DependentConflictResolution } from './types.js';
/**
 * Compute sha256 hash of a file's content
 * @param filePath - Absolute path to the file
 * @returns Hash in format "sha256-{hex}"
 */
export declare function computeFileHash(filePath: string): Promise<string>;
/**
 * Check if two hashes match
 * @param a - First hash
 * @param b - Second hash
 * @returns True if hashes are identical
 */
export declare function hashMatches(a: string, b: string): boolean;
/**
 * Check if a file has changed compared to its stored hash
 * @param currentHash - Current file hash
 * @param storedHash - Hash stored in frontmatter (may be undefined)
 * @returns True if hash is different or stored hash is missing
 */
export declare function hashChanged(currentHash: string, storedHash: string | undefined): boolean;
/**
 * Detect all dependent files in a skill folder
 * @param skillPath - Absolute path to the skill folder
 * @returns Array of dependent files with metadata
 */
export declare function detectDependentFiles(skillPath: string): Promise<DependentFile[]>;
/**
 * Collect dependent files from all platform folders
 * @param skillName - Name of the skill
 * @param platformPaths - Array of platform skill folder paths
 * @returns Map of platform name to array of dependent files
 */
export declare function collectDependentFilesFromPlatforms(skillName: string, platformPaths: Array<{
    name: string;
    path: string;
}>): Promise<Map<string, DependentFile[]>>;
/**
 * Consolidate dependent files to common folder
 * @param skillName - Name of the skill
 * @param platformFiles - Map of platform names to their dependent files
 * @param commonPath - Path to the common skills folder
 * @returns Object containing conflicts and list of consolidated files
 */
export declare function consolidateDependentsToCommon(skillName: string, platformFiles: Map<string, DependentFile[]>, commonPath: string): Promise<{
    conflicts: DependentConflict[];
    files: string[];
}>;
/**
 * Clean up dependent files from a platform folder
 * @param platformPath - Path to the platform skills folder
 * @param skillName - Name of the skill
 * @param filesToRemove - Array of relative paths to remove
 */
export declare function cleanupPlatformDependentFiles(platformPath: string, skillName: string, filesToRemove: string[], attemptedRemovals?: Set<string>): Promise<void>;
/**
 * Apply conflict resolutions for dependent files
 * @param conflicts - Array of conflicts to resolve
 * @param resolutions - Map of conflict keys to resolutions
 * @param commonPath - Path to the common skills folder
 * @returns Array of resolved file paths
 */
export declare function applyConflictResolutions(conflicts: DependentConflict[], resolutions: Map<string, DependentConflictResolution>, commonPath: string): Promise<string[]>;
//# sourceMappingURL=dependents.d.ts.map