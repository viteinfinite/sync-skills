import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import type {
  DependentFile,
  DependentFileHashes,
  DependentConflict,
  DependentConflictResolution,
  AssistantConfig
} from './types.js';

// Directories to ignore when scanning for dependent files
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'build',
  'coverage',
  '.vscode',
  '.idea',
  '.DS_Store'
]);

/**
 * Compute sha256 hash of a file's content
 * @param filePath - Absolute path to the file
 * @returns Hash in format "sha256-{hex}"
 */
export async function computeFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const hash = createHash('sha256').update(content).digest('hex');
    return `sha256-${hash}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to compute hash for ${filePath}: ${errorMessage}`);
  }
}

/**
 * Check if two hashes match
 * @param a - First hash
 * @param b - Second hash
 * @returns True if hashes are identical
 */
export function hashMatches(a: string, b: string): boolean {
  // Normalize to sha256- prefix for comparison
  const normalizeHash = (h: string) => h.startsWith('sha256-') ? h : `sha256-${h}`;
  return normalizeHash(a) === normalizeHash(b);
}

/**
 * Check if a file has changed compared to its stored hash
 * @param currentHash - Current file hash
 * @param storedHash - Hash stored in frontmatter (may be undefined)
 * @returns True if hash is different or stored hash is missing
 */
export function hashChanged(currentHash: string, storedHash: string | undefined): boolean {
  if (!storedHash) return true;
  return !hashMatches(currentHash, storedHash);
}

/**
 * Detect all dependent files in a skill folder
 * @param skillPath - Absolute path to the skill folder
 * @returns Array of dependent files with metadata
 */
export async function detectDependentFiles(skillPath: string): Promise<DependentFile[]> {
  const dependents: DependentFile[] = [];

  async function scanDir(dirPath: string, relativeBase: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip SKILL.md
        if (entry.name === 'SKILL.md') {
          continue;
        }

        // Skip ignored directories
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        const fullPath = join(dirPath, entry.name);
        const relativePath = join(relativeBase, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath, relativePath);
        } else if (entry.isFile()) {
          try {
            const hash = await computeFileHash(fullPath);
            dependents.push({
              relativePath,
              absolutePath: fullPath,
              hash
            });
          } catch {
            // Skip files that can't be read or hashed
            // Log warning but continue processing other files
            console.warn(`Warning: Skipping file ${relativePath} - could not read or hash`);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist or isn't accessible - silently skip
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not scan directory ${dirPath}: ${errorMessage}`);
    }
  }

  await scanDir(skillPath, '');
  return dependents;
}

/**
 * Collect dependent files from all platform folders
 * @param skillName - Name of the skill
 * @param platformPaths - Array of platform skill folder paths
 * @returns Map of platform name to array of dependent files
 */
export async function collectDependentFilesFromPlatforms(
  skillName: string,
  platformPaths: Array<{ name: string; path: string }>
): Promise<Map<string, DependentFile[]>> {
  const result = new Map<string, DependentFile[]>();

  for (const platform of platformPaths) {
    const skillPath = join(platform.path, skillName);

    try {
      // Check if skill folder exists
      await fs.access(skillPath);
      const dependents = await detectDependentFiles(skillPath);

      if (dependents.length > 0) {
        result.set(platform.name, dependents);
      }
    } catch {
      // Skill folder doesn't exist, skip this platform
      continue;
    }
  }

  return result;
}

/**
 * Get stored file hashes from SKILL.md frontmatter
 * @param skillPath - Path to the skill folder (containing SKILL.md)
 * @returns Map of file paths to stored hashes
 */
export async function getStoredHashes(skillPath: string): Promise<DependentFileHashes> {
  const skillMdPath = join(skillPath, 'SKILL.md');

  try {
    const content = await fs.readFile(skillMdPath, 'utf8');
    const parsed = matter(content);

    // Extract metadata.sync.files if it exists
    const metadata = parsed.data as { metadata?: { sync?: { files?: DependentFileHashes } } };

    if (metadata?.metadata?.sync?.files) {
      return metadata.metadata.sync.files;
    }

    return {};
  } catch {
    // File doesn't exist or can't be parsed
    return {};
  }
}

/**
 * Store file hashes in SKILL.md frontmatter
 * @param skillPath - Path to the skill folder (containing SKILL.md)
 * @param hashes - Map of file paths to hashes
 */
export async function storeFileHashesInFrontmatter(
  skillPath: string,
  hashes: DependentFileHashes
): Promise<void> {
  const skillMdPath = join(skillPath, 'SKILL.md');

  try {
    const content = await fs.readFile(skillMdPath, 'utf8');
    const parsed = matter(content);

    // Merge existing data with new sync metadata
    const existingData = parsed.data || {};
    const existingMetadata = (existingData as { metadata?: Record<string, unknown> }).metadata || {};

    const newData = {
      ...existingData,
      metadata: {
        ...existingMetadata,
        sync: {
          version: 1,
          files: hashes
        }
      }
    };

    // Reconstruct file with updated frontmatter
    const newContent = matter.stringify(content, newData);
    await fs.writeFile(skillMdPath, newContent, 'utf8');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to update frontmatter in ${skillMdPath}: ${errorMessage}`);
  }
}

