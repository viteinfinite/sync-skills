import { promises as fs } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts, detectOutOfSyncSkills } from './detector.js';
import { resolveConflict, resolveDependentConflicts, resolveOutOfSyncSkills } from './resolver.js';
import { refactorSkill, copySkill, computeSkillHash, updateMainHash } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { discoverAssistants, findSyncPairs, processSyncPairs, syncCommonOnlySkills } from './assistants.js';
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
import { normalizeBodyContent, pickCoreFrontmatter } from './frontmatter.js';
import {
  collectDependentFilesFromPlatforms,
  consolidateDependentsToCommon,
  cleanupPlatformDependentFiles,
  applyConflictResolutions
} from './dependents.js';
import type { RunOptions, AssistantConfig, SkillFile } from './types.js';

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
      throw new Error('HOME environment variable not set');
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

  // Phase 2.75: Detect out-of-sync platform skills
  if (!dryRun) {
    // Collect all platform skills to check for out-of-sync
    const allPlatformSkills: SkillFile[] = [];
    for (const config of enabledConfigs) {
      const platformSkills = platforms[config.name] || [];
      allPlatformSkills.push(...platformSkills);
    }

    // Detect out-of-sync skills
    const outOfSyncSkills = await detectOutOfSyncSkills(allPlatformSkills);

    if (outOfSyncSkills.length > 0) {
      // Interactive resolution
      const resolutions = await resolveOutOfSyncSkills(outOfSyncSkills);

      // Process each resolution
      for (const [skillName, resolution] of resolutions) {
        if (resolution.action === 'skip') {
          // Leave this skill as-is
          continue;
        }

        // Find the out-of-sync skill
        const outOfSyncSkill = outOfSyncSkills.find(s => s.skillName === skillName);
        if (!outOfSyncSkill) {
          continue;
        }

        // Find corresponding common skill
        const commonSkill = common.find(c => c.skillName === skillName);
        if (!commonSkill) {
          console.warn(`Warning: Common skill not found for ${skillName}`);
          continue;
        }

        if (resolution.action === 'yes') {
          // Copy platform edits to common skill
          const platformContent = await fs.readFile(outOfSyncSkill.platformPath, 'utf8');
          const platformParsed = matter(platformContent);

          // Read common skill
          const commonContent = await fs.readFile(commonSkill.path, 'utf8');
          const commonParsed = matter(commonContent);

          // Extract core frontmatter from platform
          const coreFrontmatter = pickCoreFrontmatter(platformParsed.data as Record<string, unknown>);

          // Use platform's body content (the user's edits)
          const platformBody = normalizeBodyContent(platformParsed.content);

          // Recompute hash with platform's content
          const newHash = computeSkillHash(coreFrontmatter, platformBody, []);

          // Update common skill with platform's content
          const newCommonFrontmatter = {
            ...coreFrontmatter,
            metadata: {
              ...(coreFrontmatter.metadata as Record<string, unknown> || {}),
              sync: {
                hash: newHash
              }
            }
          };

          const newCommonContent = matter.stringify(platformBody, newCommonFrontmatter);
          await fs.writeFile(commonSkill.path, newCommonContent);

          console.log(`Applied platform edits to common skill: ${skillName}`);

          // Propagate updated common skill to all platforms
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
            await propagateFrontmatter(commonSkill.path, platformPaths, { failOnConflict, dryRun: false });
          }
        } else if (resolution.action === 'no') {
          // Use common skill content (overwrite platform edits)
          // This will happen naturally in Phase 5 when we propagate frontmatter
          console.log(`Discarded platform edits for ${skillName}`);
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

  if (conflicts.length > 0) {
    if (failOnConflict) {
      throw new Error(`Conflict detected in: ${conflicts.map(c => c.skillName).join(', ')}`);
    }

    // Interactive resolution
    for (const conflict of conflicts) {
      const resolution = await resolveConflict(conflict);

      if (resolution.action === 'abort') {
        throw new Error('Sync aborted');
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

      // Consolidate dependent files to common (detects conflicts)
      const { conflicts, files: initialFiles } = await consolidateDependentsToCommon(
        skillName,
        platformFiles,
        commonSkillsPath
      );

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

        // Clean up dependent files from platform folders
        // Only cleanup from platforms that originally had those files
        for (const [platformName, files] of platformFiles.entries()) {
          const filesToCleanup = files.map(f => f.relativePath);
          if (filesToCleanup.length > 0) {
            const platformConfig = enabledConfigs.find(c => c.name === platformName);
            if (platformConfig) {
              const platformSkillsPath = join(baseDir, platformConfig.skillsDir);
              try {
                await cleanupPlatformDependentFiles(platformSkillsPath, skillName, filesToCleanup);
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
  }

  console.log('Sync complete');
}
