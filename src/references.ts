import { dirname, relative, resolve, sep } from 'path';
import { normalizeBodyContent } from './frontmatter.js';

function normalizePathSeparators(input: string): string {
  if (sep === '/') {
    return input;
  }
  return input.split(sep).join('/');
}

export function extractAtReference(content: string): string | null {
  const normalized = normalizeBodyContent(content).trim();
  if (!normalized || normalized.includes('\n')) {
    return null;
  }
  const match = normalized.match(/^@(.+)$/);
  return match ? match[1] : null;
}

export function getReferenceSkillName(referencePath: string): string | null {
  const normalized = normalizePathSeparators(referencePath).replace(/\/+$/u, '');
  if (!normalized) {
    return null;
  }
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const last = parts[parts.length - 1];
  if (last.toLowerCase() === 'skill.md') {
    return parts.length >= 2 ? parts[parts.length - 2] : null;
  }
  return last;
}

export function isReferenceToPath(content: string, expectedReference: string): boolean {
  const reference = extractAtReference(content);
  if (!reference) {
    return false;
  }
  return normalizePathSeparators(reference) === normalizePathSeparators(expectedReference);
}

export function isReferenceToSkill(content: string, skillName: string | null): boolean {
  if (!skillName) {
    return false;
  }
  const reference = extractAtReference(content);
  if (!reference) {
    return false;
  }
  const referencedSkill = getReferenceSkillName(reference);
  return referencedSkill === skillName;
}

export function getRelativeCommonSkillPath(
  platformSkillPath: string,
  commonSkillPath: string
): string {
  const fromDir = dirname(resolve(platformSkillPath));
  const toPath = resolve(commonSkillPath);
  const relativePath = relative(fromDir, toPath);
  return normalizePathSeparators(relativePath);
}

export function buildCommonSkillReference(
  platformSkillPath: string,
  commonSkillPath: string
): string {
  return `@${getRelativeCommonSkillPath(platformSkillPath, commonSkillPath)}`;
}
