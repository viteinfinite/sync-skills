import { promises as fs } from 'fs';
export async function isSymlinkedSkill(skillDir) {
    try {
        const stats = await fs.lstat(skillDir);
        if (!stats.isSymbolicLink()) {
            return false;
        }
        // Any symlinked skill directory should be ignored to avoid managing external sources.
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=symlinks.js.map