import { scanSkills } from './scanner.js';
import { parseSkillFile } from './parser.js';
import { detectConflicts } from './detector.js';
import { resolveConflict } from './resolver.js';
import { refactorSkill, copySkill } from './syncer.js';
import { promises as fs } from 'fs';

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
        await refactorSkill(skill.path);
      }
    }
  }

  for (const skill of codex) {
    const content = await fs.readFile(skill.path, 'utf8');
    const parsed = parseSkillFile(content);
    if (parsed && !parsed.hasAtReference) {
      if (!dryRun) {
        await refactorSkill(skill.path);
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
    }
  }

  console.log('Sync complete');
}
