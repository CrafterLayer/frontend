import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from './builtins';
import { CRAFTKIT_DEFAULT_SKILLS } from './defaults';
import { requestSkillIdsFor } from './request-skills';

const registry = createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS);
const RECIPES = [
  'craftkit.pro-max-landing',
  'craftkit.conversion-recipes',
  'craftkit.structure-recipes',
];

describe('bespoke section skill discovery', () => {
  it.each([
    {
      role: 'hero',
      contractText: 'Editorial opening about a city',
      needed: 'craftkit.pro-max-design',
    },
    { role: 'band', contractText: 'Testimonials and reviews', needed: 'craftkit.trust-proof' },
    { role: 'band', contractText: 'Contact the studio', needed: 'craftkit.forms-convert' },
    { role: 'band', contractText: 'Revenue chart and pricing', needed: 'craftkit.data-viz' },
    { role: 'cta', contractText: 'About our mission', needed: 'craftkit.natural-copy' },
  ])(
    'preserves relevant expertise without layout recipes: $role $contractText',
    ({ role, contractText, needed }) => {
      const ids = requestSkillIdsFor(
        registry,
        'Create an original publication website',
        'section',
        {
          role,
          contractText,
          composition: 'bespoke',
        },
      );
      expect(ids).toContain(needed);
      expect(ids.filter((id) => RECIPES.includes(id))).toEqual([]);
    },
  );

  it.each([undefined, 'hybrid'] as const)(
    'retains legacy/hybrid automatic recipes: %s',
    (composition) => {
      const ids = requestSkillIdsFor(registry, 'Create a SaaS landing page', 'section', {
        role: 'hero',
        ...(composition === undefined ? {} : { composition }),
      });
      expect(ids).toContain('craftkit.pro-max-landing');
    },
  );

  it('keeps explicit recipe selections admissible beside bespoke automatic skills', () => {
    const selected = ['craftkit.pro-max-landing'];
    const automatic = requestSkillIdsFor(registry, 'Create an original landing page', 'section', {
      role: 'hero',
      composition: 'bespoke',
      present: selected,
      excluded: ['craftkit.pro-max-ux'],
    });
    expect(automatic).not.toContain('craftkit.pro-max-landing');
    expect(automatic).not.toContain('craftkit.pro-max-ux');
    const prepared = registry.prepare({
      request: '',
      auto: false,
      selectedSkillIds: [...selected, ...automatic],
    });
    expect(prepared.active.map(({ id }) => id)).toContain('craftkit.pro-max-landing');
  });
});
