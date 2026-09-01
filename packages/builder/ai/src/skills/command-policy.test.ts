import { describe, expect, it } from 'vitest';

import {
  AiCommandPolicyError,
  createAiSkillRegistry,
  DEFAULT_AI_MAX_OPERATIONS,
  resolveAiCommandPolicy,
  type AiSkillDefinitionV1,
} from './index';

const REGISTERED = ['insertNode', 'removeNode', 'setProp', 'setDocMeta'] as const;
const REGISTERED_WITH_BULK = [...REGISTERED, 'applyPatches'] as const;

function restrictedSkill(id: string, restrictToCommands?: readonly string[]): AiSkillDefinitionV1 {
  const base: AiSkillDefinitionV1 = {
    schemaVersion: 1,
    id,
    name: id,
    description: `Restrict planning through ${id}.`,
    version: '1.0.0',
    instructions: `Use only the commands declared by ${id}.`,
    activation: { mode: 'explicit' },
  };
  return restrictToCommands === undefined ? base : { ...base, restrictToCommands };
}

describe('AI command policy', () => {
  it('starts from registered commands and canonicalizes the result', () => {
    const policy = resolveAiCommandPolicy({ registeredCommands: [...REGISTERED].reverse() });

    expect(policy).toEqual({
      allowedCommands: ['insertNode', 'removeNode', 'setDocMeta', 'setProp'],
      maxCommands: 64,
      maxOperations: DEFAULT_AI_MAX_OPERATIONS,
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

    expect(policy).toEqual({
      allowedCommands: ['setProp'],
      maxCommands: 12,
      maxOperations: DEFAULT_AI_MAX_OPERATIONS,
    });
  });

  it('never lets a skill grant a command missing from the live registry', () => {
    const skills = createAiSkillRegistry([
      restrictedSkill('skill.bad-grant', ['invented']),
    ]).prepare({ request: 'x', selectedSkillIds: ['skill.bad-grant'] });

    expect(resolveAiCommandPolicy({ registeredCommands: REGISTERED, skills })).toEqual({
      allowedCommands: [],
      maxCommands: 64,
      maxOperations: DEFAULT_AI_MAX_OPERATIONS,
    });
  });

  it('preserves an explicit empty skill restriction as deny-all while omission stays unrestricted', () => {
    const unrestricted = createAiSkillRegistry([restrictedSkill('skill.unrestricted')]);
    const denyAll = createAiSkillRegistry([restrictedSkill('skill.deny-all', [])]);

    expect(unrestricted.get('skill.unrestricted')?.restrictToCommands).toBeUndefined();
    expect(
      unrestricted.prepare({ request: 'x', selectedSkillIds: ['skill.unrestricted'] })
        .effectiveCommandRestriction,
    ).toBeUndefined();

    expect(denyAll.get('skill.deny-all')?.restrictToCommands).toEqual([]);
    const denyAllContext = denyAll.prepare({
      request: 'x',
      selectedSkillIds: ['skill.deny-all'],
    });
    expect(denyAllContext.active[0]?.restrictToCommands).toEqual([]);
    expect(denyAllContext.effectiveCommandRestriction).toEqual([]);
    expect(
      resolveAiCommandPolicy({ registeredCommands: REGISTERED, skills: denyAllContext }),
    ).toEqual({
      allowedCommands: [],
      maxCommands: 64,
      maxOperations: DEFAULT_AI_MAX_OPERATIONS,
    });

    expect(denyAll.get('skill.deny-all')?.contentFingerprint).not.toBe(
      unrestricted.get('skill.unrestricted')?.contentFingerprint,
    );
  });

  it('denies applyPatches by default and allows it only through an explicit host allowlist', () => {
    expect(resolveAiCommandPolicy({ registeredCommands: REGISTERED_WITH_BULK })).toMatchObject({
      allowedCommands: ['insertNode', 'removeNode', 'setDocMeta', 'setProp'],
    });

    expect(
      resolveAiCommandPolicy({
        registeredCommands: REGISTERED_WITH_BULK,
        session: { allowedCommands: ['applyPatches'], maxOperations: 17 },
      }),
    ).toEqual({
      allowedCommands: ['applyPatches'],
      maxCommands: 64,
      maxOperations: 17,
    });
  });

  it.each([
    ['zero limit', { maxCommands: 0 }],
    ['empty allowed command', { allowedCommands: [''] }],
    ['duplicate denied command', { deniedCommands: ['removeNode', 'removeNode'] }],
    ['zero operation limit', { maxOperations: 0 }],
  ])('rejects %s', (_name, session) => {
    expect(() => resolveAiCommandPolicy({ registeredCommands: REGISTERED, session })).toThrow(
      AiCommandPolicyError,
    );
  });
});
