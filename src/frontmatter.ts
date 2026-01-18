import { CORE_FIELDS } from './constants.js';

export function pickCoreFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  const core: Record<string, unknown> = {};

  for (const field of CORE_FIELDS) {
    if (data[field]) {
      core[field] = data[field];
    }
  }

  return core;
}

export function normalizeBodyContent(content: string): string {
  return content.startsWith('\n') ? content.slice(1) : content;
}
