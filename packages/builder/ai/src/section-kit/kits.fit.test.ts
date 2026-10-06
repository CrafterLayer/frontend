import { describe, expect, it } from 'vitest';

import { PHONE_KIT } from '../agent/page-plan/skeleton-from-plan';
import { instantiateKit } from './instantiate';
import { phoneFitProblems, worstCaseSlots } from './kit-fit';
import { SECTION_KITS } from './kits';
import type { SectionKit } from './types';

/*
  No kit scrolls sideways on a phone (final test 2026-10-06: the English SaaS
  page was 404px wide at 390 — the "Trusted by teams" stats row set two large
  numbers side by side). Every kit, filled with its widest honest content in
  Arabic and English (14-letter words, ten-digit stats, prices, an email),
  is laid at 320, 360 and 390px by the phone-width model (kit-fit.ts).
*/

const WIDTHS = [320, 360, 390] as const;
const LOCALES = [
  { lang: 'ar' as const, dir: 'rtl' as const },
  { lang: 'en' as const, dir: 'ltr' as const },
];

function worstTree(kit: SectionKit, lang: 'ar' | 'en', dir: 'rtl' | 'ltr'): unknown {
  const result = instantiateKit(kit, worstCaseSlots(kit, lang), {
    id: 'section',
    heading: kit.role === 'hero' ? 'h1' : 'h2',
    locale: { lang, dir },
  });
  if (!result.ok) throw new Error(`${kit.id}: ${result.error}`);
  return result.tree;
}

const element = (tag: string, className: string, extra: Record<string, unknown> = {}) => ({
  kind: 'element',
  tag,
  className,
  ...extra,
});

describe('section kits at phone width', () => {
  it.each(SECTION_KITS.flatMap((kit) => LOCALES.map(({ lang, dir }) => [kit.id, lang, dir] as const)))(
    '%s (%s) fits 320, 360 and 390px with its widest content',
    (id, lang, dir) => {
      const kit = SECTION_KITS.find((candidate) => candidate.id === id);
      if (kit === undefined) throw new Error(id);
      const tree = worstTree(kit, lang, dir);
      for (const width of WIDTHS) {
        expect(phoneFitProblems(tree, { width, lang }), `${id} ${lang} @${String(width)}px`).toEqual([]);
      }
    },
  );

  it('catches the stats row that made the English page 404px wide at 390', () => {
    // The kit's markup before this fix: two text-4xl numbers in a gap-8 two-column grid.
    const stat = (value: string) =>
      element('div', 'border-t ck-border pt-6', {
        children: [element('dd', 'ck-display ck-accent-ink text-4xl font-bold tabular-nums', { text: value })],
      });
    const before = {
      kind: 'root',
      children: [
        element('section', 'ck-ground py-20 md:py-28', {
          children: [
            element('div', 'mx-auto max-w-6xl px-4 md:px-8', {
              children: [element('dl', 'mt-12 grid grid-cols-2 gap-8 md:grid-cols-4', { children: [stat('12,000+'), stat('99.98%')] })],
            }),
          ],
        }),
      ],
    };
    const problems = phoneFitProblems(before, { width: 390, lang: 'en' });
    expect(problems.map(({ what }) => what)).toContain('text "12,000+"');
    expect(problems[0]?.need).toBeGreaterThan(problems[0]?.room ?? Number.POSITIVE_INFINITY);
  });

  it('knows break-words wraps in a block but not in a flex row: min-w-0 does', () => {
    const row = (itemClass: string) => ({
      kind: 'root',
      children: [
        element('div', 'flex gap-2', {
          children: [
            { kind: 'icon', name: 'mail', size: 18 },
            element('a', itemClass, { text: 'reservations@yasmeen-restaurant.com' }),
          ],
        }),
      ],
    });
    expect(phoneFitProblems(row('break-words'), { width: 200 })).not.toEqual([]);
    expect(phoneFitProblems(row('min-w-0 break-words'), { width: 200 })).toEqual([]);
    const block = { kind: 'root', children: [element('p', 'break-words', { text: 'reservations@yasmeen-restaurant.com' })] };
    expect(phoneFitProblems(block, { width: 200 })).toEqual([]);
  });

  it('rests on the page kit: a button label wraps below 40rem, region text breaks long words', () => {
    const rules = PHONE_KIT.join('\n');
    expect(rules).toMatch(/@media \(max-width:39\.99rem\)\{\.ck-btn\{[^}]*white-space:normal/u);
    expect(rules).toMatch(/overflow-wrap:break-word/u);
  });
});
