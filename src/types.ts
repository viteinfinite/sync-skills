/**
 * Configuration for an AI assistant type
 */
export interface AssistantConfig {
  /** Assistant identifier (e.g., 'claude', 'codex') */
  name: string;
  /** Directory name (e.g., '.claude', '.codex') */
  dir: string;
  /** Full path to skills directory (e.g., '.claude/skills') */
  skillsDir: string;
}

/**
 * State of an assistant directory and its skills
 */
export interface AssistantState {
  /** Assistant configuration */
  config: AssistantConfig;
  /** Whether the assistant directory exists */
  hasDir: boolean;
  /** Whether the assistant has any skills */
  hasSkills: boolean;
  /** List of skill files found */
  skills: SkillFile[];
}

/**
 * A skill file reference
 */
export interface SkillFile {
  /** Absolute path to the skill file */
  path: string;
  /** Name of the skill (directory name) */
  skillName: string;
}

/**
 * A pair of assistants for potential sync operation
 */
export interface SyncPair {
  /** Source assistant (has skills) */
  source: AssistantState;
  /** Target assistant (needs skills) */
  target: AssistantState;
}

/**
 * User action for sync prompt
 */
export type SyncAction = 'abort' | 'create' | 'skip';

/**
 * Options for the main run function
 */
export interface RunOptions {
  /** Base directory to scan (default: process.cwd()) */
  baseDir?: string;
  /** Exit with error code 1 on conflict (default: false) */
  failOnConflict?: boolean;
  /** Dry run - don't make any changes (default: false) */
  dryRun?: boolean;
  /** Target assistants to sync (default: ['claude', 'codex']) */
  targets?: string[];
  /** Use home directory instead of cwd (default: false) */
  homeMode?: boolean;
  /** Run reconfiguration flow (default: false) */
  reconfigure?: boolean;
}

/**
 * Detected conflict between skills
 */
export interface Conflict {
  /** Name of the skill in conflict */
  skillName: string;
  /** Path to Claude version of the skill */
  claudePath: string;
  /** Path to Codex version of the skill */
  codexPath: string;
  /** Hash of Claude skill content */
  claudeHash: string;
  /** Hash of Codex skill content */
  codexHash: string;
  /** Claude skill content for diff display */
  claudeContent?: string;
  /** Codex skill content for diff display */
  codexContent?: string;
  /** Type of conflict: 'content' for full content, 'frontmatter' for metadata only */
  conflictType?: 'content' | 'frontmatter';
}

/**
 * User resolution for a conflict
 */
export interface ConflictResolution {
  /** Action to take */
  action: 'abort' | 'use-claude' | 'use-codex' | 'keep-both';
}

/**
 * Parsed skill file with frontmatter
 */
export interface ParsedSkill {
  /** Frontmatter data */
  data: Record<string, unknown>;
  /** Body content */
  content: string;
  /** Whether the content starts with an @ reference */
  hasAtReference: boolean;
}

/**
 * Registry of known assistant types
 * @deprecated Use ASSISTANT_MAP and getAssistantConfigs() instead. This will be removed in a future version.
 */
export const ASSISTANTS: readonly AssistantConfig[] = [
  { name: 'claude', dir: '.claude', skillsDir: '.claude/skills' },
  { name: 'codex', dir: '.codex', skillsDir: '.codex/skills' }
] as const;

/**
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 *
 * This replaces the ASSISTANTS constant for better extensibility.
 * Use getAssistantConfigs() to convert this map into AssistantConfig[] objects.
 */
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude/skills',
  'codex': '.codex/skills',
};

/**
 * Get AssistantConfig[] from assistant names
 * @param names - Optional array of assistant names. If omitted, returns all.
 * @returns Array of AssistantConfig objects for valid assistant names only
 */
export function getAssistantConfigs(names?: string[]): AssistantConfig[] {
  const requested = names || Object.keys(ASSISTANT_MAP);
  const valid: AssistantConfig[] = [];
  const invalid: string[] = [];

  for (const name of requested) {
    if (name in ASSISTANT_MAP) {
      const skillsPath = ASSISTANT_MAP[name];
      // Extract the folder name (first path segment)
      const folder = skillsPath.split('/')[0];

      valid.push({
        name,
        dir: folder,
        skillsDir: skillsPath
      });
    } else {
      invalid.push(name);
    }
  }

  if (invalid.length > 0) {
    console.warn(`Warning: Invalid assistant names ignored: ${invalid.join(', ')}`);
    console.warn(`Valid assistants: ${Object.keys(ASSISTANT_MAP).join(', ')}`);
  }

  return valid;
}
