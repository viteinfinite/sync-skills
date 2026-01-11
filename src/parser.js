import matter from 'gray-matter';

export function parseSkillFile(content) {
  const parsed = matter(content);

  // gray-matter returns empty object for no frontmatter
  // check if there was actual frontmatter by looking for --- in original
  const hasFrontmatter = content.startsWith('---');

  if (!hasFrontmatter || Object.keys(parsed.data).length === 0) {
    // Check if this is truly no frontmatter or just empty
    if (!content.trim().startsWith('---')) {
      return null;
    }
  }

  const body = parsed.content.trim();
  const hasAtReference = body.startsWith('@');

  return {
    frontmatter: parsed.data,
    body: parsed.content.trim(),
    hasAtReference
  };
}
