import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { VerboseLogger } from '../src/logger.js';

describe('verbose logger', () => {
  it('emits verbose events and summary when enabled', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      const logger = new VerboseLogger(true);
      logger.decision({ phase: 'phase-a', action: 'scan', reason: 'start' });
      logger.skillOperation({
        phase: 'phase-b',
        action: 'rewrite',
        reason: 'test-rewrite',
        skill: 'demo',
        path: '/tmp/demo/SKILL.md'
      });
      logger.printSummary();
    } finally {
      console.log = originalLog;
    }

    assert.ok(logs.some(line => line.includes('[verbose] phase=phase-a action=scan reason=start')));
    assert.ok(logs.some(line => line.includes('[verbose] phase=phase-b action=rewrite reason=test-rewrite')));
    assert.ok(logs.some(line => line.includes('[verbose-summary] SKILL.md operations')));
    assert.ok(logs.some(line => line.includes('rewrite:test-rewrite count=1')));
  });

  it('stays silent when disabled', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      const logger = new VerboseLogger(false);
      logger.decision({ phase: 'phase-a', action: 'scan' });
      logger.skillOperation({
        phase: 'phase-b',
        action: 'rewrite',
        reason: 'test-rewrite',
        path: '/tmp/demo/SKILL.md'
      });
      logger.printSummary();
    } finally {
      console.log = originalLog;
    }

    assert.strictEqual(logs.length, 0);
  });
});

