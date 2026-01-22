import { dirname, relative, resolve, sep } from 'path';

function normalizePathSeparators(input: string): string {
  if (sep === '/') {
    return input;
  }
  return input.split(sep).join('/');
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
