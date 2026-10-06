import { describe, expect, it } from 'vitest';

import { checkSection, tokeniseColourClasses, tokenisePaletteClasses } from './check-section';
import { validatePagePlan } from './validate-page-plan';
import type { PagePlan } from './types';

/*
  R-colour-class (fix pass 2026-10-05): a writer's bare palette class is moved
  onto the page's tokens in code, before the check — the English features
  writer's `bg-blue-50` cost a repair round while five finished sections
  waited to land behind it.
*/

function plan(): PagePlan {
  const result = validatePagePlan({
    intent: 'new-page',
    locale: { lang: 'en' },
    title: 'Invoicy — invoicing for freelancers',
    description: 'Send invoices and get paid faster.',
    tokens: { deckRowId: 'saas', signature: 'One headline word in the accent.' },
    primaryCta: { label: 'Start free trial', href: '#signup' },
    sections: [
      { key: 'hero', role: 'hero', title: 'Invoice in seconds' },
      { key: 'features', role: 'band', title: 'Features' },
      { key: 'signup', role: 'cta', title: 'Start' },
    ],
    briefs: [
      { key: 'hero', purpose: 'Say what Invoicy does.' },
      { key: 'features', purpose: 'The core features.' },
      { key: 'signup', purpose: 'One call to action.' },
    ],
  });
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('\n'));
  return result.plan;
}

describe('tokenisePaletteClasses', () => {
  const { tokens } = plan();

  it('moves a light ground onto the nearest token ground and text onto ink or muted', () => {
    expect(tokenisePaletteClasses('rounded-xl bg-blue-50 p-6', tokens)).toBe(
      'rounded-xl ck-surface p-6',
    );
    expect(tokenisePaletteClasses('text-slate-900 text-lg', tokens)).toBe('ck-ink text-lg');
    expect(tokenisePaletteClasses('border border-gray-200', tokens)).toBe('border ck-border');
  });

  it('drops one behind a variant or with an opacity, and keeps what already reads as a token', () => {
    expect(tokenisePaletteClasses('hover:bg-blue-50 bg-blue-500/10 px-4', tokens)).toBe('px-4');
    expect(tokenisePaletteClasses('bg-white text-black/60 ck-card', tokens)).toBe(
      'bg-white text-black/60 ck-card',
    );
  });

  it('returns the same list when nothing changes', () => {
    const list = 'flex gap-4 ck-surface';
    expect(tokenisePaletteClasses(list, tokens)).toBe(list);
  });

  it('rewrites trees and tree markup alike, and leaves an untouched value the same object', () => {
    const tree = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'bg-blue-50' }],
    };
    expect(tokeniseColourClasses(tree, tokens)).toEqual({
      kind: 'root',
      children: [{ kind: 'element', tag: 'div', className: 'ck-surface' }],
    });
    expect(tokeniseColourClasses("<div class='bg-blue-50 p-4'>x</div>", tokens)).toBe(
      "<div class='ck-surface p-4'>x</div>",
    );
    const clean = { id: 'r1', key: 'tree', value: { kind: 'root', children: [] } };
    expect(tokeniseColourClasses(clean, tokens)).toBe(clean);
  });

  it('leaves nothing for the checker to call raw-colour', () => {
    const page = plan();
    const contract = page.sections[1];
    if (contract === undefined) throw new Error('no features section');
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'bg-blue-50 py-16',
          attributes: { id: 'features' },
          children: [{ kind: 'element', tag: 'h2', className: 'text-slate-900', text: 'Features' }],
        },
      ],
    };
    const raw = (value: unknown) =>
      checkSection(page, contract, { tree: value as never }).filter(
        ({ code }) => code === 'raw-colour',
      );
    expect(raw(tree)).toHaveLength(1);
    expect(raw(tokeniseColourClasses(tree, page.tokens))).toEqual([]);
  });
});
