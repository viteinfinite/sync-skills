import { expect } from 'chai';
import sinon from 'sinon';
import { resolveConflict } from '../src/resolver.js';

describe('resolveConflict', () => {
  it('should return claude version when option 1 is chosen', async () => {
    const inquirerStub = { prompt: sinon.stub().resolves({ action: 'use-claude' }) };

    const result = await resolveConflict(
      { skillName: 'test', claudePath: '/a', codexPath: '/b' },
      inquirerStub
    );

    expect(result.action).to.equal('use-claude');
    sinon.assert.calledOnce(inquirerStub.prompt);
  });

  it('should return keep-both when option 3 is chosen', async () => {
    const inquirerStub = { prompt: sinon.stub().resolves({ action: 'keep-both' }) };

    const result = await resolveConflict(
      { skillName: 'test', claudePath: '/a', codexPath: '/b' },
      inquirerStub
    );

    expect(result.action).to.equal('keep-both');
  });
});
