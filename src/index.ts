import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import matter from 'gray-matter';
import chalk from 'chalk';
import { scanSkills } from './scanner.js';
import type { WalkDirResult, IgnoredSkill } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts, detectOutOfSyncSkills } from './detector.js';
import { resolveConflict, resolveDependentConflicts, resolveOutOfSyncSkill, resolveOutOfSyncSkills } from './resolver.js';
import { refactorSkill, copySkill, computeSkillHash, updateMainHash, writePlatformReference } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { discoverAssistants, findSyncPairs, processSyncPairs, syncCommonOnlySkills } from './assistants.js';
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
import { normalizeBodyContent, pickCoreFrontmatter } from './frontmatter.js';
import { buildCommonSkillReference, extractAtReference, isReferenceToPath, isReferenceToSkill } from './references.js';
import {
  collectDependentFilesFromPlatforms,
  consolidateDependentsToCommon,
  cleanupPlatformDependentFiles,
  applyConflictResolutions
} from './dependents.js';
import { getAssistantConfigs } from './types.js';
import type { RunOptions, AssistantConfig, SkillFile, OutOfSyncSkill } from './types.js';
import { VerboseLogger } from './logger.js';
import { COMMON_SKILLS_DIR } from './constants.js';

export async function run(options: RunOptions = {}): Promise<void> {
  let {
    baseDir = process.cwd(),
    failOnConflict = false,
    homeMode = false,
    reconfigure = false,
    listMode = false,
    verbose = false
  } = options;
  const logger = new VerboseLogger(verbose);
  let syncCompleted = false;
  try {

  // Handle --home flag
  if (homeMode) {
    if (!process.env.HOME) {
      throw new Error('HOME environment variable not set');
    }
    baseDir = process.env.HOME;
    console.log(chalk.cyanBright(`Using home directory: ${baseDir}`));
  }

  // Handle --list mode
  if (listMode) {
    logger.decision({ phase: 'list', action: 'list-mode-start' });
    await listSkills(baseDir, homeMode);
    logger.decision({ phase: 'list', action: 'list-mode-complete' });
    return;
  }

  // Handle --reconfigure flag
  if (reconfigure) {
    logger.decision({ phase: 'config', action: 'reconfigure-start' });
    await runReconfigure(baseDir, homeMode);
    logger.decision({ phase: 'config', action: 'reconfigure-complete' });
  }

  const preConfigScan = await scanSkills(baseDir, getAssistantConfigs(undefined, homeMode));
  logIgnoredSymlinkedSkills(preConfigScan.ignored);
  const anyInitialSkills = Object.values(preConfigScan.platforms).some(skills => skills.length > 0);
  const hasInitialCommonSkills = preConfigScan.common.length > 0;
  if (!anyInitialSkills && !hasInitialCommonSkills) {
    console.log(chalk.yellowBright('No skills found. Exiting.'));
    logger.decision({ phase: 'scan', action: 'exit-no-skills' });
    return;
  }

  // Ensure config exists
  const config = await ensureConfig(baseDir, homeMode);
  logger.decision({ phase: 'config', action: 'config-ready' });

  // Phase 1: Get enabled assistants and find sync pairs
  const enabledConfigs = getEnabledAssistants(config, homeMode);
  const states = await discoverAssistants(baseDir, enabledConfigs);
  const syncPairs = findSyncPairs(states);
  logger.decision({
    phase: 'sync-pairs',
    action: 'pairs-detected',
    result: `${syncPairs.length}`
  });

  // Phase 2: Process sync pairs (bidirectional)
  const blockedAssistants = await processSyncPairs(baseDir, syncPairs, logger);
  const activeConfigs = enabledConfigs.filter(config => !blockedAssistants.has(config.name));
  const activeStates = states.filter(state => activeConfigs.some(config => config.name === state.config.name));

  // Re-scan after sync to get updated state (including common skills)
  let { platforms, common } = await scanSkills(baseDir, activeConfigs);

  // Phase 2.5: Sync skills that exist only in .sync-skills to enabled platforms
  await syncCommonOnlySkills(
    baseDir,
    common.map(c => ({ path: c.path, skillName: c.skillName })),
    activeConfigs,
    blockedAssistants,
    logger
  );
  logger.decision({ phase: 'sync-common-only', action: 'sync-complete' });

  // Phase 3: Refactor platform skills that don't have @ references
  const refactoredSkillPaths = new Set<string>();
  for (const config of activeConfigs) {
    const platformSkills = platforms[config.name] || [];
    for (const skill of platformSkills) {
      const content = await fs.readFile(skill.path, 'utf8');
      const parsed = parseSkillFile(content);
      if (parsed && !parsed.hasAtReference) {
        const metadata =
          parsed.data?.metadata &&
          typeof parsed.data.metadata === 'object' &&
          !Array.isArray(parsed.data.metadata)
            ? parsed.data.metadata as Record<string, unknown>
            : undefined;
        const sync =
          metadata?.sync && typeof metadata.sync === 'object' && !Array.isArray(metadata.sync)
            ? metadata.sync as Record<string, unknown>
            : undefined;
        const storedHash = sync?.hash;
        const hasCommonSkill = common.some(c => c.skillName === skill.skillName);

        if (storedHash && hasCommonSkill) {
          continue;
        }

        const commonPath = await refactorSkill(skill.path);
        if (commonPath) {
          refactoredSkillPaths.add(skill.path);
          logger.skillOperation({
            phase: 'refactor',
            action: 'create',
            reason: 'refactor-to-common',
            skill: skill.skillName,
            path: commonPath
          });
          logger.skillOperation({
            phase: 'refactor',
            action: 'rewrite',
            reason: 'replace-platform-with-reference',
            skill: skill.skillName,
            platform: config.name,
            path: skill.path
          });
          await propagateFrontmatter(commonPath, [skill.path], { failOnConflict });
        }
      }
    }
  }

  // Re-scan after refactor to capture new common skills and updated platform state
  ({ platforms, common } = await scanSkills(baseDir, activeConfigs));

  // Phase 2.75: Detect out-of-sync platform skills (pairwise with common)
  // Collect all platform skills to check for out-of-sync, grouped by platform
  const outOfSyncSkills: OutOfSyncSkill[] = [];
  for (const config of activeConfigs) {
    const platformSkills = platforms[config.name] || [];
    // Skip brand-new refactors in this run to avoid transient mismatch detection.
    const skillsToCheck = platformSkills.filter(skill => !refactoredSkillPaths.has(skill.path));
    const platformOutOfSync = await detectOutOfSyncSkills(skillsToCheck, common, config.name);
    outOfSyncSkills.push(...platformOutOfSync);
  }

  if (outOfSyncSkills.length > 0) {
    logger.decision({
      phase: 'out-of-sync',
      action: 'detected',
      result: `${outOfSyncSkills.length}`
    });
    if (failOnConflict) {
      const skillNames = [...new Set(outOfSyncSkills.map(skill => skill.skillName))];
      throw new Error(`Out-of-sync skills detected: ${skillNames.join(', ')}`);
    }

    const outOfSyncBySkill = new Map<string, OutOfSyncSkill[]>();
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

      const promptSkill: OutOfSyncSkill = {
        ...representative,
        platform: isMultiPlatform ? 'multiple' : representative.platform,
        allowKeepPlatform: !isMultiPlatform
      };

      const resolution = isMultiPlatform
        ? await resolveOutOfSyncSkill(promptSkill)
        : (await resolveOutOfSyncSkills([promptSkill]))[0];

      if (resolution.action === 'abort') {
        logger.decision({
          phase: 'out-of-sync',
          action: 'abort',
          reason: 'user-selected-abort',
          skill: skillName
        });
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
        const platformCore = pickCoreFrontmatter(platformParsed.data as Record<string, unknown>);

        // Use platform body for body conflicts, otherwise keep common body
        const commonBody = normalizeBodyContent(commonParsed.content);
        const platformBody = normalizeBodyContent(platformParsed.content);
        const usePlatformBody =
          representative.mismatchType === 'body' || representative.mismatchType === 'both';
        const nextBody = usePlatformBody ? platformBody : commonBody;

        // Recompute hash with platform core frontmatter and chosen body
        const newHash = computeSkillHash(platformCore, nextBody, []);

        const commonMetadata =
          commonParsed.data?.metadata &&
          typeof commonParsed.data.metadata === 'object' &&
          !Array.isArray(commonParsed.data.metadata)
            ? commonParsed.data.metadata as Record<string, unknown>
            : undefined;
        const commonSync =
          commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)
            ? commonMetadata.sync as Record<string, unknown>
            : undefined;

        // Update common skill with platform frontmatter
        const newCommonFrontmatter = {
          ...platformCore,
          metadata: {
            ...(platformCore.metadata as Record<string, unknown> || {}),
            sync: {
              ...(commonSync?.version !== undefined ? { version: commonSync.version } : {}),
              hash: newHash
            }
          }
        };

        const newCommonContent = matter.stringify(nextBody, newCommonFrontmatter);
        await fs.writeFile(commonSkill.path, newCommonContent);
        logger.skillOperation({
          phase: 'out-of-sync',
          action: 'rewrite',
          reason: 'keep-platform-update-common',
          skill: skillName,
          path: commonSkill.path
        });

        console.log(chalk.green(`Applied ${representative.platform} changes to common skill: ${skillName}`));

        // Propagate updated common skill frontmatter to all platforms
        const platformPaths: string[] = [];
        for (const config of activeConfigs) {
          const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
          try {
            await fs.access(platformSkillPath);
            platformPaths.push(platformSkillPath);
          } catch {
            // Platform skill doesn't exist, skip
          }
        }

        if (platformPaths.length > 0) {
          if (usePlatformBody) {
            for (const platformPath of platformPaths) {
              await writePlatformReference(platformPath, commonSkill.path);
              logger.skillOperation({
                phase: 'out-of-sync',
                action: 'rewrite',
                reason: 'propagate-common-reference',
                skill: skillName,
                path: platformPath
              });
            }
          } else {
            await propagateFrontmatter(commonSkill.path, platformPaths, {
              failOnConflict,
              resolver: async () => 'common'
            });
            for (const platformPath of platformPaths) {
              logger.skillOperation({
                phase: 'out-of-sync',
                action: 'rewrite',
                reason: 'propagate-frontmatter',
                skill: skillName,
                path: platformPath
              });
            }
          }
        }
      } else if (resolution.action === 'keep-common') {
        // Keep common version - overwrite platform(s) with @ reference
        const targets = isMultiPlatform ? group : [representative];
        for (const target of targets) {
          console.log(chalk.green(`Kept common version for ${skillName} (discarding ${target.platform} changes)`));
          await writePlatformReference(target.platformPath, commonSkill.path);
          logger.skillOperation({
            phase: 'out-of-sync',
            action: 'rewrite',
            reason: 'keep-common-overwrite-platform',
            skill: skillName,
            platform: target.platform,
            path: target.platformPath
          });
        }
      }
    }
  }

  // Phase 4: Detect and resolve conflicts (between first two platforms for now)
  const platformNames = Object.keys(platforms);
  const platformA = platformNames[0] || 'claude';
  const platformB = platformNames[1] || 'codex';
  const conflicts = await detectConflicts(
    platforms[platformA] || [],
    platforms[platformB] || [],
    platformA,
    platformB
  );
  logger.decision({
    phase: 'conflict-detection',
    action: 'detected',
    result: `${conflicts.length}`
  });

  if (conflicts.length > 0) {
    if (failOnConflict) {
      throw new Error(`Conflict detected in: ${conflicts.map(c => c.skillName).join(', ')}`);
    }

    // Interactive resolution
  for (const conflict of conflicts) {
      const commonSkill = common.find(c => c.skillName === conflict.skillName);
      let allowUseA = true;
      let allowUseB = true;

      if (
        commonSkill &&
        conflict.conflictType === 'content' &&
        conflict.contentA &&
        conflict.contentB
      ) {
        const commonContent = await fs.readFile(commonSkill.path, 'utf8');
        const commonParsed = matter(commonContent);
        const commonMetadata =
          commonParsed.data?.metadata &&
          typeof commonParsed.data.metadata === 'object' &&
          !Array.isArray(commonParsed.data.metadata)
            ? commonParsed.data.metadata as Record<string, unknown>
            : undefined;
        const commonSync =
          commonMetadata?.sync && typeof commonMetadata.sync === 'object' && !Array.isArray(commonMetadata.sync)
            ? commonMetadata.sync as Record<string, unknown>
            : undefined;
        const commonHash = commonSync?.hash;
        const isSyncedToCommon = (content: string, platformPath: string): boolean => {
          const parsed = matter(content);
          const expectedRef = buildCommonSkillReference(platformPath, commonSkill.path);
          if (!isReferenceToPath(parsed.content, expectedRef)) {
            return false;
          }
          const metadata =
            parsed.data?.metadata && typeof parsed.data.metadata === 'object' && !Array.isArray(parsed.data.metadata)
              ? parsed.data.metadata as Record<string, unknown>
              : undefined;
          const sync =
            metadata?.sync && typeof metadata.sync === 'object' && !Array.isArray(metadata.sync)
              ? metadata.sync as Record<string, unknown>
              : undefined;
          if (!commonHash) {
            return true;
          }
          if (!sync?.hash) {
            return true;
          }
          return sync.hash === commonHash;
        };

        const syncedA = isSyncedToCommon(conflict.contentA, conflict.pathA);
        const syncedB = isSyncedToCommon(conflict.contentB, conflict.pathB);

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
        logger.decision({
          phase: 'conflict-resolution',
          action: 'abort',
          reason: 'user-selected-abort',
          skill: conflict.skillName
        });
        throw new Error('Sync aborted');
      }

      if (resolution.action === 'use-a') {
        await copySkill(conflict.pathA, conflict.pathB);
        logger.skillOperation({
          phase: 'conflict-resolution',
          action: 'copy',
          reason: 'conflict-resolution-use-a',
          skill: conflict.skillName,
          fromPath: conflict.pathA,
          toPath: conflict.pathB
        });
      } else if (resolution.action === 'use-b') {
        await copySkill(conflict.pathB, conflict.pathA);
        logger.skillOperation({
          phase: 'conflict-resolution',
          action: 'copy',
          reason: 'conflict-resolution-use-b',
          skill: conflict.skillName,
          fromPath: conflict.pathB,
          toPath: conflict.pathA
        });
      } else if (resolution.action === 'use-common' && commonSkill) {
        await writePlatformReference(conflict.pathA, commonSkill.path);
        await writePlatformReference(conflict.pathB, commonSkill.path);
        logger.skillOperation({
          phase: 'conflict-resolution',
          action: 'rewrite',
          reason: 'conflict-resolution-use-common',
          skill: conflict.skillName,
          path: conflict.pathA
        });
        logger.skillOperation({
          phase: 'conflict-resolution',
          action: 'rewrite',
          reason: 'conflict-resolution-use-common',
          skill: conflict.skillName,
          path: conflict.pathB
        });
      }

      // Propagate frontmatter from common to both targets after conflict resolution
      const commonPath = join(baseDir, COMMON_SKILLS_DIR, conflict.skillName, 'SKILL.md');
      await propagateFrontmatter(commonPath, [conflict.pathA, conflict.pathB], { failOnConflict });
      logger.skillOperation({
        phase: 'conflict-resolution',
        action: 'rewrite',
        reason: 'propagate-frontmatter',
        skill: conflict.skillName,
        path: conflict.pathA
      });
      logger.skillOperation({
        phase: 'conflict-resolution',
        action: 'rewrite',
        reason: 'propagate-frontmatter',
        skill: conflict.skillName,
        path: conflict.pathB
      });
    }
  }

  // Phase 5: Propagate frontmatter from common skills to all platforms
  for (const commonSkill of common) {
    const targetPaths: string[] = [];
    for (const config of activeConfigs) {
      const platformSkillPath = join(baseDir, config.skillsDir, commonSkill.skillName, 'SKILL.md');
      try {
        await fs.access(platformSkillPath);
        targetPaths.push(platformSkillPath);
      } catch {
        // Platform skill doesn't exist, skip
      }
    }

    if (targetPaths.length > 0) {
      await propagateFrontmatter(commonSkill.path, targetPaths, { failOnConflict });
      for (const targetPath of targetPaths) {
        logger.skillOperation({
          phase: 'frontmatter-propagation',
          action: 'rewrite',
          reason: 'propagate-frontmatter',
          skill: commonSkill.skillName,
          path: targetPath
        });
      }
    }
  }

  // Phase 6: Sync dependent files
  const commonSkillsPath = join(baseDir, COMMON_SKILLS_DIR);

  // Collect all skill names from all platforms
  const allSkillNames = new Set<string>();
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
    const platformPaths = activeConfigs.map((config): { name: string; path: string } => ({
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
    const { conflicts, files: initialFiles } = await consolidateDependentsToCommon(
      skillName,
      platformFiles,
      commonSkillsPath
    );
    logger.decision({
      phase: 'dependents',
      action: 'consolidate',
      reason: 'scan-platform-dependents',
      skill: skillName,
      result: `${initialFiles.length}`
    });

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
      const coreFrontmatter = pickCoreFrontmatter(commonParsed.data as Record<string, unknown>);

      // Normalize body content (strip leading newline like in refactorSkill)
      const bodyContent = normalizeBodyContent(commonParsed.content);

      // Scan common folder for dependent files and compute their hashes
      const dependentFiles: Array<{ path: string; hash: string }> = [];
      for (const relativePath of finalFiles) {
        const absolutePath = join(commonSkillPath, relativePath);
        try {
          const { computeFileHash } = await import('./dependents.js');
          const hash = await computeFileHash(absolutePath);
          dependentFiles.push({ path: relativePath, hash });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Warning: Failed to compute hash for ${relativePath}: ${errorMessage}`);
        }
      }

      // Recompute hash with new dependent files
      const newHash = computeSkillHash(coreFrontmatter, bodyContent, dependentFiles);

      // Update hash in common file
      await updateMainHash(commonFilePath, newHash);
      logger.skillOperation({
        phase: 'dependents',
        action: 'rewrite',
        reason: 'update-common-hash',
        skill: skillName,
        path: commonFilePath
      });

      // Propagate to all enabled platforms
      const platformPaths: string[] = [];
      for (const config of activeConfigs) {
        const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
        try {
          await fs.access(platformSkillPath);
          platformPaths.push(platformSkillPath);
        } catch {
          // Platform skill doesn't exist, skip
        }
      }

      if (platformPaths.length > 0) {
        await propagateFrontmatter(commonFilePath, platformPaths, { failOnConflict });
        for (const platformPath of platformPaths) {
          logger.skillOperation({
            phase: 'dependents',
            action: 'rewrite',
            reason: 'propagate-common-hash',
            skill: skillName,
            path: platformPath
          });
        }
      }

      // Clean up dependent files from platform folders
      // Only cleanup files that were consolidated/resolved to common
      const cleanedFiles = new Set<string>();
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
              await cleanupPlatformDependentFiles(
                platformSkillsPath,
                skillName,
                filesToCleanup,
                cleanedFiles
              );
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.warn(`Warning: Failed to cleanup ${platformConfig.name} dependent files for ${skillName}: ${errorMessage}`);
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to recompute and propagate hash for ${skillName}: ${errorMessage}`);
    }
  }

  syncCompleted = true;
  } finally {
    logger.printSummary();
    if (syncCompleted) {
      console.log(chalk.greenBright('Sync complete'));
    }
  }
}

