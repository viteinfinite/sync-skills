import { promises as fs } from 'fs';
import { join } from 'path';
import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts } from './detector.js';
import { resolveConflict } from './resolver.js';
import { refactorSkill, copySkill } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { discoverAssistants, findSyncPairs, processSyncPairs } from './assistants.js';
import { ensureConfig, reconfigure as runReconfigure, getEnabledAssistants } from './config.js';
import type { RunOptions } from './types.js';

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

  // If no assistants have skills, exit silently (Scenario 3)
  const anyHasSkills = states.some(s => s.hasSkills);
  if (!anyHasSkills) {
    console.log('No skills found. Exiting.');
    return;
  }

  // Phase 2: Process sync pairs (bidirectional)
  await processSyncPairs(baseDir, syncPairs, dryRun);

  // Re-scan after sync to get updated state
  const { claude, codex } = await scanSkills(baseDir);

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

  console.log('Sync complete');
}
