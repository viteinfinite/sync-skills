import { CORE_FIELDS } from './constants.js';
export function pickCoreFrontmatter(data) {
    const core = {};
    for (const field of CORE_FIELDS) {
        if (data[field]) {
            core[field] = data[field];
        }
    }
    return core;
}
export function normalizeBodyContent(content) {
    return content.startsWith('\n') ? content.slice(1) : content;
}
//# sourceMappingURL=frontmatter.js.map