/**
 * Consolidate dependent files to common folder
 * @param skillName - Name of the skill
 * @param platformFiles - Map of platform names to their dependent files
 * @param commonPath - Path to the common skills folder
 * @param storedHashes - Previously stored hashes from frontmatter
 * @returns Object containing conflicts and final hashes
 */
export async function consolidateDependentsToCommon(
  skillName: string,
  platformFiles: Map<string, DependentFile[]>,
  commonPath: string,
  storedHashes: DependentFileHashes = {}
): Promise<{ conflicts: DependentConflict[]; hashes: DependentFileHashes }> {
  const conflicts: DependentConflict[] = [];
  const finalHashes: DependentFileHashes = {};
  const commonSkillPath = join(commonPath, skillName);

  // Collect all unique file paths across all platforms
  const allFilePaths = new Set<string>();
  for (const files of platformFiles.values()) {
    for (const file of files) {
      allFilePaths.add(file.relativePath);
    }
  }

  // Create common skill directory if it doesn't exist
  await fs.mkdir(commonSkillPath, { recursive: true });

  // Process each unique file
  for (const relativePath of allFilePaths) {
    const fileVersions: Array<{ platform: string; file: DependentFile }> = [];

    // Collect all versions of this file from each platform
    for (const [platformName, files] of platformFiles.entries()) {
      const file = files.find(f => f.relativePath === relativePath);
      if (file) {
        fileVersions.push({ platform: platformName, file });
      }
    }

    if (fileVersions.length === 0) {
      continue;
    }

    // Determine which version to use
    const selectedVersion = await selectFileVersion(
      skillName,
      relativePath,
      fileVersions,
      commonSkillPath,
      storedHashes[relativePath]
    );

    if (selectedVersion.conflict) {
      conflicts.push(selectedVersion.conflict);
    }

    if (selectedVersion.action === 'skip') {
      // User chose to skip this file - don't copy it
      continue;
    }

    if (selectedVersion.action === 'abort') {
      // User chose to abort - propagate this
      conflicts.push({
        skillName,
        relativePath,
        platform: fileVersions[0].platform,
        platformPath: fileVersions[0].file.absolutePath,
        platformHash: fileVersions[0].file.hash
      });
      return { conflicts, hashes: finalHashes };
    }

    // Copy the selected file to common
    const sourcePath = selectedVersion.sourcePath;
    const targetPath = join(commonSkillPath, relativePath);

    // Create target directory structure
    await fs.mkdir(join(targetPath, '..'), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);

    // Store the final hash
    finalHashes[relativePath] = selectedVersion.hash;
  }

  return { conflicts, hashes: finalHashes };
}

/**
 * Select which version of a file to use
 * @param skillName - Name of the skill
 * @param relativePath - Relative path to the file
 * @param versions - All versions of this file from different platforms
 * @param commonPath - Path to the common skill folder
 * @param storedHash - Previously stored hash (if exists)
 * @returns Selection result with source path, hash, and any conflict
 */
