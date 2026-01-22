import matter from 'gray-matter';
/**
 * Parse a skill file's frontmatter and body
 */
export function parseSkillFile(content) {
    const trimmed = content.trim();
    if (!trimmed.startsWith('---')) {
        return null;
    }
    const parsed = matter(content);
    const body = parsed.content.trim();
    const hasAtReference = body.startsWith('@');
    return {
        data: parsed.data,
        content: body,
        hasAtReference
    };
}
//# sourceMappingURL=parser.js.map