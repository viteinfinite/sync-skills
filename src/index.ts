import { promises as fs } from 'fs';
import { join } from 'path';
import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts } from './detector.js';
import { resolveConflict, resolveDependentConflicts } from './resolver.js';
import { refactorSkill, copySkill } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { discoverAssistants, findSyncPairs, processSyncPairs, syncCommonOnlySkills } from './assistants.js';
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
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
  const enabledConfigs = getEnabledAssistants(config);
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
  const { claude, codex, common } = await scanSkills(baseDir);

  // Phase 2.5: Sync skills that exist only in .agents-common to enabled platforms
  await syncCommonOnlySkills(
    baseDir,
    common.map(c => ({ path: c.path, skillName: c.skillName })),
    enabledConfigs,
    dryRun
  );

  // Phase 3: Refactor Claude skills that don't have @ references
  for (const skill of claude) {
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

  // Phase 4: Refactor Codex skills that don't have @ references
  for (const skill of codex) {
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

  // Phase 5: Detect and resolve conflicts
  const conflicts = await detectConflicts(claude, codex);

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

      if (resolution.action === 'use-claude' && !dryRun) {
        await copySkill(conflict.claudePath, conflict.codexPath);
      } else if (resolution.action === 'use-codex' && !dryRun) {
        await copySkill(conflict.codexPath, conflict.claudePath);
      }

      // Propagate frontmatter from common to both targets after conflict resolution
      const commonPath = join(baseDir, '.agents-common/skills', conflict.skillName, 'SKILL.md');
      await propagateFrontmatter(commonPath, [conflict.claudePath, conflict.codexPath], { failOnConflict, dryRun });
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
