import matter from 'gray-matter';
import type { ParsedSkill } from './types.js';

/**
 * Parse a skill file's frontmatter and body
 */
export function parseSkillFile(content: string): ParsedSkill | null {
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
