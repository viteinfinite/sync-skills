import { promises as fs } from 'fs';
import { createHash } from 'crypto';

async function hashFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return createHash('sha256').update(content).digest('hex');
}

export async function detectConflicts(claudeSkills, codexSkills) {
  const conflicts = [];

  for (const claudeSkill of claudeSkills) {
    const codexSkill = codexSkills.find(s => s.skillName === claudeSkill.skillName);

    if (codexSkill) {
      const claudeHash = await hashFile(claudeSkill.path);
      const codexHash = await hashFile(codexSkill.path);

      if (claudeHash !== codexHash) {
        conflicts.push({
          skillName: claudeSkill.skillName,
          claudePath: claudeSkill.path,
          codexPath: codexSkill.path
        });
      }
    }
  }

  return conflicts;
}
