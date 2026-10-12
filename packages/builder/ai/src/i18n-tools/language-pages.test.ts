import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { serializeTreeMarkup } from '../plan/tree-markup';
import { validateAiPlan } from '../plan/validate-plan';
import { partsKernel } from '../style-tools/part-tools.fixtures';
import { fixtureKernel, liveContext } from '../tools/agent/agent-tools.fixtures';
import type { AgentToolStep } from '../tools/agent/types';
import { languageSwitcherSteps, relinkSteps, versionAddress } from './language-pages';

/** The door's verdict on host steps, and what they write by `<id>.<key>`. */
function judge(kernel: BuilderKernel, steps: readonly AgentToolStep[]): Map<string, unknown> {
  const result = validateAiPlan({ rationale: 'language pages', commands: [...steps] }, kernel, {
    clock: fixedClock(2),
    ids: seededIds('i18n-pages'),
  });
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('; '));
  const out = new Map<string, unknown>();
  for (const step of result.plan.commands) {
    const args = step.args as { id?: string; key?: string; value?: unknown };
    out.set(`${args.id ?? ''}.${args.key ?? ''}`, args.value);
  }
  return out;
}

const markup = (value: unknown) => serializeTreeMarkup(value) ?? '';

const LINKS = [
  { lang: 'en', href: '/' },
  { lang: 'ar', href: '/ar' },
];

describe('versionAddress', () => {
  it('puts the language tag before the page path, the home at the bare tag', () => {
    expect(versionAddress('/', 'ar')).toBe('/ar');
    expect(versionAddress('/about', 'FR')).toBe('/fr/about');
    expect(versionAddress('menu/drinks', 'es')).toBe('/es/menu/drinks');
  });
});

describe('relinkSteps', () => {
  it('points internal links at the version, keeping fragments and leaving others alone', () => {
    const kernel = fixtureKernel();
    const steps = relinkSteps(liveContext(kernel), new Map([['#menu', '/ar#menu']]));
    expect(steps).toEqual([]);
    const pages = new Map([
      ['/start', '/ar/start'],
      ['/features', '/ar/features'],
    ]);
    const writes = judge(partsKernel(), relinkSteps(liveContext(partsKernel()), pages));
    expect(writes.get('cta-1.href')).toBe('/ar/start');
    expect(writes.get('features-1.link')).toEqual({
      label: 'See all features',
      href: '/ar/features',
    });
    expect(writes.has('cta-2.href')).toBe(false);
  });
});

describe('languageSwitcherSteps', () => {
  it('adds a switcher to the header, each language by its own name, the current one marked', () => {
    const kernel = fixtureKernel();
    const writes = judge(kernel, languageSwitcherSteps(liveContext(kernel), LINKS, 'en'));
    const header = markup(writes.get('r-header.tree'));
    expect(header).toContain("<nav class='flex items-center gap-3 text-sm' aria-label='Language'>");
    expect(header).toContain("dir='rtl' href='/ar' lang='ar'>العربية</a>");
    expect(header).toContain("aria-current='page' href='/' lang='en'>English</a>");
  });

  it('refreshes the switcher it wrote instead of adding a second one', () => {
    const kernel = fixtureKernel();
    const first = languageSwitcherSteps(liveContext(kernel), LINKS, 'en');
    const tree = first[0]?.args['value'];
    const context = {
      ...liveContext(kernel),
      readProp: (id: string, key: string) =>
        id === 'r-header' && key === 'tree' ? tree : liveContext(kernel).readProp(id, key),
    };
    const steps = languageSwitcherSteps(context, [...LINKS, { lang: 'fr', href: '/fr' }], 'en');
    const header = markup(steps[0]?.args['value']);
    expect(header.match(/<nav class='flex items-center/gu)).toHaveLength(1);
    expect(header).toContain('Français');
  });

  it('names the switcher in the page language', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    const writes = judge(kernel, languageSwitcherSteps(liveContext(kernel), LINKS, 'ar'));
    expect(markup(writes.get('r-header.tree'))).toContain("aria-label='اللغة'");
  });
});
