import { describe, expect, it } from 'vitest';

import { createAiSkillRegistry, type AiSkillDefinitionV1 } from './index';

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

describe('AI skill resolution edge policy', () => {
  it('orders equal-priority auto candidates by source then canonical id', () => {
    const registry = createAiSkillRegistry([
      skill('skill.host-z', { activation: { mode: 'auto', keywords: ['match'] } }),
      skill('skill.builtin-z', {
        source: 'builtin',
        trust: 'builtin',
        activation: { mode: 'auto', keywords: ['match'] },
      }),
      skill('skill.builtin-a', {
        source: 'builtin',
        trust: 'builtin',
        activation: { mode: 'auto', keywords: ['match'] },
      }),
    ]);

    expect(registry.prepare({ request: 'match' }).active.map(({ id }) => id)).toEqual([
      'skill.builtin-a',
      'skill.builtin-z',
      'skill.host-z',
    ]);
  });

  it('omits lower-priority optional conflicts but errors for broken auto dependencies', () => {
    const conflicting = createAiSkillRegistry([
      skill('skill.winner', {
        priority: 10,
        conflicts: ['skill.loser'],
        activation: { mode: 'auto', keywords: ['match'] },
      }),
      skill('skill.loser', {
        priority: 1,
        activation: { mode: 'auto', keywords: ['match'] },
      }),
    ]).prepare({ request: 'match' });

    expect(conflicting.active.map(({ id }) => id)).toEqual(['skill.winner']);
    expect(conflicting.omitted).toEqual([
      expect.objectContaining({ id: 'skill.loser', code: 'conflict' }),
    ]);

    const unknownDependency = createAiSkillRegistry([
      skill('skill.broken', {
        dependencies: ['skill.missing'],
        activation: { mode: 'auto', keywords: ['match'] },
      }),
    ]);
    expect(() => unknownDependency.prepare({ request: 'match' })).toThrow(/unknown skill/i);
  });

  it('handles optional active-count limits atomically and allows explicit untrusted auto content', () => {
    const registry = createAiSkillRegistry([
      skill('skill.one', { priority: 2, activation: { mode: 'auto', keywords: ['match'] } }),
      skill('skill.two', {
        priority: 1,
        trust: 'untrusted',
        activation: { mode: 'auto', keywords: ['match'] },
      }),
    ]);

    const limited = registry.prepare({ request: 'match', maxActiveSkills: 1 });
    expect(limited.active.map(({ id }) => id)).toEqual(['skill.one']);
    expect(limited.omitted.map(({ code }) => code)).toEqual(['untrusted']);

    const trustedByHost = registry.prepare({
      request: 'match',
      maxActiveSkills: 1,
      allowUntrusted: true,
    });
    expect(trustedByHost.active.map(({ id }) => id)).toEqual(['skill.one']);
    expect(trustedByHost.omitted).toEqual([
      expect.objectContaining({ id: 'skill.two', code: 'active-limit' }),
    ]);
  });

  it('supports block-only matching, disabling auto, and validates both hard limits', () => {
    const registry = createAiSkillRegistry([
      skill('skill.hero', {
        activation: { mode: 'auto', selectedBlockTypes: ['hero'] },
      }),
    ]);

    expect(
      registry.prepare({ request: 'x', selectedBlockTypes: ['HERO'] }).active.map(({ id }) => id),
    ).toEqual(['skill.hero']);
    expect(
      registry.prepare({ request: 'x', selectedBlockTypes: ['hero'], auto: false }).active,
    ).toEqual([]);
    expect(() => registry.prepare({ request: 'x', maxActiveSkills: 0 })).toThrow(/positive/i);
    expect(() => registry.prepare({ request: 'x', maxSkillTokens: 1.5 })).toThrow(/positive/i);
  });

  it('fails when mandatory skills exceed the active-count limit', () => {
    const registry = createAiSkillRegistry([skill('skill.a'), skill('skill.b')]);

    expect(() =>
      registry.prepare({
        request: 'x',
        selectedSkillIds: ['skill.a', 'skill.b'],
        maxActiveSkills: 1,
      }),
    ).toThrow(/active skill limit/i);
  });
});
