import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { pickCoreFrontmatter, stableStringify } from '../src/frontmatter.js';

describe('frontmatter', () => {
  it('preserves falsey core fields', () => {
    const input = {
      name: '',
      description: false,
      license: 0,
      compatibility: null,
      metadata: {},
      'allowed-tools': []
    };

    const result = pickCoreFrontmatter(input);

    assert.deepEqual(result, input);
  });

  it('stableStringify is order-insensitive for objects', () => {
    const a = { b: 1, a: 2, nested: { z: 1, y: 2 } };
    const b = { nested: { y: 2, z: 1 }, a: 2, b: 1 };
    assert.equal(stableStringify(a), stableStringify(b));
  });
});
