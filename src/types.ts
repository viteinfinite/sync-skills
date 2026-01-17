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
  /** Home directory name (e.g., '.config/assistant', only set in home mode) */
  homeDir?: string;
  /** Full path to home skills directory (only set in home mode) */
  homeSkillsDir?: string;
}

/**
 * Path configuration for assistants with separate project and home paths
 */
export interface AssistantPathConfig {
  /** Project-local skills path */
  project: string;
  /** Home/global skills path */
  home: string;
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
  /** Name of the first platform (e.g., 'claude') */
  platformA: string;
  /** Name of the second platform (e.g., 'codex') */
  platformB: string;
  /** Path to first platform's version of the skill */
  pathA: string;
  /** Path to second platform's version of the skill */
  pathB: string;
  /** Hash of first platform's skill content */
  hashA: string;
  /** Hash of second platform's skill content */
  hashB: string;
  /** First platform's skill content for diff display */
  contentA?: string;
  /** Second platform's skill content for diff display */
  contentB?: string;
  /** Type of conflict: 'content' for full content, 'frontmatter' for metadata only */
  conflictType?: 'content' | 'frontmatter';
}

/**
 * User resolution for a conflict
 */
export interface ConflictResolution {
  /** Action to take */
  action: 'abort' | 'use-a' | 'use-b' | 'keep-both';
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
export const ASSISTANT_MAP: Record<string, string | AssistantPathConfig> = {
  'claude': '.claude/skills',
  'codex': '.codex/skills',
  'kilo': '.kilocode/skills',
  'cursor': '.cursor/skills',
  'windsurf': { project: '.windsurf/skills', home: '.codeium/windsurf/skills' },
  'gemini': '.gemini/skills',
  'cline': '.cline/skills',
  'roo': '.roo/skills',
  'opencode': { project: '.opencode/skill', home: '.config/opencode/skill' },
};

/**
 * Get AssistantConfig[] from assistant names
 * @param names - Optional array of assistant names. If omitted, returns all.
 * @param homeMode - If true, use home paths; if false, use project paths (default: false)
 * @returns Array of AssistantConfig objects for valid assistant names only
 */
export function getAssistantConfigs(names?: string[], homeMode: boolean = false): AssistantConfig[] {
  const requested = names || Object.keys(ASSISTANT_MAP);
  const valid: AssistantConfig[] = [];
  const invalid: string[] = [];

  for (const name of requested) {
    if (name in ASSISTANT_MAP) {
      const config = ASSISTANT_MAP[name];

      // Handle both string and AssistantPathConfig types
      let skillsPath: string;
      if (typeof config === 'string') {
        skillsPath = config;
      } else {
        // AssistantPathConfig: use project or home path based on mode
        skillsPath = homeMode ? config.home : config.project;
      }

      // Extract the folder name (first path segment)
      const folder = skillsPath.split('/')[0];

      const assistantConfig: AssistantConfig = {
        name,
        dir: folder,
        skillsDir: skillsPath
      };

      // Add home properties if in home mode and config has home path
      if (homeMode && typeof config === 'object') {
        const homeFolder = config.home.split('/')[0];
        assistantConfig.homeDir = homeFolder;
        assistantConfig.homeSkillsDir = config.home;
      }

      valid.push(assistantConfig);
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
