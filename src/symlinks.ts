import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';

export async function isAgentsSkillSymlink(
  skillDir: string,
  baseDir: string,
  skillName: string
): Promise<boolean> {
  try {
    const stats = await fs.lstat(skillDir);
    if (!stats.isSymbolicLink()) {
      return false;
    }

    const linkTarget = await fs.readlink(skillDir);
    const resolvedTarget = resolve(dirname(skillDir), linkTarget);
    const expectedTarget = resolve(baseDir, '.agents', 'skills', skillName);

    return resolvedTarget === expectedTarget;
  } catch {
    return false;
  }
}
