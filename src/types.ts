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
 */
export const ASSISTANTS: readonly AssistantConfig[] = [
  { name: 'claude', dir: '.claude', skillsDir: '.claude/skills' },
  { name: 'codex', dir: '.codex', skillsDir: '.codex/skills' }
] as const;

/**
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 */
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude',
  'codex': '.codex',
};

/**
 * Get AssistantConfig[] from assistant names
 * @param names - Optional array of assistant names. If omitted, returns all.
 * @returns Array of AssistantConfig objects
 */
export function getAssistantConfigs(names?: string[]): AssistantConfig[] {
  const enabled = names || Object.keys(ASSISTANT_MAP);
  return enabled.map(name => ({
    name,
    dir: ASSISTANT_MAP[name],
    skillsDir: `${ASSISTANT_MAP[name]}/skills`
  }));
}
