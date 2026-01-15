import { promises as fs } from 'fs';
import matter from 'gray-matter';
import { parseSkillFile } from './parser.js';
import { CORE_FIELDS } from './constants.js';

const SKIP_FIELDS = ['sync'];
const LIST_MERGE_FIELDS = ['allowed-tools'];
const OBJECT_MERGE_FIELDS = ['metadata', 'hooks'];

interface FrontmatterConflict {
  field: string;
  commonValue: unknown;
  targetValue: unknown;
}

interface MergeResult {
  merged: Record<string, unknown>;
  conflicts: FrontmatterConflict[];
}

interface PropagateOptions {
  failOnConflict?: boolean;
  dryRun?: boolean;
  resolver?: (conflict: FrontmatterConflict, targetPath: string) => Promise<string>;
}

/**
 * Propagate frontmatter from common skill to target skills
 */
export async function propagateFrontmatter(
  commonPath: string,
  targetPaths: string[],
  options: PropagateOptions = {}
): Promise<void> {
  const { failOnConflict = false, dryRun = false, resolver = defaultResolver } = options;

  // Check if common file exists
  try {
    await fs.access(commonPath);
  } catch {
    // Common file doesn't exist, silent no-op
    return;
  }

  // Read and parse common frontmatter
  const commonContent = await fs.readFile(commonPath, 'utf8');
  const commonParsed = parseSkillFile(commonContent);

  if (!commonParsed || !commonParsed.data) {
    // No frontmatter in common, nothing to propagate
    return;
  }

  const commonFrontmatter = commonParsed.data;

  // Process each target
  for (const targetPath of targetPaths) {
    // Check if target file exists
    try {
      await fs.access(targetPath);
    } catch {
      // Target doesn't exist, skip
      continue;
    }

    // Read and parse target frontmatter
    const targetContent = await fs.readFile(targetPath, 'utf8');
    const targetParsed = matter(targetContent);
    const targetFrontmatter = targetParsed.data;

    // Merge frontmatter
    const { merged, conflicts } = mergeFrontmatter(commonFrontmatter, targetFrontmatter);

    // Resolve conflicts
    for (const conflict of conflicts) {
      const resolution = await resolver(conflict, targetPath);

      if (resolution === 'skip-all') {
        break;
      } else if (resolution === 'common') {
        merged[conflict.field] = conflict.commonValue;
      } else if (resolution === 'target') {
        merged[conflict.field] = conflict.targetValue;
      } else if (failOnConflict) {
        throw new Error(`Conflict in skill "${targetPath}" for field "${conflict.field}"`);
      }
    }

    // Write merged frontmatter back to target
    if (!dryRun) {
      const newContent = matter.stringify(targetParsed.content, merged);
      await fs.writeFile(targetPath, newContent);
    } else {
      console.log(`[Dry-run] Would update ${targetPath}`);
      console.log(`  Frontmatter:`, merged);
    }
  }
}

/**
 * Merge common frontmatter into target frontmatter
 */
function mergeFrontmatter(
  common: Record<string, unknown>,
  target: Record<string, unknown>
): MergeResult {
  const merged = { ...target };
  const conflicts: FrontmatterConflict[] = [];

  for (const [field, commonValue] of Object.entries(common)) {
    // Skip fields that should never be propagated
    if (SKIP_FIELDS.includes(field)) {
      continue;
    }

    const targetValue = target[field];

    // Field doesn't exist in target, copy from common
    if (targetValue === undefined) {
      merged[field] = commonValue;
      continue;
    }

    // Values are identical, no action needed
    if (JSON.stringify(commonValue) === JSON.stringify(targetValue)) {
      continue;
    }

    // Special handling for list merge fields
    if (LIST_MERGE_FIELDS.includes(field)) {
      const commonList = Array.isArray(commonValue) ? commonValue : [commonValue];
      const targetList = Array.isArray(targetValue) ? targetValue : [targetValue];
      const mergedList = [...new Set([...targetList, ...commonList])];
      merged[field] = mergedList;
      continue;
    }

    // Special handling for object merge fields
    if (
      OBJECT_MERGE_FIELDS.includes(field) &&
      typeof commonValue === 'object' &&
      typeof targetValue === 'object' &&
      !Array.isArray(commonValue) &&
      !Array.isArray(targetValue)
    ) {
      merged[field] = { ...(targetValue as Record<string, unknown>), ...(commonValue as Record<string, unknown>) };
      continue;
    }

    // Conflict detected
    conflicts.push({
      field,
      commonValue,
      targetValue
    });
  }

  // Always use common's sync hash as the source of truth
  const commonMetadata = common.metadata as Record<string, unknown> | undefined;
  if (commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)) {
    const commonSync = commonMetadata.sync as Record<string, unknown>;
    if (commonSync.hash) {
      merged.metadata = merged.metadata || {};
      const mergedMetadata = merged.metadata as Record<string, unknown>;
      mergedMetadata.sync = {
        ...(typeof mergedMetadata?.sync === 'object' && mergedMetadata.sync && !Array.isArray(mergedMetadata.sync)
          ? mergedMetadata.sync as Record<string, unknown>
          : {}),
        hash: commonSync.hash
      };
    }
  }

  return { merged, conflicts };
}

/**
 * Default conflict resolver that prompts the user
 */
async function defaultResolver(conflict: FrontmatterConflict, targetPath: string): Promise<string> {
  const skillName = targetPath.split('/').slice(-2, -1)[0];

  console.log(`\nConflict in skill "${skillName}" for field "${conflict.field}":`);
  console.log(`  Common: ${JSON.stringify(conflict.commonValue)}`);
  console.log(`  Target: ${JSON.stringify(conflict.targetValue)}`);
  console.log(`Choose: (c)ommon, (t)arget, (s)kip all for this skill`);

  // For now, default to 'target' to preserve existing behavior
  // In a real implementation, this would use readline/inquirer
  return 'target';
}
