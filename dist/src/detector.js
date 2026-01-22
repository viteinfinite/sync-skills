import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { diffLines } from 'diff';
import chalk from 'chalk';
import { pickCoreFrontmatter } from './frontmatter.js';
/**
 * Normalize frontmatter by keeping only CORE_FIELDS for conflict detection
 * This ensures platform-specific fields like `model` don't cause false conflicts
 */
function normalizeFrontmatter(content) {
    const parsed = matter(content);
    const normalizedContent = parsed.content.trim();
    // Keep only core frontmatter fields for conflict comparison
    const coreData = pickCoreFrontmatter(parsed.data);
    // Drop tool-managed sync metadata to avoid false conflicts
    const cleanedData = stripSyncMetadata(coreData);
    // Sort object keys recursively for deterministic output
    const sortedData = sortObjectKeys(cleanedData);
    // Re-stringify with sorted keys
    return matter.stringify(normalizedContent, sortedData);
}
/**
 * Remove tool-managed sync metadata so it's not treated as a conflict
 */
function stripSyncMetadata(data) {
    const cleaned = { ...data };
    if ('sync' in cleaned) {
        delete cleaned.sync;
    }
    if (cleaned.metadata &&
        typeof cleaned.metadata === 'object' &&
        !Array.isArray(cleaned.metadata)) {
        const metadata = { ...cleaned.metadata };
        if ('sync' in metadata) {
            delete metadata.sync;
        }
        if (Object.keys(metadata).length === 0) {
            delete cleaned.metadata;
        }
        else {
            cleaned.metadata = metadata;
        }
    }
    return cleaned;
}
/**
 * Recursively sort object keys for deterministic frontmatter
 */
function sortObjectKeys(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
        sorted[key] = sortObjectKeys(obj[key]);
    }
    return sorted;
}
/**
 * Compute hash of normalized content (order-independent frontmatter)
 */
async function hashNormalized(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const normalized = normalizeFrontmatter(content);
    return createHash('sha256').update(normalized).digest('hex');
}
function getConflictType(contentA, contentB) {
    const parsedA = matter(contentA);
    const parsedB = matter(contentB);
    // If both have @ references, check if they point to the same file
    const refA = extractReference(parsedA.content);
    const refB = extractReference(parsedB.content);
    if (refA && refB) {
        // Both are references - conflict is in frontmatter
        return refA === refB ? 'frontmatter' : 'content';
    }
    // At least one has actual content
    return 'content';
}
function extractReference(content) {
    const match = content.trim().match(/^@(.+)$/);
    return match ? match[1] : null;
}
function formatDiff(contentA, contentB) {
    const diff = diffLines(contentA, contentB);
    const output = [];
    for (const part of diff) {
        const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        // Limit output to first 20 lines
        if (output.length < 20) {
            output.push(color(prefix + part.value.trimEnd()));
        }
    }
    if (diff.length > 20) {
        output.push(chalk.gray('... (diff truncated)'));
    }
    return output.join('\n');
}
export async function detectConflicts(skillsA, skillsB, platformA = 'claude', platformB = 'codex') {
    const conflicts = [];
    for (const skillA of skillsA) {
        const skillB = skillsB.find(s => s.skillName === skillA.skillName);
        if (skillB) {
            const contentA = await fs.readFile(skillA.path, 'utf8');
            const contentB = await fs.readFile(skillB.path, 'utf8');
            // Use normalized hashes to ignore field order differences
            const hashA = await hashNormalized(skillA.path);
            const hashB = await hashNormalized(skillB.path);
            if (hashA !== hashB) {
                const conflictType = getConflictType(contentA, contentB);
                conflicts.push({
                    skillName: skillA.skillName,
                    platformA,
                    platformB,
                    pathA: skillA.path,
                    pathB: skillB.path,
                    hashA,
                    hashB,
                    contentA,
                    contentB,
                    conflictType
                });
            }
        }
    }
    return conflicts;
}
/**
 * Detect platform skills that are out of sync with their common skills
 * @param platformSkills - Array of platform skill files
 * @param commonSkills - Array of common skill files
 * @param platformName - Name of the platform (e.g., 'claude')
 * @returns Array of out-of-sync skills
 */
