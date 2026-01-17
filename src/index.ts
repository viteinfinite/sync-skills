import { promises as fs } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts } from './detector.js';
import { resolveConflict, resolveDependentConflicts } from './resolver.js';
import { refactorSkill, copySkill, computeSkillHash, updateMainHash } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { discoverAssistants, findSyncPairs, processSyncPairs, syncCommonOnlySkills } from './assistants.js';
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
import { CORE_FIELDS } from './constants.js';
import {
  collectDependentFilesFromPlatforms,
  consolidateDependentsToCommon,
  cleanupPlatformDependentFiles,
  getStoredHashes,
  storeFileHashesInFrontmatter,
  applyConflictResolutions
} from './dependents.js';
import type { RunOptions, AssistantConfig } from './types.js';

export async function run(options: RunOptions = {}): Promise<void> {
  let {
    baseDir = process.cwd(),
    failOnConflict = false,
    dryRun = false,
    homeMode = false,
    reconfigure = false
  } = options;

  // Handle --home flag
  if (homeMode) {
    if (!process.env.HOME) {
      console.error('Error: HOME environment variable not set');
      process.exit(1);
    }
    baseDir = process.env.HOME;
    console.log(`Using home directory: ${baseDir}`);
  }

  // Handle --reconfigure flag
  if (reconfigure) {
    await runReconfigure(baseDir);
    return;
  }

  // Ensure config exists
  const config = await ensureConfig(baseDir);

  // Phase 1: Get enabled assistants and find sync pairs
  const enabledConfigs = getEnabledAssistants(config, homeMode);
  const states = await discoverAssistants(baseDir, enabledConfigs);
  const syncPairs = findSyncPairs(states);

  // Also scan for common skills to check if any exist
  const initialScan = await scanSkills(baseDir);
  const hasCommonSkills = initialScan.common.length > 0;

  // If no assistants have skills AND no common skills exist, exit silently (Scenario 3)
  const anyHasSkills = states.some(s => s.hasSkills);
  if (!anyHasSkills && !hasCommonSkills) {
    console.log('No skills found. Exiting.');
    return;
  }

  // Phase 2: Process sync pairs (bidirectional)
  await processSyncPairs(baseDir, syncPairs, dryRun);

  // Re-scan after sync to get updated state (including common skills)
  let { platforms, common } = await scanSkills(baseDir, enabledConfigs);

  // Phase 2.5: Sync skills that exist only in .agents-common to enabled platforms
  await syncCommonOnlySkills(
    baseDir,
    common.map(c => ({ path: c.path, skillName: c.skillName })),
    enabledConfigs,
    dryRun
  );

  // Phase 3: Refactor platform skills that don't have @ references
  for (const config of enabledConfigs) {
    const platformSkills = platforms[config.name] || [];
    for (const skill of platformSkills) {
      const content = await fs.readFile(skill.path, 'utf8');
      const parsed = parseSkillFile(content);
      if (parsed && !parsed.hasAtReference) {
        if (!dryRun) {
          const commonPath = await refactorSkill(skill.path);
          if (commonPath) {
            await propagateFrontmatter(commonPath, [skill.path], { failOnConflict, dryRun });
          }
        }
      }
    }
  }

  // Re-scan after refactor to capture new common skills and updated platform state
  ({ platforms, common } = await scanSkills(baseDir, enabledConfigs));

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

  if (conflicts.length > 0) {
    if (failOnConflict) {
      console.error(`Conflict detected in: ${conflicts.map(c => c.skillName).join(', ')}`);
      process.exit(1);
    }

    // Interactive resolution
    for (const conflict of conflicts) {
      const resolution = await resolveConflict(conflict);

      if (resolution.action === 'abort') {
        console.log('Aborted');
        process.exit(0);
      }

      if (resolution.action === 'use-a' && !dryRun) {
        await copySkill(conflict.pathA, conflict.pathB);
      } else if (resolution.action === 'use-b' && !dryRun) {
        await copySkill(conflict.pathB, conflict.pathA);
      }

      // Propagate frontmatter from common to both targets after conflict resolution
      const commonPath = join(baseDir, '.agents-common/skills', conflict.skillName, 'SKILL.md');
      await propagateFrontmatter(commonPath, [conflict.pathA, conflict.pathB], { failOnConflict, dryRun });
    }
  }

  // Phase 5: Propagate frontmatter from common skills to all platforms
  for (const commonSkill of common) {
    const targetPaths: string[] = [];
    for (const config of enabledConfigs) {
      const platformSkillPath = join(baseDir, config.skillsDir, commonSkill.skillName, 'SKILL.md');
      try {
        await fs.access(platformSkillPath);
        targetPaths.push(platformSkillPath);
      } catch {
        // Platform skill doesn't exist, skip
      }
    }

    if (targetPaths.length > 0) {
      await propagateFrontmatter(commonSkill.path, targetPaths, { failOnConflict, dryRun });
    }
  }

  // Phase 6: Sync dependent files
  if (!dryRun) {
    const commonSkillsPath = join(baseDir, '.agents-common/skills');

    // Collect all skill names from all platforms
    const allSkillNames = new Set<string>();
    for (const state of states) {
      if (state.hasSkills) {
        for (const skill of state.skills) {
          allSkillNames.add(skill.skillName);
        }
      }
    }

    // Process each skill's dependent files
    for (const skillName of allSkillNames) {
      // Collect platform paths for enabled assistants
      const platformPaths = enabledConfigs.map((config): { name: string; path: string } => ({
        name: config.name,
        path: join(baseDir, config.skillsDir)
      }));

      // Collect dependent files from all platforms
      const platformFiles = await collectDependentFilesFromPlatforms(skillName, platformPaths);

      if (platformFiles.size === 0) {
        // No dependent files to sync
        continue;
      }

      // Get stored hashes from common skill
      const commonSkillPath = join(commonSkillsPath, skillName);
      const storedHashes = await getStoredHashes(commonSkillPath);

      // Consolidate dependent files to common (detects conflicts)
      const { conflicts, hashes: initialHashes } = await consolidateDependentsToCommon(
        skillName,
        platformFiles,
        commonSkillsPath,
        storedHashes
      );

      let finalHashes = initialHashes;

      // Resolve conflicts if any
      if (conflicts.length > 0) {
        if (failOnConflict) {
          console.error(`Dependent file conflict in: ${skillName}`);
          process.exit(1);
        }

        // Interactive resolution
        const resolutions = await resolveDependentConflicts(conflicts);

        // Check if user aborted
        const hasAbort = Array.from(resolutions.values()).some(r => r.action === 'abort');
        if (hasAbort) {
          console.log('Aborted');
          process.exit(0);
        }

        // Apply resolutions and get final hashes
        const resolvedHashes = await applyConflictResolutions(conflicts, resolutions, commonSkillsPath);

        // Merge resolved hashes with initial hashes
        finalHashes = { ...initialHashes, ...resolvedHashes };
      }

      // Update frontmatter with final hashes
      if (Object.keys(finalHashes).length > 0) {
        // Ensure SKILL.md exists in common (it should from earlier phases)
        try {
          await fs.access(join(commonSkillPath, 'SKILL.md'));
          await storeFileHashesInFrontmatter(commonSkillPath, finalHashes);
        } catch {
          // SKILL.md doesn't exist in common - this shouldn't happen if earlier phases worked
          console.warn(`Warning: SKILL.md not found in common for ${skillName}, skipping hash storage`);
        }
      }

      // Recompute main hash with new dependent files and propagate to all platforms
      try {
        // Skip hash recomputation if no dependent files (hash won't change)
        if (Object.keys(finalHashes).length === 0) {
          continue;
        }

        const commonFilePath = join(commonSkillPath, 'SKILL.md');
        const commonContent = await fs.readFile(commonFilePath, 'utf8');
        const commonParsed = matter(commonContent);

        // Extract core frontmatter fields
        const coreFrontmatter: Record<string, unknown> = {};
        for (const field of CORE_FIELDS) {
          if (commonParsed.data[field]) {
            coreFrontmatter[field] = commonParsed.data[field];
          }
        }

        // Normalize body content (strip leading newline like in refactorSkill)
        const bodyContent = commonParsed.content.startsWith('\n')
          ? commonParsed.content.slice(1)
          : commonParsed.content;

        // Build dependent files array from finalHashes
        const dependentFiles = Object.entries(finalHashes).map(([path, hash]) => ({ path, hash: hash as string }));

        // Recompute hash with new dependent files
        const newHash = computeSkillHash(coreFrontmatter, bodyContent, dependentFiles);

        // Update hash in common file
        await updateMainHash(commonFilePath, newHash);

        // Propagate to all enabled platforms
        const platformPaths: string[] = [];
        for (const config of enabledConfigs) {
          const platformSkillPath = join(baseDir, config.skillsDir, skillName, 'SKILL.md');
          try {
            await fs.access(platformSkillPath);
            platformPaths.push(platformSkillPath);
          } catch {
            // Platform skill doesn't exist, skip
          }
        }

        if (platformPaths.length > 0) {
          await propagateFrontmatter(commonFilePath, platformPaths, { failOnConflict, dryRun: false });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Warning: Failed to recompute and propagate hash for ${skillName}: ${errorMessage}`);
      }

      // Clean up dependent files from platform folders
      const filesToCleanup = Object.keys(finalHashes);
      if (filesToCleanup.length > 0) {
        for (const config of enabledConfigs) {
          const platformSkillsPath = join(baseDir, config.skillsDir);
          try {
            await cleanupPlatformDependentFiles(platformSkillsPath, skillName, filesToCleanup);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Warning: Failed to cleanup ${config.name} dependent files for ${skillName}: ${errorMessage}`);
          }
        }
      }
    }
  }

  console.log('Sync complete');
}
