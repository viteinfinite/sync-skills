import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function* walkDir(dir, agent, baseDir, originalBaseDir) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                yield* walkDir(fullPath, agent, baseDir, originalBaseDir);
            }
            else if (entry.name === 'SKILL.md') {
                const relativePath = fullPath.substring(baseDir.length + 1);
                const parts = relativePath.split('/');
                const skillName = parts[2];
                // Reconstruct the path using the original baseDir to preserve format
                // Use string concatenation to avoid path normalization
                const separator = originalBaseDir.endsWith('/') ? '' : '/';
                const resultPath = originalBaseDir + separator + relativePath;
                yield {
                    agent,
                    skillName,
                    path: resultPath,
                    relativePath
                };
            }
        }
    }
    catch {
        // Directory doesn't exist
    }
}
export async function scanSkills(baseDir = process.cwd()) {
    const claude = [];
    const codex = [];
    const common = [];
    // Normalize the base directory for filesystem operations
    const normalizedBaseDir = join(baseDir);
    for await (const skill of walkDir(join(baseDir, '.claude'), 'claude', normalizedBaseDir, baseDir)) {
        claude.push(skill);
    }
    for await (const skill of walkDir(join(baseDir, '.codex'), 'codex', normalizedBaseDir, baseDir)) {
        codex.push(skill);
    }
    for await (const skill of walkDir(join(baseDir, '.agents-common'), 'common', normalizedBaseDir, baseDir)) {
        common.push(skill);
    }
    return { claude, codex, common };
}
//# sourceMappingURL=scanner.js.map