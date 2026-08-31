import { describe, expect, it } from 'vitest';

import { CRAFTKIT_AI_SKILL_DEFINITIONS, createCraftkitAiSkillRegistry } from './index';

describe('Craftkit built-in AI skills', () => {
  it('ships reviewed data-only expertise without ambient always-on activation', () => {
    const registry = createCraftkitAiSkillRegistry();

    expect(registry.list()).toHaveLength(CRAFTKIT_AI_SKILL_DEFINITIONS.length);
    expect(registry.list().every(({ source }) => source === 'builtin')).toBe(true);
    expect(registry.list().every(({ trust }) => trust === 'builtin')).toBe(true);
    expect(registry.list().every(({ activation }) => activation.mode !== 'always')).toBe(true);
  });

  it('auto-activates Arabic page-design expertise deterministically', () => {
    const prepared = createCraftkitAiSkillRegistry().prepare({
      request: 'صمم لي صفحة هبوط احترافية كاملة',
    });

    expect(prepared.active.map(({ id }) => id)).toContain('craftkit.page-composition');
    expect(
      prepared.active.find(({ id }) => id === 'craftkit.page-composition')?.instructions,
    ).toContain('visitor outcome');
  });

  it('keeps explicit precision expertise inactive until it is requested', () => {
    const registry = createCraftkitAiSkillRegistry();
    const automatic = registry.prepare({ request: 'Change the hero title' });
    const explicit = registry.prepare({
      request: 'Change the hero title',
      selectedSkillIds: ['craftkit.precise-edit'],
    });

    expect(automatic.active.map(({ id }) => id)).not.toContain('craftkit.precise-edit');
    expect(explicit.active.map(({ id }) => id)).toContain('craftkit.precise-edit');
  });
});