/**
 * List all installed skills across platforms and common
 */
async function listSkills(baseDir: string, homeMode: boolean): Promise<void> {
  const { platforms, common, ignored } = await scanSkills(baseDir, getAssistantConfigs(undefined, homeMode));
  logIgnoredSymlinkedSkills(ignored);

  const groupedSkills = new Map<string, {
    name: string;
    description: string;
    sites: string[];
  }>();

  const processSkill = async (skill: WalkDirResult, site: string) => {
    try {
      const existing = groupedSkills.get(skill.skillName);
      if (existing) {
        existing.sites.push(site);
        // If we found a description in common, or already have one, keep it
        // unless this is common and we didn't have a common one before
        if (site === 'common' && !existing.description) {
          const content = await fs.readFile(skill.path, 'utf8');
          const parsed = parseSkillFile(content);
          existing.description = (parsed?.data?.description as string) || '';
        }
        return;
      }

      const content = await fs.readFile(skill.path, 'utf8');
      const parsed = parseSkillFile(content);
      let description = (parsed?.data?.description as string) || '';

      if (parsed?.hasAtReference && !description) {
        const refPath = extractAtReference(parsed.content);
        if (!refPath || !isReferenceToSkill(parsed.content, skill.skillName)) {
          // skip invalid references
        } else {
          const absoluteRefPath = resolve(dirname(skill.path), refPath);
        try {
          const refContent = await fs.readFile(absoluteRefPath, 'utf8');
          const refParsed = parseSkillFile(refContent);
          description = (refParsed?.data?.description as string) || '';
        } catch {
          // ignore reference read errors
        }
        }
      }

      groupedSkills.set(skill.skillName, {
        name: skill.skillName,
        description,
        sites: [site]
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: Failed to process skill at ${skill.path}: ${errorMessage}`);
    }
  };

  // Process common first to prioritize its description
  for (const skill of common) {
    await processSkill(skill, 'common');
  }

  // Process platforms
  for (const [site, skills] of Object.entries(platforms)) {
    for (const skill of skills) {
      await processSkill(skill, site);
    }
  }

  // Process ignored symlinked skills
  for (const skill of ignored) {
    const site = `${skill.agent} (unmanaged)`;
    const existing = groupedSkills.get(skill.skillName);
    if (existing) {
      if (!existing.sites.includes(site)) {
        existing.sites.push(site);
      }
      continue;
    }

    groupedSkills.set(skill.skillName, {
      name: skill.skillName,
      description: '',
      sites: [site]
    });
  }

  const allSkills = Array.from(groupedSkills.values());

  // Sort by name
  allSkills.sort((a, b) => a.name.localeCompare(b.name));

  if (allSkills.length === 0) {
    console.log(chalk.yellowBright('No skills found.'));
    return;
  }

  console.log(chalk.magentaBright('Installed skills:'));
  console.log('');

  const nameWidth = Math.max(20, ...allSkills.map(s => s.name.length));

  for (const s of allSkills) {
    // Sort sites: common first, then alphabetical
    s.sites.sort((a, b) => {
      if (a === 'common') return -1;
      if (b === 'common') return 1;
      return a.localeCompare(b);
    });

    const sitesStr = `[${s.sites.join(', ')}]`;
    const desc = s.description ? ` - ${s.description}` : '';
    const nameText = chalk.cyan(s.name.padEnd(nameWidth));
    const siteText = chalk.yellow(sitesStr);
    const descText = s.description ? chalk.gray(` - ${s.description}`) : '';
    console.log(`- ${nameText} ${siteText}${descText}`);
  }
}

function logIgnoredSymlinkedSkills(ignored: IgnoredSkill[]): void {
  if (!ignored.length) {
    return;
  }

  const seen = new Set<string>();
  for (const skill of ignored) {
    if (skill.reason !== 'symlinked') {
      continue;
    }
    if (seen.has(skill.skillName)) {
      continue;
    }
    seen.add(skill.skillName);
    console.log(chalk.yellowBright(`Ignored ${skill.skillName} because it was symlinked`));
  }
}
