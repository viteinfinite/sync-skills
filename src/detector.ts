import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import type { Conflict, SkillFile } from './types.js';

async function hashFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf8');
  return createHash('sha256').update(content).digest('hex');
}

export async function detectConflicts(
  claudeSkills: SkillFile[],
  codexSkills: SkillFile[]
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  for (const claudeSkill of claudeSkills) {
    const codexSkill = codexSkills.find(s => s.skillName === claudeSkill.skillName);

    if (codexSkill) {
      const claudeHash = await hashFile(claudeSkill.path);
      const codexHash = await hashFile(codexSkill.path);

      if (claudeHash !== codexHash) {
        conflicts.push({
          skillName: claudeSkill.skillName,
          claudePath: claudeSkill.path,
          codexPath: codexSkill.path,
          claudeHash,
          codexHash
        });
      }
    }
  }

  return conflicts;
}
