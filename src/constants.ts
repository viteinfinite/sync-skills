/**
 * Core frontmatter fields that should be preserved when syncing skills
 */
export const CORE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools', 'user-invocable', 'disable-model-invocation'] as const;

/** Common managed folder root */
export const COMMON_DIR = '.sync-skills';

/** Common managed skills directory */
export const COMMON_SKILLS_DIR = `${COMMON_DIR}/skills`;