export async function detectOutOfSyncSkills(platformSkills, commonSkills, platformName) {
    const outOfSync = [];
    for (const platformSkill of platformSkills) {
        try {
            const platformContent = await fs.readFile(platformSkill.path, 'utf8');
            const platformParsed = matter(platformContent);
            // Find the corresponding common skill
            const commonSkill = commonSkills.find(c => c.skillName === platformSkill.skillName);
            if (!commonSkill) {
                // No common skill exists, skip
                continue;
            }
            const commonContent = await fs.readFile(commonSkill.path, 'utf8');
            const commonParsed = matter(commonContent);
            // Extract common hash from metadata
            const commonMetadata = commonParsed.data?.metadata &&
                typeof commonParsed.data.metadata === 'object' &&
                !Array.isArray(commonParsed.data.metadata)
                ? commonParsed.data.metadata
                : undefined;
            const commonSync = commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)
                ? commonMetadata.sync
                : undefined;
            const storedCommonHash = commonSync?.hash;
            if (!storedCommonHash) {
                // Common skill has no hash, skip
                continue;
            }
            // Detect mismatches
            const expectedRef = `.agents-common/skills/${platformSkill.skillName}/SKILL.md`;
            const mismatchType = detectSyncMismatch(platformParsed, commonParsed, expectedRef);
            if (mismatchType) {
                outOfSync.push({
                    skillName: platformSkill.skillName,
                    platform: platformName,
                    platformPath: platformSkill.path,
                    commonPath: commonSkill.path,
                    mismatchType,
                    platformContent,
                    commonContent
                });
            }
        }
        catch (error) {
            // Skip files that can't be read or parsed
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Warning: Could not check sync for ${platformSkill.path}: ${errorMessage}`);
        }
    }
    return outOfSync;
}
/**
 * Detect what type of sync mismatch exists between platform and common
 * @param platformParsed - Parsed platform skill
 * @param commonParsed - Parsed common skill
 * @returns The type of mismatch, or null if in sync
 */
function detectSyncMismatch(platformParsed, commonParsed, expectedRef) {
    const platformBody = platformParsed.content.trim();
    const commonBody = commonParsed.content.trim();
    // Check if platform has @ reference
    const platformHasReference = platformBody.startsWith('@');
    const platformReference = extractReference(platformBody);
    // Check body mismatch
    let bodyMismatch = false;
    if (platformHasReference) {
        // Platform has @ reference - check if it points to the correct common skill
        if (platformReference !== expectedRef) {
            bodyMismatch = true;
        }
    }
    else {
        // Platform has actual content - compare with common body
        if (platformBody !== commonBody) {
            bodyMismatch = true;
        }
    }
    // Check frontmatter mismatch by comparing core fields without sync metadata
    const platformData = platformParsed.data;
    const commonData = commonParsed.data;
    // Build comparison objects without sync metadata
    const platformCompare = {};
    const commonCompare = {};
    // Copy all CORE_FIELDS except metadata.sync
    for (const key of ['name', 'description', 'license', 'compatibility', 'allowed-tools']) {
        if (platformData[key] !== undefined)
            platformCompare[key] = platformData[key];
        if (commonData[key] !== undefined)
            commonCompare[key] = commonData[key];
    }
    // Handle metadata field: copy all except sync
    if (platformData.metadata) {
        const platformMetadata = { ...platformData.metadata };
        delete platformMetadata.sync;
        if (Object.keys(platformMetadata).length > 0) {
            platformCompare.metadata = platformMetadata;
        }
    }
    if (commonData.metadata) {
        const commonMetadata = { ...commonData.metadata };
        delete commonMetadata.sync;
        if (Object.keys(commonMetadata).length > 0) {
            commonCompare.metadata = commonMetadata;
        }
    }
    const platformHash = JSON.stringify(platformCompare);
    const commonHash = JSON.stringify(commonCompare);
    const frontmatterMismatch = platformHash !== commonHash;
    // Determine mismatch type based on the rules:
    // - If body is out of sync AND platform has @ reference: treat as body or both
    // - If frontmatter is out of sync only: frontmatter mismatch
    // - If both are out of sync: treat as both
    if (bodyMismatch && frontmatterMismatch) {
        return 'both';
    }
    if (bodyMismatch) {
        return 'body';
    }
    if (frontmatterMismatch) {
        return 'frontmatter';
    }
    return null;
}
export { formatDiff };
//# sourceMappingURL=detector.js.map