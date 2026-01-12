import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts } from './detector.js';
import { resolveConflict } from './resolver.js';
import { refactorSkill, copySkill, cloneCodexSkills } from './syncer.js';
import { propagateFrontmatter } from './propagator.js';
import { promises as fs } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import inquirer from 'inquirer';

export async function run(options = {}) {
  const {
    baseDir = process.cwd(),
    failOnConflict = false,
    dryRun = false,
    targets = ['claude', 'codex']
  } = options;

  // Scan for skills
  const { claude, codex, common } = await scanSkills(baseDir);

  // Refactor skills that don't have @ references
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

  // Check if .codex folder exists, create .codex/skills if needed
  const codexDir = join(baseDir, '.codex');
  const codexSkillsDir = join(codexDir, 'skills');
  let shouldCreateCodexSkills = false;

  try {
    await fs.access(codexDir);
    // .codex folder exists - check if .codex/skills already has content
    try {
      await fs.access(codexSkillsDir);
      // .codex/skills exists, check if it's empty by trying to read it
      const entries = await fs.readdir(codexSkillsDir);
      if (entries.length === 0) {
        // .codex/skills exists but is empty, create skills
        shouldCreateCodexSkills = true;
      }
      // If .codex/skills has content, don't overwrite
    } catch {
      // .codex/skills doesn't exist, create it
      shouldCreateCodexSkills = true;
    }
  } catch {
    // .codex folder doesn't exist, ask user
    if (claude.length > 0 && !dryRun) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createCodex',
          message: '.codex folder does not exist. Would you like to create .codex/skills with references to common skills?',
          default: false
        }
      ]);
      shouldCreateCodexSkills = answer.createCodex;
    }
  }

  if (shouldCreateCodexSkills && !dryRun) {
    await cloneCodexSkills(baseDir, claude);
    // Re-scan to get the newly created codex skills
    const rescan = await scanSkills(baseDir);
    codex.push(...rescan.codex);
  }

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

  // Detect conflicts
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
