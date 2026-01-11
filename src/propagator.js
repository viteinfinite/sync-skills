import { promises as fs } from 'fs';
import matter from 'gray-matter';
import { parseSkillFile } from './parser.js';

const CORE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
const SKIP_FIELDS = ['sync'];
const LIST_MERGE_FIELDS = ['allowed-tools'];
const OBJECT_MERGE_FIELDS = ['metadata', 'hooks'];

/**
 * Propagate frontmatter from common skill to target skills
 * @param {string} commonPath - Path to .agents-common skill
 * @param {string[]} targetPaths - Paths to target skills (.claude, .codex)
 * @param {object} options - { failOnConflict, dryRun, resolver }
 */
export async function propagateFrontmatter(commonPath, targetPaths, options = {}) {
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

  if (!commonParsed || !commonParsed.frontmatter) {
    // No frontmatter in common, nothing to propagate
    return;
  }

  const commonFrontmatter = commonParsed.frontmatter;

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
 * @returns { object } - { merged: object, conflicts: array }
 */
function mergeFrontmatter(common, target) {
  const merged = { ...target };
  const conflicts = [];

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
    if (OBJECT_MERGE_FIELDS.includes(field) && typeof commonValue === 'object' && typeof targetValue === 'object' && !Array.isArray(commonValue) && !Array.isArray(targetValue)) {
      merged[field] = { ...targetValue, ...commonValue };
      continue;
    }

    // Conflict detected
    conflicts.push({
      field,
      commonValue,
      targetValue
    });
  }

  return { merged, conflicts };
}

/**
 * Default conflict resolver that prompts the user
 * This is a placeholder - actual implementation would use readline or inquirer
 */
async function defaultResolver(conflict, targetPath) {
  const skillName = targetPath.split('/').slice(-2, -1)[0];

  console.log(`\nConflict in skill "${skillName}" for field "${conflict.field}":`);
  console.log(`  Common: ${JSON.stringify(conflict.commonValue)}`);
  console.log(`  Target: ${JSON.stringify(conflict.targetValue)}`);
  console.log(`Choose: (c)ommon, (t)arget, (s)kip all for this skill`);

  // For now, default to 'target' to preserve existing behavior
  // In a real implementation, this would use readline/inquirer
  return 'target';
}
