import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { diffLines } from 'diff';
import chalk from 'chalk';
/**
 * Normalize frontmatter by sorting keys for consistent comparison
 * This ensures different field order is not treated as a conflict
 */
function normalizeFrontmatter(content) {
    const parsed = matter(content);
    const normalizedContent = parsed.content.trim();
    // Drop tool-managed sync metadata to avoid false conflicts
    const cleanedData = stripSyncMetadata(parsed.data);
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
async function hashFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
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
export { formatDiff };
//# sourceMappingURL=detector.js.map