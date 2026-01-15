import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import matter from 'gray-matter';
import { diffLines } from 'diff';
import chalk from 'chalk';
async function hashFile(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
}
function getConflictType(claudeContent, codexContent) {
    const claudeParsed = matter(claudeContent);
    const codexParsed = matter(codexContent);
    // If both have @ references, check if they point to the same file
    const claudeRef = extractReference(claudeParsed.content);
    const codexRef = extractReference(codexParsed.content);
    if (claudeRef && codexRef) {
        // Both are references - conflict is in frontmatter
        return claudeRef === codexRef ? 'frontmatter' : 'content';
    }
    // At least one has actual content
    return 'content';
}
function extractReference(content) {
    const match = content.trim().match(/^@(.+)$/);
    return match ? match[1] : null;
}
function formatDiff(claudeContent, codexContent) {
    const diff = diffLines(claudeContent, codexContent);
    const output = [];
    for (const part of diff) {
        const color = part.added ? chalk.green : part.removed ? chalk.red : chalk.gray;
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        // Limit output to first 20 lines
        if (output.length < 20) {
            output.push(color(prefix + part.value.trimEnd()));
        }
    }
    if (diff.length > 20) {
        output.push(chalk.gray('... (diff truncated)'));
    }
    return output.join('\n');
}
export async function detectConflicts(claudeSkills, codexSkills) {
    const conflicts = [];
    for (const claudeSkill of claudeSkills) {
        const codexSkill = codexSkills.find(s => s.skillName === claudeSkill.skillName);
        if (codexSkill) {
            const claudeContent = await fs.readFile(claudeSkill.path, 'utf8');
            const codexContent = await fs.readFile(codexSkill.path, 'utf8');
            const claudeHash = createHash('sha256').update(claudeContent).digest('hex');
            const codexHash = createHash('sha256').update(codexContent).digest('hex');
            if (claudeHash !== codexHash) {
                const conflictType = getConflictType(claudeContent, codexContent);
                conflicts.push({
                    skillName: claudeSkill.skillName,
                    claudePath: claudeSkill.path,
                    codexPath: codexSkill.path,
                    claudeHash,
                    codexHash,
                    claudeContent,
                    codexContent,
                    conflictType
                });
            }
        }
    }
    return conflicts;
}
export { formatDiff };
//# sourceMappingURL=detector.js.map