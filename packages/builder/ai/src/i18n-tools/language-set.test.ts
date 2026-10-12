import { describe, expect, it } from 'vitest';

import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { parseTreeMarkup, serializeTreeMarkup } from '../plan/tree-markup';
import { validateAiPlan } from '../plan/validate-plan';
import { fixtureKernel } from '../tools/agent/agent-tools.fixtures';
import { languageSetSteps, pageContext } from './language-set';

const MEMBERS = [
  { lang: 'en', address: '/' },
  { lang: 'ar', address: '/ar' },
];

describe('languageSetSteps', () => {
  it('writes the alternates, the relinked header and the switcher as one step per prop', () => {
    const kernel = fixtureKernel();
    kernel.dispatch('setProp', {
      id: 'r-header',
      key: 'tree',
      value: parseTreeMarkup(
        "<header class='flex items-center gap-4 py-4'><a class='ck-link' href='/about#team'>About</a></header>",
      ),
    });
    kernel.dispatch('setProp', {
      id: 'root',
      key: 'seo',
      value: { keyword: 'coffee', canonicalPath: '/' },
    });
    const steps = languageSetSteps(kernel, {
      members: MEMBERS,
      lang: 'ar',
      addresses: new Map([['/about', '/ar/about']]),
    });
    const keys = steps.map(({ args }) => `${String(args['id'])}.${String(args['key'])}`);
    expect(keys).toEqual(['root.seo', 'r-header.tree']);
    expect(steps[0]?.args['value']).toEqual({
      keyword: 'coffee',
      alternates: [
        { lang: 'en', path: '/' },
        { lang: 'ar', path: '/ar' },
      ],
    });
    const header = serializeTreeMarkup(steps[1]?.args['value']) ?? '';
    expect(header).toContain("href='/ar/about#team'");
    expect(header).toContain("aria-label='اللغة'");
    const result = validateAiPlan({ rationale: 'language set', commands: [...steps] }, kernel, {
      clock: fixedClock(2),
      ids: seededIds('i18n-set'),
    });
    expect(result.ok ? [] : result.issues.map(({ message }) => message)).toEqual([]);
  });

  it('keeps the source its own canonical and site settings', () => {
    const kernel = fixtureKernel();
    kernel.dispatch('setProp', { id: 'root', key: 'seo', value: { canonicalPath: '/' } });
    const [seo] = languageSetSteps(kernel, { members: MEMBERS, lang: 'en' });
    expect(seo?.args['value']).toEqual({
      canonicalPath: '/',
      alternates: [
        { lang: 'en', path: '/' },
        { lang: 'ar', path: '/ar' },
      ],
    });
  });
});

describe('pageContext', () => {
  it('reads planned writes over the live page and a version’s own direction', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const context = pageContext(kernel, [
      { command: 'setProp', args: { id: 'root', key: 'lang', value: 'en' } },
      {
        command: 'setProp',
        args: { id: 'root', key: 'seo', value: { alternates: [{ lang: 'en', path: '/en' }] } },
      },
    ]);
    expect(context.locale).toEqual({ lang: 'en', dir: 'ltr' });
    expect(pageContext(kernel).locale).toEqual({ lang: 'ar', dir: 'rtl' });
  });
});
