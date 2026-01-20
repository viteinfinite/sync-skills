import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveOutOfSyncSkill, resolveConflict } from '../src/resolver.js';
import type { OutOfSyncSkill } from '../src/detector.js';
import type { Conflict } from '../src/types.js';

// Mock inquirer implementation
function createMockInquirer(answer: Record<string, unknown>) {
  let capturedQuestions: any = null;
  return {
    prompt: async (questions: any) => {
      capturedQuestions = questions;
      return answer;
    },
    getCapturedQuestions: () => capturedQuestions
  };
}

describe('resolver', () => {
  describe('resolveOutOfSyncSkill', () => {
    it('should present choices for all modified platforms', async () => {
      const skillName = 'test-skill';
      const platforms: OutOfSyncSkill[] = [
        {
          skillName,
          platform: 'claude',
          platformPath: '/path/to/claude/skill',
          currentHash: 'hash1',
          storedHash: 'hash2'
        },
        {
          skillName,
          platform: 'cline',
          platformPath: '/path/to/cline/skill',
          currentHash: 'hash3',
          storedHash: 'hash2'
        }
      ];

      const mockInquirer = createMockInquirer({ outOfSyncAction: 'skip' });
      
      // We pass the mock as the third argument (inquirerImpl)
      await resolveOutOfSyncSkill(skillName, platforms, mockInquirer as any);

      const questions = mockInquirer.getCapturedQuestions();
      assert.ok(questions, 'Questions should be captured');
      assert.ok(Array.isArray(questions), 'Questions should be an array');
      assert.strictEqual(questions.length, 1);

      const choices = questions[0].choices;
      assert.ok(Array.isArray(choices), 'Choices should be an array');

      // Verify specific platform choices exist
      const claudeChoice = choices.find((c: any) => c.value === 'use-platform:claude');
      assert.ok(claudeChoice, 'Should have choice for claude');
      assert.ok(claudeChoice.name.includes('claude'), 'Claude choice should mention platform name');

      const clineChoice = choices.find((c: any) => c.value === 'use-platform:cline');
      assert.ok(clineChoice, 'Should have choice for cline');
      assert.ok(clineChoice.name.includes('cline'), 'Cline choice should mention platform name');

      // Verify common choice exists
      const commonChoice = choices.find((c: any) => c.value === 'use-common');
      assert.ok(commonChoice, 'Should have choice for common');

      // Verify skip choice exists
      const skipChoice = choices.find((c: any) => c.value === 'skip');
      assert.ok(skipChoice, 'Should have choice for skip');
    });

    it('should return correct resolution when a platform is selected', async () => {
      const skillName = 'test-skill';
      const platforms: OutOfSyncSkill[] = [
        {
          skillName,
          platform: 'claude',
          platformPath: '/path/to/claude/skill',
          currentHash: 'hash1',
          storedHash: 'hash2'
        }
      ];

      const mockInquirer = createMockInquirer({ outOfSyncAction: 'use-platform:claude' });
      
      const resolution = await resolveOutOfSyncSkill(skillName, platforms, mockInquirer as any);

      assert.deepEqual(resolution, {
        action: 'use-platform',
        platformName: 'claude'
      });
    });

    it('should return correct resolution when common is selected', async () => {
      const skillName = 'test-skill';
      const platforms: OutOfSyncSkill[] = [];

      const mockInquirer = createMockInquirer({ outOfSyncAction: 'use-common' });
      
      const resolution = await resolveOutOfSyncSkill(skillName, platforms, mockInquirer as any);

      assert.deepEqual(resolution, {
        action: 'use-common'
      });
    });
  });

  describe('resolveConflict', () => {
    it('should present options to use A, use B, keep both, or abort', async () => {
      const conflict: Conflict = {
        skillName: 'conflict-skill',
        platformA: 'claude',
        platformB: 'codex',
        pathA: 'path/a',
        pathB: 'path/b',
        hashA: 'hashA',
        hashB: 'hashB',
        contentA: 'content A',
        contentB: 'content B',
        conflictType: 'content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-both' });

      await resolveConflict(conflict, mockInquirer as any);

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'use-a'), 'Should have use-a');
      assert.ok(choices.find((c: any) => c.value === 'use-b'), 'Should have use-b');
      assert.ok(choices.find((c: any) => c.value === 'keep-both'), 'Should have keep-both');
      assert.ok(choices.find((c: any) => c.value === 'abort'), 'Should have abort');
    });

    it('should include common option when allowed', async () => {
      const conflict: Conflict = {
        skillName: 'conflict-skill',
        platformA: 'claude',
        platformB: 'cline',
        pathA: 'path/a',
        pathB: 'path/b',
        hashA: 'hashA',
        hashB: 'hashB',
        contentA: 'content A',
        contentB: '@.agents-common/skills/conflict-skill/SKILL.md',
        conflictType: 'content'
      };

      const mockInquirer = createMockInquirer({ action: 'use-common' });

      await resolveConflict(conflict, mockInquirer as any, { allowUseCommon: true });

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'use-common'), 'Should have use-common');
    });

    it('should omit use-b when disallowed', async () => {
      const conflict: Conflict = {
        skillName: 'conflict-skill',
        platformA: 'claude',
        platformB: 'cline',
        pathA: 'path/a',
        pathB: 'path/b',
        hashA: 'hashA',
        hashB: 'hashB',
        contentA: 'content A',
        contentB: '@.agents-common/skills/conflict-skill/SKILL.md',
        conflictType: 'content'
      };

      const mockInquirer = createMockInquirer({ action: 'use-common' });

      await resolveConflict(conflict, mockInquirer as any, { allowUseA: true, allowUseB: false, allowUseCommon: true });

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'use-a'), 'Should have use-a');
      assert.ok(!choices.find((c: any) => c.value === 'use-b'), 'Should not have use-b');
      assert.ok(choices.find((c: any) => c.value === 'use-common'), 'Should have use-common');
    });
  });
});
