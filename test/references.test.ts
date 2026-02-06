import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractAtReference, getReferenceSkillName, isReferenceToSkill } from '../src/references.js';

describe('references', () => {
  it('extracts exact @ references only', () => {
    assert.equal(extractAtReference('@../path/to/SKILL.md'), '../path/to/SKILL.md');
    assert.equal(extractAtReference('@../path/to/SKILL.md\n'), '../path/to/SKILL.md');
    assert.equal(extractAtReference('@../path/to/SKILL.md\nextra'), null);
    assert.equal(extractAtReference('not a ref'), null);
  });

  it('matches references by skill folder name', () => {
    const ref = '@../.sync-skills/skills/test-skill/SKILL.md';
    assert.equal(isReferenceToSkill(ref, 'test-skill'), true);
    assert.equal(isReferenceToSkill(ref, 'other-skill'), false);
  });

  it('extracts skill folder name from reference path', () => {
    assert.equal(getReferenceSkillName('../.sync-skills/skills/test-skill/SKILL.md'), 'test-skill');
    assert.equal(getReferenceSkillName('test-skill'), 'test-skill');
  });
});
