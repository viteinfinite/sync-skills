import type { AssistantConfig, AssistantState, SkillFile, SyncPair } from './types.js';
import type { VerboseLogger } from './logger.js';
/**
 * Discover the state of configured assistants
 * @param baseDir - Base directory to scan
 * @param configs - Assistant configs to discover (defaults to all)
 */
export declare function discoverAssistants(baseDir: string, configs?: AssistantConfig[]): Promise<AssistantState[]>;
/**
 * Find all sync pairs where source has skills and target doesn't
 */
export declare function findSyncPairs(states: AssistantState[]): SyncPair[];
/**
 * Process all sync pairs with appropriate prompts
 */
export declare function processSyncPairs(baseDir: string, pairs: SyncPair[], logger?: VerboseLogger): Promise<Set<string>>;
/**
 * Sync skills that exist only in .sync-skills to enabled platforms
 * Creates @ references in platform folders for common-only skills
 */
export declare function syncCommonOnlySkills(baseDir: string, commonSkills: SkillFile[], enabledConfigs: AssistantConfig[], blockedAssistants?: Set<string>, logger?: VerboseLogger): Promise<void>;
//# sourceMappingURL=assistants.d.ts.map