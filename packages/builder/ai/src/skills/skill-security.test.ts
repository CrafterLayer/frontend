import { describe, expect, it } from 'vitest';

import {
  AI_SKILL_MAX_REFERENCES,
  AI_SKILL_MAX_REFERENCE_BYTES,
  AI_SKILL_MAX_TOTAL_REFERENCE_BYTES,
  defineAiSkill,
  type AiSkillDefinitionV1,
} from './index';

function definition(overrides: Record<string, unknown> = {}): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id: 'security.skill',
    name: 'Security skill',
    description: 'Exercise the runtime trust boundary.',
    version: '1.0.0',
    instructions: 'Stay inside the declared command boundary.',
    activation: { mode: 'explicit' },
    ...overrides,
  };
}

describe('AI skill runtime hardening', () => {
  it.each([
    ['non-object', null],
    ['missing name', definition({ name: '' })],
    ['long name', definition({ name: 'n'.repeat(121) })],
    ['empty instructions', definition({ instructions: '   ' })],
    ['invalid list shape', definition({ tags: 'design' })],
    ['non-string list member', definition({ tags: [7] })],
    ['normalized duplicate', definition({ tags: ['Design', 'design'] })],
    ['invalid activation object', definition({ activation: 'auto' })],
    ['invalid activation mode', definition({ activation: { mode: 'sometimes' } })],
    ['invalid references object', definition({ references: [] })],
    ['non-text reference', definition({ references: { 'guide.md': 7 } })],
    ['invalid source', definition({ source: 'remote' })],
    ['invalid trust', definition({ trust: 'trusted' })],
    ['host claiming builtin trust', definition({ source: 'host', trust: 'builtin' })],
    ['non-number priority', definition({ priority: 'high' })],
    ['out-of-range priority', definition({ priority: 1_001 })],
    ['self dependency', definition({ dependencies: ['security.skill'] })],
  ])('rejects %s', (_name, candidate) => {
    expect(() => defineAiSkill(candidate)).toThrow();
  });

  it.each([
    'C:/secret.md',
    'https://example.test/guide.md',
    './guide.md',
    'a/../guide.md',
    '__proto__/guide.md',
    'constructor/guide.md',
  ])(
    'rejects unsafe logical reference %s',
    (path) => {
      expect(() => defineAiSkill(definition({ references: { [path]: 'text' } }))).toThrow(
        /reference/i,
      );
    },
  );

  it('enforces reference count, per-body bytes, and total bytes', () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: AI_SKILL_MAX_REFERENCES + 1 }, (_value, index) => [
        `guide-${String(index)}.md`,
        'x',
      ]),
    );
    expect(() => defineAiSkill(definition({ references: tooMany }))).toThrow(/at most/i);
    expect(() =>
      defineAiSkill(
        definition({ references: { 'large.md': 'x'.repeat(AI_SKILL_MAX_REFERENCE_BYTES + 1) } }),
      ),
    ).toThrow(/per-reference/i);

    const body = 'x'.repeat(AI_SKILL_MAX_REFERENCE_BYTES);
    const count = Math.floor(AI_SKILL_MAX_TOTAL_REFERENCE_BYTES / AI_SKILL_MAX_REFERENCE_BYTES) + 1;
    const oversizedTotal = Object.fromEntries(
      Array.from({ length: count }, (_value, index) => [`part-${String(index)}.md`, body]),
    );
    expect(() => defineAiSkill(definition({ references: oversizedTotal }))).toThrow(/total byte/i);
  });

  it('derives builtin trust only for a builtin source', () => {
    const skill = defineAiSkill(definition({ source: 'builtin' }));

    expect(skill.manifest).toMatchObject({ source: 'builtin', trust: 'builtin' });
  });
});
