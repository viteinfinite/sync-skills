import type { AssistantConfig, AssistantState, SkillFile, SyncPair } from './types.js';
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
 * Check if a sync pair needs user prompt (target dir doesn't exist)
 */
export declare function needsPrompt(pair: SyncPair): boolean;
/**
 * Prompt user for sync permission
 */
export declare function promptForSync(targetName: string): Promise<boolean>;
/**
 * Clone skills from source assistant to target assistant
 */
export declare function cloneAssistantSkills(baseDir: string, sourceSkills: SkillFile[], targetConfig: AssistantConfig): Promise<void>;
/**
 * Process all sync pairs with appropriate prompts
 */
export declare function processSyncPairs(baseDir: string, pairs: SyncPair[], dryRun: boolean): Promise<void>;
//# sourceMappingURL=assistants.d.ts.map