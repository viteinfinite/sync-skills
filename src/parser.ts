import matter from 'gray-matter';
import { normalizeBodyContent } from './frontmatter.js';
import { extractAtReference } from './references.js';
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

  const body = normalizeBodyContent(parsed.content);
  const hasAtReference = extractAtReference(body) !== null;

  return {
    data: parsed.data,
    content: body,
    hasAtReference
  };
}
