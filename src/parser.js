import matter from 'gray-matter';

export function parseSkillFile(content) {
  const trimmed = content.trim();

  if (!trimmed.startsWith('---')) {
    return null;
  }

  const parsed = matter(content);

  const body = parsed.content.trim();
  const hasAtReference = body.startsWith('@');

  return {
    frontmatter: parsed.data,
    body,
    hasAtReference
  };
}
