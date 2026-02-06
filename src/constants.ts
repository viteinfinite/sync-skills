/**
 * Core frontmatter fields that should be preserved when syncing skills
 */
export const CORE_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'] as const;

/** Common managed folder root */
export const COMMON_DIR = '.agents';

/** Common managed skills directory */
export const COMMON_SKILLS_DIR = `${COMMON_DIR}/skills`;

/** Managed skills manifest path */
export const MANAGED_SKILLS_PATH = `${COMMON_DIR}/managed-skills.json`;
