import { promises as fs } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts, detectOutOfSyncSkills } from './detector.js';
import { resolveConflict, resolveDependentConflicts, resolveOutOfSyncSkill, resolveOutOfSyncSkills } from './resolver.js';
import { refactorSkill, copySkill, computeSkillHash, updateMainHash, writePlatformReference } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { discoverAssistants, findSyncPairs, processSyncPairs, syncCommonOnlySkills } from './assistants.js';
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
import { normalizeBodyContent, pickCoreFrontmatter } from './frontmatter.js';
import { collectDependentFilesFromPlatforms, consolidateDependentsToCommon, cleanupPlatformDependentFiles, applyConflictResolutions } from './dependents.js';
import { getAssistantConfigs } from './types.js';
export async function run(options = {}) {
    let { baseDir = process.cwd(), failOnConflict = false, homeMode = false, reconfigure = false } = options;
    // Handle --home flag
    if (homeMode) {
        if (!process.env.HOME) {
            throw new Error('HOME environment variable not set');
        }
        baseDir = process.env.HOME;
        console.log(`Using home directory: ${baseDir}`);
    }
    // Handle --reconfigure flag
    if (reconfigure) {
        await runReconfigure(baseDir);
    }
    const preConfigScan = await scanSkills(baseDir, getAssistantConfigs(undefined, homeMode));
    const anyInitialSkills = Object.values(preConfigScan.platforms).some(skills => skills.length > 0);
    const hasInitialCommonSkills = preConfigScan.common.length > 0;
    if (!anyInitialSkills && !hasInitialCommonSkills) {
        console.log('No skills found. Exiting.');
        return;
    }
    // Ensure config exists
    const config = await ensureConfig(baseDir);
    // Phase 1: Get enabled assistants and find sync pairs
    const enabledConfigs = getEnabledAssistants(config, homeMode);
    const states = await discoverAssistants(baseDir, enabledConfigs);
    const syncPairs = findSyncPairs(states);
    // Phase 2: Process sync pairs (bidirectional)
    const blockedAssistants = await processSyncPairs(baseDir, syncPairs);
    const activeConfigs = enabledConfigs.filter(config => !blockedAssistants.has(config.name));
    const activeStates = states.filter(state => activeConfigs.some(config => config.name === state.config.name));
    // Re-scan after sync to get updated state (including common skills)
    let { platforms, common } = await scanSkills(baseDir, activeConfigs);
    // Phase 2.5: Sync skills that exist only in .agents-common to enabled platforms
    await syncCommonOnlySkills(baseDir, common.map(c => ({ path: c.path, skillName: c.skillName })), activeConfigs, blockedAssistants);
    // Phase 3: Refactor platform skills that don't have @ references
    for (const config of activeConfigs) {
        const platformSkills = platforms[config.name] || [];
        for (const skill of platformSkills) {
            const content = await fs.readFile(skill.path, 'utf8');
            const parsed = parseSkillFile(content);
            if (parsed && !parsed.hasAtReference) {
                const metadata = parsed.data?.metadata &&
                    typeof parsed.data.metadata === 'object' &&
                    !Array.isArray(parsed.data.metadata)
                    ? parsed.data.metadata
                    : undefined;
                const sync = metadata?.sync && typeof metadata.sync === 'object' && !Array.isArray(metadata.sync)
                    ? metadata.sync
                    : undefined;
                const storedHash = sync?.hash;
                const hasCommonSkill = common.some(c => c.skillName === skill.skillName);
                if (storedHash && hasCommonSkill) {
                    continue;
                }
                const commonPath = await refactorSkill(skill.path);
                if (commonPath) {
                    await propagateFrontmatter(commonPath, [skill.path], { failOnConflict });
                }
            }
        }
    }
    // Re-scan after refactor to capture new common skills and updated platform state
    ({ platforms, common } = await scanSkills(baseDir, activeConfigs));
    // Phase 2.75: Detect out-of-sync platform skills (pairwise with common)
    // Collect all platform skills to check for out-of-sync, grouped by platform
    const outOfSyncSkills = [];
    for (const config of activeConfigs) {
        const platformSkills = platforms[config.name] || [];
        const platformOutOfSync = await detectOutOfSyncSkills(platformSkills, common, config.name);
        outOfSyncSkills.push(...platformOutOfSync);
    }
    if (outOfSyncSkills.length > 0) {
        if (failOnConflict) {
            const skillNames = [...new Set(outOfSyncSkills.map(skill => skill.skillName))];
            throw new Error(`Out-of-sync skills detected: ${skillNames.join(', ')}`);
        }
        const outOfSyncBySkill = new Map();
        for (const skill of outOfSyncSkills) {
            const group = outOfSyncBySkill.get(skill.skillName) || [];
            group.push(skill);
            outOfSyncBySkill.set(skill.skillName, group);
        }
        for (const [skillName, group] of outOfSyncBySkill.entries()) {
            const isMultiPlatform = group.length > 1;
            const representative = group[0];
            if (!representative) {
                continue;
            }
            const promptSkill = {
                ...representative,
                platform: isMultiPlatform ? 'multiple' : representative.platform,
                allowKeepPlatform: !isMultiPlatform
            };
            const resolution = isMultiPlatform
                ? await resolveOutOfSyncSkill(promptSkill)
                : (await resolveOutOfSyncSkills([promptSkill]))[0];
            if (resolution.action === 'abort') {
                throw new Error('Sync aborted');
            }
            const commonSkill = common.find(c => c.skillName === skillName);
            if (!commonSkill) {
                console.warn(`Warning: Common skill not found for ${skillName}`);
                continue;
            }
            if (resolution.action === 'keep-platform') {
                // Keep platform version - update common from platform
                const platformContent = await fs.readFile(representative.platformPath, 'utf8');
                const platformParsed = matter(platformContent);
                const commonContent = await fs.readFile(commonSkill.path, 'utf8');
                const commonParsed = matter(commonContent);
                // Extract core frontmatter from platform
                const platformCore = pickCoreFrontmatter(platformParsed.data);
                // Use platform body for body conflicts, otherwise keep common body
                const commonBody = normalizeBodyContent(commonParsed.content);
                const platformBody = normalizeBodyContent(platformParsed.content);
                const usePlatformBody = representative.mismatchType === 'body' || representative.mismatchType === 'both';
                const nextBody = usePlatformBody ? platformBody : commonBody;
                // Recompute hash with platform core frontmatter and chosen body
                const newHash = computeSkillHash(platformCore, nextBody, []);
                const commonMetadata = commonParsed.data?.metadata &&
                    typeof commonParsed.data.metadata === 'object' &&
                    !Array.isArray(commonParsed.data.metadata)
                    ? commonParsed.data.metadata
                    : undefined;
                const commonSync = commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)
                    ? commonMetadata.sync
                    : undefined;
                // Update common skill with platform frontmatter
                const newCommonFrontmatter = {
                    ...platformCore,
                    metadata: {
                        ...(platformCore.metadata || {}),
                        sync: {
                            ...(commonSync?.version !== undefined ? { version: commonSync.version } : {}),
                            hash: newHash
                        }
                    }
                };
                const newCommonContent = matter.stringify(nextBody, newCommonFrontmatter);
                await fs.writeFile(commonSkill.path, newCommonContent);
                console.log(`Applied ${representative.platform} changes to common skill: ${skillName}`);
                // Propagate updated common skill frontmatter to all platforms
                const platformPaths = [];
                for (const config of activeConfigs) {
                    const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
                    try {
                        await fs.access(platformSkillPath);
                        platformPaths.push(platformSkillPath);
                    }
                    catch {
                        // Platform skill doesn't exist, skip
                    }
                }
                if (platformPaths.length > 0) {
                    if (usePlatformBody) {
                        for (const platformPath of platformPaths) {
                            await writePlatformReference(platformPath, commonSkill.path);
                        }
                    }
                    else {
                        await propagateFrontmatter(commonSkill.path, platformPaths, {
                            failOnConflict,
                            resolver: async () => 'common'
                        });
                    }
                }
            }
            else if (resolution.action === 'keep-common') {
                // Keep common version - overwrite platform(s) with @ reference
                const targets = isMultiPlatform ? group : [representative];
                for (const target of targets) {
                    console.log(`Kept common version for ${skillName} (discarding ${target.platform} changes)`);
                    await writePlatformReference(target.platformPath, commonSkill.path);
                }
            }
        }
    }
    // Phase 4: Detect and resolve conflicts (between first two platforms for now)
    const platformNames = Object.keys(platforms);
    const platformA = platformNames[0] || 'claude';
    const platformB = platformNames[1] || 'codex';
    const conflicts = await detectConflicts(platforms[platformA] || [], platforms[platformB] || [], platformA, platformB);
    if (conflicts.length > 0) {
        if (failOnConflict) {
            throw new Error(`Conflict detected in: ${conflicts.map(c => c.skillName).join(', ')}`);
        }
        // Interactive resolution
        for (const conflict of conflicts) {
            const commonSkill = common.find(c => c.skillName === conflict.skillName);
            let allowUseA = true;
            let allowUseB = true;
            if (commonSkill &&
                conflict.conflictType === 'content' &&
                conflict.contentA &&
                conflict.contentB) {
                const commonContent = await fs.readFile(commonSkill.path, 'utf8');
                const commonParsed = matter(commonContent);
                const commonMetadata = commonParsed.data?.metadata &&
                    typeof commonParsed.data.metadata === 'object' &&
                    !Array.isArray(commonParsed.data.metadata)
                    ? commonParsed.data.metadata
                    : undefined;
                const commonSync = commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)
                    ? commonMetadata.sync
                    : undefined;
                const commonHash = commonSync?.hash;
                const expectedRef = `@.agents-common/skills/${conflict.skillName}/SKILL.md`;
                const isSyncedToCommon = (content) => {
                    const parsed = matter(content);
                    const ref = parsed.content.trim();
                    if (ref !== expectedRef) {
                        return false;
                    }
                    const metadata = parsed.data?.metadata && typeof parsed.data.metadata === 'object' && !Array.isArray(parsed.data.metadata)
                        ? parsed.data.metadata
                        : undefined;
                    const sync = metadata?.sync && typeof metadata.sync === 'object' && !Array.isArray(metadata.sync)
                        ? metadata.sync
                        : undefined;
                    if (!commonHash) {
                        return true;
                    }
                    if (!sync?.hash) {
                        return true;
                    }
                    return sync.hash === commonHash;
                };
                const syncedA = isSyncedToCommon(conflict.contentA);
                const syncedB = isSyncedToCommon(conflict.contentB);
                if (syncedA !== syncedB) {
                    allowUseA = !syncedA;
                    allowUseB = !syncedB;
                }
            }
            const resolution = await resolveConflict(conflict, undefined, {
                allowUseA,
                allowUseB,
                allowUseCommon: Boolean(commonSkill)
            });
            if (resolution.action === 'abort') {
                throw new Error('Sync aborted');
            }
            if (resolution.action === 'use-a') {
                await copySkill(conflict.pathA, conflict.pathB);
            }
            else if (resolution.action === 'use-b') {
                await copySkill(conflict.pathB, conflict.pathA);
            }
            else if (resolution.action === 'use-common' && commonSkill) {
                await writePlatformReference(conflict.pathA, commonSkill.path);
                await writePlatformReference(conflict.pathB, commonSkill.path);
            }
            // Propagate frontmatter from common to both targets after conflict resolution
            const commonPath = join(baseDir, '.agents-common/skills', conflict.skillName, 'SKILL.md');
            await propagateFrontmatter(commonPath, [conflict.pathA, conflict.pathB], { failOnConflict });
        }
    }
    // Phase 5: Propagate frontmatter from common skills to all platforms
    for (const commonSkill of common) {
        const targetPaths = [];
        for (const config of activeConfigs) {
            const platformSkillPath = join(baseDir, config.skillsDir, commonSkill.skillName, 'SKILL.md');
            try {
                await fs.access(platformSkillPath);
                targetPaths.push(platformSkillPath);
            }
            catch {
                // Platform skill doesn't exist, skip
            }
        }
        if (targetPaths.length > 0) {
            await propagateFrontmatter(commonSkill.path, targetPaths, { failOnConflict });
        }
    }
    // Phase 6: Sync dependent files
    const commonSkillsPath = join(baseDir, '.agents-common/skills');
    // Collect all skill names from all platforms
    const allSkillNames = new Set();
    for (const state of activeStates) {
        if (state.hasSkills) {
            for (const skill of state.skills) {
                allSkillNames.add(skill.skillName);
            }
        }
    }
    // Process each skill's dependent files
    for (const skillName of allSkillNames) {
        // Collect platform paths for enabled assistants
        const platformPaths = activeConfigs.map((config) => ({
            name: config.name,
            path: join(baseDir, config.skillsDir)
        }));
        // Collect dependent files from all platforms
        const platformFiles = await collectDependentFilesFromPlatforms(skillName, platformPaths);
        if (platformFiles.size === 0) {
            // No dependent files to sync
            continue;
        }
        // Consolidate dependent files to common (detects conflicts)
        const { conflicts, files: initialFiles } = await consolidateDependentsToCommon(skillName, platformFiles, commonSkillsPath);
        let finalFiles = initialFiles;
        // Resolve conflicts if any
        if (conflicts.length > 0) {
            if (failOnConflict) {
                throw new Error(`Dependent file conflict in: ${skillName}`);
            }
            // Interactive resolution
            const resolutions = await resolveDependentConflicts(conflicts);
            // Check if user aborted
            const hasAbort = Array.from(resolutions.values()).some(r => r.action === 'abort');
            if (hasAbort) {
                throw new Error('Sync aborted');
            }
            // Apply resolutions and get final files
            const resolvedFiles = await applyConflictResolutions(conflicts, resolutions, commonSkillsPath);
            // Merge resolved files with initial files
            finalFiles = [...new Set([...initialFiles, ...resolvedFiles])];
        }
        // Recompute main hash with new dependent files and propagate to all platforms
        try {
            // Skip hash recomputation if no dependent files (hash won't change)
            if (finalFiles.length === 0) {
                continue;
            }
            const commonSkillPath = join(commonSkillsPath, skillName);
            const commonFilePath = join(commonSkillPath, 'SKILL.md');
            const commonContent = await fs.readFile(commonFilePath, 'utf8');
            const commonParsed = matter(commonContent);
            // Extract core frontmatter fields
            const coreFrontmatter = pickCoreFrontmatter(commonParsed.data);
            // Normalize body content (strip leading newline like in refactorSkill)
            const bodyContent = normalizeBodyContent(commonParsed.content);
            // Scan common folder for dependent files and compute their hashes
            const dependentFiles = [];
            for (const relativePath of finalFiles) {
                const absolutePath = join(commonSkillPath, relativePath);
                try {
                    const { computeFileHash } = await import('./dependents.js');
                    const hash = await computeFileHash(absolutePath);
                    dependentFiles.push({ path: relativePath, hash });
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.warn(`Warning: Failed to compute hash for ${relativePath}: ${errorMessage}`);
                }
            }
            // Recompute hash with new dependent files
            const newHash = computeSkillHash(coreFrontmatter, bodyContent, dependentFiles);
            // Update hash in common file
            await updateMainHash(commonFilePath, newHash);
            // Propagate to all enabled platforms
            const platformPaths = [];
            for (const config of activeConfigs) {
                const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
                try {
                    await fs.access(platformSkillPath);
                    platformPaths.push(platformSkillPath);
                }
                catch {
                    // Platform skill doesn't exist, skip
                }
            }
            if (platformPaths.length > 0) {
                await propagateFrontmatter(commonFilePath, platformPaths, { failOnConflict });
            }
            // Clean up dependent files from platform folders
            // Only cleanup files that were consolidated/resolved to common
            const cleanedFiles = new Set();
            const filesToKeep = new Set(finalFiles);
            for (const [platformName, files] of platformFiles.entries()) {
                const filesToCleanup = files
                    .map(f => f.relativePath)
                    .filter(relativePath => filesToKeep.has(relativePath));
                if (filesToCleanup.length > 0) {
                    const platformConfig = activeConfigs.find(c => c.name === platformName);
                    if (platformConfig) {
                        const platformSkillsPath = join(baseDir, platformConfig.skillsDir);
                        try {
                            await cleanupPlatformDependentFiles(platformSkillsPath, skillName, filesToCleanup, cleanedFiles);
                        }
                        catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            console.warn(`Warning: Failed to cleanup ${platformConfig.name} dependent files for ${skillName}: ${errorMessage}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Warning: Failed to recompute and propagate hash for ${skillName}: ${errorMessage}`);
        }
    }
    console.log('Sync complete');
}
//# sourceMappingURL=index.js.map