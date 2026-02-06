import { CORE_FIELDS } from './constants.js';

export function pickCoreFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  const core: Record<string, unknown> = {};

  for (const field of CORE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
      core[field] = data[field];
    }
  }

  return core;
}

export function normalizeBodyContent(content: string): string {
  return content.startsWith('\n') ? content.slice(1) : content;
}

export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return '"' + value.replace(/"/g, '\\"') + '"';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return '[' + value.map(item => stableStringify(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const pairs = keys.map(key => `"${key}":${stableStringify((value as Record<string, unknown>)[key])}`);
    return '{' + pairs.join(',') + '}';
  }
  return '';
}
