import { expect } from 'chai';
import { parseSkillFile } from '../src/parser.js';

describe('parseSkillFile', () => {
  it('should split frontmatter and body', () => {
    const content = `---
name: pr-review
description: Review PRs
---

# PR Review

Some content`;

    const result = parseSkillFile(content);

    expect(result.frontmatter).to.deep.equal({
      name: 'pr-review',
      description: 'Review PRs'
    });
    expect(result.body).to.equal('# PR Review\n\nSome content');
    expect(result.hasAtReference).to.be.false;
  });

  it('should detect @ reference in body', () => {
    const content = `---
name: pr-review
---

@.agents-common/skills/pr-review/SKILL.md`;

    const result = parseSkillFile(content);

    expect(result.hasAtReference).to.be.true;
  });

  it('should handle file without frontmatter', () => {
    const content = `# Just content

No frontmatter here`;

    const result = parseSkillFile(content);

    expect(result).to.be.null;
  });
});
