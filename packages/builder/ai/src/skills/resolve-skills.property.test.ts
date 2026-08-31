import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { AiSkillResolutionError, createAiSkillRegistry, type AiSkillDefinitionV1 } from './index';

const RUNS = 1_000;
const SEED = 0x51a11;

function skill(id: string, overrides: Partial<AiSkillDefinitionV1> = {}): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id,
    name: id,
    description: `Skill ${id}`,
    version: '1.0.0',
    instructions: `Follow ${id}.`,
    activation: { mode: 'explicit' },
    ...overrides,
  };
}

const DEFINITIONS = [
  skill('skill.foundation'),
  skill('skill.explicit', { dependencies: ['skill.foundation'] }),
  skill('skill.always', { activation: { mode: 'always' } }),
  skill('skill.design', {
    activation: { mode: 'auto', keywords: ['landing page', 'تصميم'] },
    priority: 20,
  }),
  skill('skill.selection', {
    activation: { mode: 'auto', selectedBlockTypes: ['hero'] },
    priority: 10,
  }),
] as const;

describe('AI Skill resolution', () => {
  it('is order-independent across 1,000 shuffled registries and explicit selections', () => {
    const indexes = DEFINITIONS.map((_definition, index) => index);
    fc.assert(
      fc.property(
        fc.shuffledSubarray(indexes, { minLength: indexes.length, maxLength: indexes.length }),
        fc.shuffledSubarray(['skill.explicit'], { minLength: 1, maxLength: 1 }),
        (order, selected) => {
          const registry = createAiSkillRegistry(order.map((index) => DEFINITIONS[index]!));
          const result = registry.prepare({
            request: 'صمم landing page',
            selectedSkillIds: selected,
            selectedBlockTypes: ['hero'],
          });

          expect(result.active.map(({ id, reason }) => [id, reason])).toEqual([
            ['skill.explicit', 'explicit'],
            ['skill.always', 'always'],
            ['skill.foundation', 'dependency'],
            ['skill.design', 'auto'],
            ['skill.selection', 'auto'],
          ]);
        },
      ),
      { numRuns: RUNS, seed: SEED },
    );
  });

  it('fails closed for unknown explicit ids, dependency cycles, and mandatory conflicts', () => {
    const unknown = createAiSkillRegistry([skill('skill.one')]);
    expect(() => unknown.prepare({ request: 'x', selectedSkillIds: ['skill.missing'] })).toThrow(
      AiSkillResolutionError,
    );

    const cyclic = createAiSkillRegistry([
      skill('skill.a', { dependencies: ['skill.b'] }),
      skill('skill.b', { dependencies: ['skill.a'] }),
    ]);
    expect(() => cyclic.prepare({ request: 'x', selectedSkillIds: ['skill.a'] })).toThrow(/cycle/i);

    const conflicting = createAiSkillRegistry([
      skill('skill.a', { conflicts: ['skill.b'] }),
      skill('skill.b'),
    ]);
    expect(() =>
      conflicting.prepare({ request: 'x', selectedSkillIds: ['skill.b', 'skill.a'] }),
    ).toThrow(/conflict/i);
  });

  it('requires explicit trust opt-in for an untrusted skill', () => {
    const registry = createAiSkillRegistry([
      skill('skill.untrusted', { trust: 'untrusted', activation: { mode: 'always' } }),
    ]);

    expect(() => registry.prepare({ request: 'x' })).toThrow(/untrusted/i);
    expect(
      registry.prepare({ request: 'x', allowUntrusted: true }).active.map(({ id }) => id),
    ).toEqual(['skill.untrusted']);
  });

  it('fails when mandatory content exceeds limits and reports optional auto omissions', () => {
    const registry = createAiSkillRegistry([
      skill('skill.required', { instructions: 'r'.repeat(800) }),
      skill('skill.optional', {
        instructions: 'o'.repeat(800),
        activation: { mode: 'auto', keywords: ['design'] },
      }),
    ]);

    expect(() =>
      registry.prepare({
        request: 'design',
        selectedSkillIds: ['skill.required'],
        maxSkillTokens: 10,
      }),
    ).toThrow(/budget/i);

    const result = registry.prepare({ request: 'design', maxSkillTokens: 10 });
    expect(result.active).toEqual([]);
    expect(result.omitted).toEqual([
      expect.objectContaining({ id: 'skill.optional', code: 'token-budget' }),
    ]);
  });

  it('loads full bodies only for active skills while keeping the whole catalog discoverable', () => {
    const registry = createAiSkillRegistry([skill('skill.active'), skill('skill.metadata-only')]);
    const result = registry.prepare({
      request: 'x',
      selectedSkillIds: ['skill.active'],
      auto: false,
    });

    expect(result.catalog.map(({ id }) => id)).toEqual(['skill.active', 'skill.metadata-only']);
    expect(result.active).toHaveLength(1);
    expect(result.active[0]).toMatchObject({
      id: 'skill.active',
      instructions: 'Follow skill.active.',
    });
    expect(JSON.stringify(result.active)).not.toContain('Follow skill.metadata-only.');
  });

  it('activates an auto candidate and its full dependency closure as one optional group', () => {
    const registry = createAiSkillRegistry([
      skill('skill.base'),
      skill('skill.auto', {
        activation: { mode: 'auto', keywords: ['compose'] },
        dependencies: ['skill.base'],
      }),
    ]);

    expect(
      registry
        .prepare({ request: 'compose the page' })
        .active.map(({ id, reason }) => [id, reason]),
    ).toEqual([
      ['skill.base', 'dependency'],
      ['skill.auto', 'auto'],
    ]);
  });

  it('omits an auto skill atomically when an untrusted dependency cannot activate', () => {
    const registry = createAiSkillRegistry([
      skill('skill.untrusted-base', { trust: 'untrusted' }),
      skill('skill.auto', {
        activation: { mode: 'auto', keywords: ['compose'] },
        dependencies: ['skill.untrusted-base'],
      }),
    ]);

    const result = registry.prepare({ request: 'compose' });

    expect(result.active).toEqual([]);
    expect(result.omitted).toEqual([
      expect.objectContaining({ id: 'skill.auto', code: 'untrusted' }),
    ]);
  });
});
