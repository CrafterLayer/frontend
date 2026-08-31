import { describe, expect, it } from 'vitest';

import {
  AiCommandPolicyError,
  createAiSkillRegistry,
  resolveAiCommandPolicy,
  type AiSkillDefinitionV1,
} from './index';

const REGISTERED = ['insertNode', 'removeNode', 'setProp', 'setDocMeta'] as const;

function restrictedSkill(id: string, restrictToCommands: readonly string[]): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id,
    name: id,
    description: `Restrict planning through ${id}.`,
    version: '1.0.0',
    instructions: `Use only the commands declared by ${id}.`,
    activation: { mode: 'explicit' },
    restrictToCommands,
  };
}

describe('AI command policy', () => {
  it('starts from registered commands and canonicalizes the result', () => {
    const policy = resolveAiCommandPolicy({ registeredCommands: [...REGISTERED].reverse() });

    expect(policy).toEqual({
      allowedCommands: ['insertNode', 'removeNode', 'setDocMeta', 'setProp'],
      maxCommands: 64,
    });
  });

  it('intersects host and every active skill restriction, then subtracts denies', () => {
    const registry = createAiSkillRegistry([
      restrictedSkill('skill.layout', ['insertNode', 'setProp', 'invented']),
      restrictedSkill('skill.copy', ['setProp', 'setDocMeta']),
    ]);
    const skills = registry.prepare({
      request: 'x',
      selectedSkillIds: ['skill.copy', 'skill.layout'],
    });

    const policy = resolveAiCommandPolicy({
      registeredCommands: REGISTERED,
      skills,
      session: {
        allowedCommands: ['insertNode', 'setProp', 'setDocMeta', 'alsoInvented'],
        deniedCommands: ['setDocMeta'],
        maxCommands: 12,
      },
    });

    expect(policy).toEqual({ allowedCommands: ['setProp'], maxCommands: 12 });
  });

  it('never lets a skill grant a command missing from the live registry', () => {
    const skills = createAiSkillRegistry([
      restrictedSkill('skill.bad-grant', ['invented']),
    ]).prepare({ request: 'x', selectedSkillIds: ['skill.bad-grant'] });

    expect(resolveAiCommandPolicy({ registeredCommands: REGISTERED, skills })).toEqual({
      allowedCommands: [],
      maxCommands: 64,
    });
  });

  it.each([
    ['zero limit', { maxCommands: 0 }],
    ['empty allowed command', { allowedCommands: [''] }],
    ['duplicate denied command', { deniedCommands: ['removeNode', 'removeNode'] }],
  ])('rejects %s', (_name, session) => {
    expect(() => resolveAiCommandPolicy({ registeredCommands: REGISTERED, session })).toThrow(
      AiCommandPolicyError,
    );
  });
});
