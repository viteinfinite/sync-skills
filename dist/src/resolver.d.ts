import inquirer from 'inquirer';
import type { Conflict, ConflictResolution, DependentConflict, DependentConflictResolution } from './types.js';
type InquirerImpl = typeof inquirer;
export declare function resolveConflict(conflict: Conflict, inquirerImpl?: InquirerImpl): Promise<ConflictResolution>;
/**
 * Resolve a dependent file conflict through user interaction
 * @param conflict - The dependent file conflict to resolve
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Resolution action
 */
export declare function resolveDependentConflict(conflict: DependentConflict, inquirerImpl?: InquirerImpl): Promise<DependentConflictResolution>;
/**
 * Batch resolve multiple dependent file conflicts
 * @param conflicts - Array of dependent file conflicts
 * @param inquirerImpl - Inquirer implementation (for testing)
 * @returns Map of file paths to their resolutions
 */
export declare function resolveDependentConflicts(conflicts: DependentConflict[], inquirerImpl?: InquirerImpl): Promise<Map<string, DependentConflictResolution>>;
export {};
//# sourceMappingURL=resolver.d.ts.map