async function selectFileVersion(
  skillName: string,
  relativePath: string,
  versions: Array<{ platform: string; file: DependentFile }>,
  commonPath: string,
  storedHash?: string
): Promise<{
  action: 'copy' | 'skip' | 'abort';
  sourcePath: string;
  hash: string;
  conflict?: DependentConflict;
}> {
  // Check if common version exists
  const commonFilePath = join(commonPath, relativePath);
  let commonHash: string | undefined;
  let commonExists = false;

  try {
    await fs.access(commonFilePath);
    commonHash = await computeFileHash(commonFilePath);
    commonExists = true;
  } catch {
    // Common file doesn't exist
  }

  // Single platform version - use it
  if (versions.length === 1) {
    const version = versions[0];

    // Check for conflict with stored hash
    if (storedHash && !hashMatches(version.file.hash, storedHash)) {
      // Conflict: file changed since last sync
      return {
        action: 'skip',
        sourcePath: version.file.absolutePath,
        hash: version.file.hash,
        conflict: {
          skillName,
          relativePath,
          platform: version.platform,
          platformPath: version.file.absolutePath,
          platformHash: version.file.hash,
          commonPath: commonExists ? commonFilePath : undefined,
          commonHash,
          storedHash
        }
      };
    }

    return {
      action: 'copy',
      sourcePath: version.file.absolutePath,
      hash: version.file.hash
    };
  }

  // Multiple platform versions - check if they all match
  const firstHash = versions[0].file.hash;
  const allMatch = versions.every(v => hashMatches(v.file.hash, firstHash));

  if (allMatch) {
    // All platforms have the same content - check against stored hash
    if (storedHash && !hashMatches(firstHash, storedHash)) {
      // Conflict: file changed since last sync
      return {
        action: 'skip',
        sourcePath: versions[0].file.absolutePath,
        hash: firstHash,
        conflict: {
          skillName,
          relativePath,
          platform: versions[0].platform,
          platformPath: versions[0].file.absolutePath,
          platformHash: firstHash,
          commonPath: commonExists ? commonFilePath : undefined,
          commonHash,
          storedHash
        }
      };
    }

    return {
      action: 'copy',
      sourcePath: versions[0].file.absolutePath,
      hash: firstHash
    };
  }

  // Conflict: platforms have different content
  // Return conflict for user resolution
  return {
    action: 'skip',
    sourcePath: versions[0].file.absolutePath,
    hash: versions[0].file.hash,
    conflict: {
      skillName,
      relativePath,
      platform: versions[0].platform,
      platformPath: versions[0].file.absolutePath,
      platformHash: versions[0].file.hash,
      commonPath: commonExists ? commonFilePath : undefined,
      commonHash,
      storedHash
    }
  };
}

/**
 * Clean up dependent files from a platform folder
 * @param platformPath - Path to the platform skills folder
 * @param skillName - Name of the skill
 * @param filesToRemove - Array of relative paths to remove
 */
export async function cleanupPlatformDependentFiles(
  platformPath: string,
  skillName: string,
  filesToRemove: string[]
): Promise<void> {
  const skillPath = join(platformPath, skillName);

  for (const relativePath of filesToRemove) {
    const filePath = join(skillPath, relativePath);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File doesn't exist or can't be deleted - log warning and continue
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Could not delete ${filePath}: ${errorMessage}`);
    }
  }

  // Clean up empty directories
  await removeEmptyDirectories(skillPath);
}

/**
 * Apply conflict resolutions for dependent files
 * @param conflicts - Array of conflicts to resolve
 * @param resolutions - Map of conflict keys to resolutions
 * @param commonPath - Path to the common skills folder
 * @returns Object containing final hashes
 */
export async function applyConflictResolutions(
  conflicts: DependentConflict[],
  resolutions: Map<string, DependentConflictResolution>,
  commonPath: string
): Promise<DependentFileHashes> {
  const finalHashes: DependentFileHashes = {};

  for (const conflict of conflicts) {
    const key = `${conflict.skillName}/${conflict.relativePath}`;
    const resolution = resolutions.get(key);

    if (!resolution || resolution.action === 'skip') {
      // Skip this file - don't include in final hashes
      continue;
    }

    if (resolution.action === 'abort') {
      throw new Error('Sync aborted by user');
    }

    const commonSkillPath = join(commonPath, conflict.skillName);
    const commonFilePath = join(commonSkillPath, conflict.relativePath);

    if (resolution.action === 'use-common') {
      // Keep common version - compute its hash
      if (conflict.commonPath) {
        const hash = await computeFileHash(conflict.commonPath);
        finalHashes[conflict.relativePath] = hash;
      }
    } else if (resolution.action === 'use-platform') {
      // Copy platform version to common
      await fs.mkdir(join(commonFilePath, '..'), { recursive: true });
      await fs.copyFile(conflict.platformPath, commonFilePath);

      const hash = await computeFileHash(conflict.platformPath);
      finalHashes[conflict.relativePath] = hash;
    }
  }

  return finalHashes;
}

/**
 * Recursively remove empty directories (but keep SKILL.md)
 * @param dirPath - Directory path to clean
 */
async function removeEmptyDirectories(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = join(dirPath, entry.name);
        await removeEmptyDirectories(fullPath);

        // Try to remove the directory if it's now empty
        try {
          const subEntries = await fs.readdir(fullPath);
          if (subEntries.length === 0) {
            await fs.rmdir(fullPath);
          }
        } catch {
          // Directory not empty or can't be removed - leave it
        }
      }
    }
  } catch {
    // Directory doesn't exist - skip
  }
}
