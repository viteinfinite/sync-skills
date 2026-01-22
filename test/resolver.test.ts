import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveOutOfSyncSkill, resolveOutOfSyncSkills, resolveConflict } from '../src/resolver.js';
import type { OutOfSyncSkill, OutOfSyncResolution } from '../src/types.js';
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
    it('should present "keep-common" and "abort" choices for body mismatch with @ reference', async () => {
      const skill: OutOfSyncSkill = {
        skillName: 'test-skill',
        platform: 'claude',
        platformPath: '/path/to/claude/skill',
        commonPath: '/path/to/common/skill',
        mismatchType: 'body',
        platformContent: '@../../../.agents-common/skills/test-skill/SKILL.md',
        commonContent: 'Common content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-common' });

      await resolveOutOfSyncSkill(skill, mockInquirer as any);

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'keep-common'), 'Should have keep-common');
      assert.ok(choices.find((c: any) => c.value === 'abort'), 'Should have abort');
      assert.ok(!choices.find((c: any) => c.value === 'keep-platform'), 'Should not have keep-platform');
    });

    it('should present "keep-platform", "keep-common", "abort" choices for frontmatter mismatch', async () => {
      const skill: OutOfSyncSkill = {
        skillName: 'test-skill',
        platform: 'claude',
        platformPath: '/path/to/claude/skill',
        commonPath: '/path/to/common/skill',
        mismatchType: 'frontmatter',
        platformContent: '@../../../.agents-common/skills/test-skill/SKILL.md',
        commonContent: 'Common content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-platform' });

      await resolveOutOfSyncSkill(skill, mockInquirer as any);

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'keep-platform'), 'Should have keep-platform');
      assert.ok(choices.find((c: any) => c.value === 'keep-common'), 'Should have keep-common');
      assert.ok(choices.find((c: any) => c.value === 'abort'), 'Should have abort');
    });

    it('should present "keep-common" and "abort" choices for both mismatch with @ reference', async () => {
      const skill: OutOfSyncSkill = {
        skillName: 'test-skill',
        platform: 'claude',
        platformPath: '/path/to/claude/skill',
        commonPath: '/path/to/common/skill',
        mismatchType: 'both',
        platformContent: '@../../../.agents-common/skills/test-skill/SKILL.md',
        commonContent: 'Common content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-common' });

      await resolveOutOfSyncSkill(skill, mockInquirer as any);

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'keep-common'), 'Should have keep-common');
      assert.ok(choices.find((c: any) => c.value === 'abort'), 'Should have abort');
      assert.ok(!choices.find((c: any) => c.value === 'keep-platform'), 'Should not have keep-platform');
    });

    it('should present "keep-platform", "keep-common", "abort" choices for both mismatch without @ reference', async () => {
      const skill: OutOfSyncSkill = {
        skillName: 'test-skill',
        platform: 'claude',
        platformPath: '/path/to/claude/skill',
        commonPath: '/path/to/common/skill',
        mismatchType: 'both',
        platformContent: 'Platform content',
        commonContent: 'Common content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-platform' });

      await resolveOutOfSyncSkill(skill, mockInquirer as any);

      const questions = mockInquirer.getCapturedQuestions();
      const choices = questions[0].choices;

      assert.ok(choices.find((c: any) => c.value === 'keep-platform'), 'Should have keep-platform');
      assert.ok(choices.find((c: any) => c.value === 'keep-common'), 'Should have keep-common');
      assert.ok(choices.find((c: any) => c.value === 'abort'), 'Should have abort');
    });

    it('should return correct resolution when keep-platform is selected', async () => {
      const skill: OutOfSyncSkill = {
        skillName: 'test-skill',
        platform: 'claude',
        platformPath: '/path/to/claude/skill',
        commonPath: '/path/to/common/skill',
        mismatchType: 'frontmatter',
        platformContent: '@../../../.agents-common/skills/test-skill/SKILL.md',
        commonContent: 'Common content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-platform' });

      const resolution = await resolveOutOfSyncSkill(skill, mockInquirer as any);

      assert.deepEqual(resolution, {
        action: 'keep-platform'
      });
    });

    it('should return correct resolution when keep-common is selected', async () => {
      const skill: OutOfSyncSkill = {
        skillName: 'test-skill',
        platform: 'claude',
        platformPath: '/path/to/claude/skill',
        commonPath: '/path/to/common/skill',
        mismatchType: 'body',
        platformContent: 'Platform content',
        commonContent: 'Common content'
      };

      const mockInquirer = createMockInquirer({ action: 'keep-common' });

      const resolution = await resolveOutOfSyncSkill(skill, mockInquirer as any);

      assert.deepEqual(resolution, {
        action: 'keep-common'
      });
    });
  });

  describe('resolveOutOfSyncSkills', () => {
    it('should resolve multiple out-of-sync skills in sequence', async () => {
      const skills: OutOfSyncSkill[] = [
        {
          skillName: 'skill-1',
          platform: 'claude',
          platformPath: '/path/to/claude/skill1',
          commonPath: '/path/to/common/skill1',
          mismatchType: 'frontmatter'
        },
        {
          skillName: 'skill-2',
          platform: 'claude',
          platformPath: '/path/to/claude/skill2',
          commonPath: '/path/to/common/skill2',
          mismatchType: 'body'
        }
      ];

      let callCount = 0;
      const mockInquirer = {
        prompt: async (questions: any) => {
          callCount++;
          // First call returns keep-platform, second returns keep-common
          return { action: callCount === 1 ? 'keep-platform' : 'keep-common' };
        }
      };

      const resolutions = await resolveOutOfSyncSkills(skills, mockInquirer as any);

      assert.strictEqual(resolutions.length, 2);
      assert.strictEqual(resolutions[0].action, 'keep-platform');
      assert.strictEqual(resolutions[1].action, 'keep-common');
    });

    it('should stop processing when abort is selected', async () => {
      const skills: OutOfSyncSkill[] = [
        {
          skillName: 'skill-1',
          platform: 'claude',
          platformPath: '/path/to/claude/skill1',
          commonPath: '/path/to/common/skill1',
          mismatchType: 'body'
        },
        {
          skillName: 'skill-2',
          platform: 'claude',
          platformPath: '/path/to/claude/skill2',
          commonPath: '/path/to/common/skill2',
          mismatchType: 'body'
        }
      ];

      let callCount = 0;
      const mockInquirer = {
        prompt: async (questions: any) => {
          callCount++;
          // First call returns abort
          return { action: 'abort' };
        }
      };

      const resolutions = await resolveOutOfSyncSkills(skills, mockInquirer as any);

      assert.strictEqual(resolutions.length, 1);
      assert.strictEqual(resolutions[0].action, 'abort');
      assert.strictEqual(callCount, 1, 'Should only call prompt once');
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
        contentB: '@../../../.agents-common/skills/conflict-skill/SKILL.md',
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
        contentB: '@../../../.agents-common/skills/conflict-skill/SKILL.md',
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
