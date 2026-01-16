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
  /** Verbose output (default: false) */
  verbose?: boolean;
  /** Watch mode (default: false) */
  watch?: boolean;
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
 * Configurable map of assistant names to their folder names
 * Add new assistants here as key-value pairs
 *
 * Use getAssistantConfigs() to convert this map into AssistantConfig[] objects.
 */
export const ASSISTANT_MAP: Record<string, string> = {
  'claude': '.claude/skills',
  'codex': '.codex/skills',
  'kilo': '.kilocode/skills',
  'cursor': '.cursor/skills',
  'windsurf': '.windsurf/skills',
  'gemini': '.gemini/skills',
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

/**
 * A dependent file in a skill folder (non-SKILL.md files)
 */
export interface DependentFile {
  /** Path relative to the skill folder, e.g., "scripts/util.js" */
  relativePath: string;
  /** Absolute path to the file */
  absolutePath: string;
  /** sha256 hash of the file content */
  hash: string;
}

/**
 * Map of relative file paths to their hashes
 */
export interface DependentFileHashes {
  [relativePath: string]: string;  // "scripts/util.js": "sha256-abc123..."
}

/**
 * Sync metadata stored in SKILL.md frontmatter
 */
export interface SyncMetadata {
  version: number;
  files: DependentFileHashes;
}

/**
 * Conflict between dependent file versions
 */
export interface DependentConflict {
  /** Name of the skill */
  skillName: string;
  /** Relative path to the file */
  relativePath: string;
  /** Platform name (e.g., 'claude', 'codex', 'common') */
  platform: string;
  /** Path to the platform's version */
  platformPath: string;
  /** Hash of the platform's version */
  platformHash: string;
  /** Path to the common version (if exists) */
  commonPath?: string;
  /** Hash of the common version (if exists) */
  commonHash?: string;
  /** Platform file content for diff display */
  platformContent?: string;
  /** Common file content for diff display */
  commonContent?: string;
  /** Stored hash from frontmatter (if exists) */
  storedHash?: string;
}

/**
 * User resolution for a dependent file conflict
 */
export interface DependentConflictResolution {
  action: 'use-common' | 'use-platform' | 'skip' | 'abort';
}
