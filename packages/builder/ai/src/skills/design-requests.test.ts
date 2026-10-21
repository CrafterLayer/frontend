import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from './builtins';
import { CRAFTKIT_DEFAULT_SKILLS } from './defaults';
import { explicitRequestSkillIdsFor } from './design-requests';

const registry = createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS);
const expected = ['craftkit.pro-max-design', 'craftkit.pro-max-ux'];

describe('explicit design skill names in ordinary requests', () => {
  it.each([
    'Create a professional CV using UI UX Pro Max',
    'اصنع cv احترافيه استخدم ux ui pro max سكلل',
    'استخدم UI/UX PRO MAX لصفحة حرة',
    'Build an editorial page with ui-ux-pro-max',
    'Use UX/UI Pro-Max for my architecture portfolio',
    'صمم باستخدام يو اي يو اكس برو ماكس',
    '/pro-max-design Create an annual report',
  ])('preserves the named design and UX expertise: %s', (request) => {
    expect(explicitRequestSkillIdsFor(registry, request)).toEqual(expected);
  });

  it.each([
    'Create a professional CV',
    'Show an iPhone Pro Max product page',
    'Improve UI and UX',
    'Use ui ux pro maxwell as the product title',
    'Do not use UI UX Pro Max for this page',
    "Don't use the skill UX UI Pro Max",
    'Create a page without UI/UX Pro Max',
    'لا تستخدم مهارة ux ui pro max',
    'صمم بدون ui-ux-pro-max',
    'Avoid /pro-max-design for this page',
  ])('does not manufacture an explicit selection: %s', (request) => {
    expect(explicitRequestSkillIdsFor(registry, request)).toEqual([]);
  });

  it('keeps only registered skills and does not revive a removed default', () => {
    const available = createCraftkitAiSkillRegistry(
      CRAFTKIT_DEFAULT_SKILLS.filter(({ id }) => id !== expected[0]),
    );
    expect(explicitRequestSkillIdsFor(available, 'Use UI UX Pro Max')).toEqual([expected[1]]);
    expect(
      explicitRequestSkillIdsFor(createCraftkitAiSkillRegistry(), 'Use UI UX Pro Max'),
    ).toEqual([]);
    expect(explicitRequestSkillIdsFor(undefined, 'Use UI UX Pro Max')).toEqual([]);
  });

  it('deduplicates aliases and keeps the explicit set bounded', () => {
    const ids = explicitRequestSkillIdsFor(registry, 'Use UI UX Pro Max and ux-ui-pro-max');
    expect(ids).toEqual(expected);
    expect(
      registry.prepare({ request: '', auto: false, selectedSkillIds: ids }).totalTokens,
    ).toBeLessThan(3_500);
  });
});
