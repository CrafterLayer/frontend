import { describe, expect, it } from 'vitest';

import type { JsonValue } from '@craftkit/builder-schema';

import { NEIGHBOUR_SUMMARY_MAX_CHARS, summarizeNeighbours } from './neighbours';
import { validatePagePlan, type LandedSection, type PagePlan } from './index';

/*
  What a section writer is told about the sections around it (agent-audit
  P1-10): writers wrote blind, so the hero's proof numbers came back in the
  stats band and "Our Story" repeated "About". The summary rides in EVERY
  writer's prompt, so it is held to a hard character ceiling, and it must say
  plainly which neighbours are written and which are only planned — the old
  context called an empty placeholder "filled".
*/

function accepted(value: unknown): PagePlan {
  const result = validatePagePlan(value);
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return result.plan;
}

const TOKENS = {
  bg: 'white',
  surface: 'stone-50',
  ink: 'stone-900',
  muted: 'stone-600',
  accent: 'emerald-700',
  onAccent: 'white',
  border: 'stone-200',
  radius: 'md',
  signature: 'a hairline under every heading',
};

const CLINIC = accepted({
  intent: 'new-page',
  locale: { lang: 'ar' },
  title: 'عيادة الشفاء',
  description: 'عيادة أسنان في إربد.',
  tokens: {
    ...TOKENS,
    fontDisplay: { family: 'Readex Pro', weights: [600] },
    fontBody: { family: 'IBM Plex Sans Arabic', weights: [400] },
  },
  primaryCta: { label: 'احجز موعدك', href: '#book' },
  nav: [{ label: 'الخدمات', anchorId: 'services' }],
  sections: [
    { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'Nav.' },
    {
      key: 'hero',
      role: 'hero',
      title: 'ابتسامة تثق بها',
      anchorId: 'hero',
      purpose: 'Reassure and book.',
      mustSay: ['١٥ سنة خبرة'],
    },
    {
      key: 'services',
      role: 'band',
      title: 'الخدمات',
      anchorId: 'services',
      purpose: 'What the clinic treats, with prices.',
      mustSay: ['تبييض الأسنان', 'تقويم شفاف'],
    },
    {
      key: 'team',
      role: 'band',
      title: 'الفريق',
      anchorId: 'team',
      purpose: 'The dentists and their specialities.',
      mustSay: ['د. سلمى حداد'],
    },
    {
      key: 'reviews',
      role: 'band',
      title: 'آراء المرضى',
      anchorId: 'reviews',
      purpose: 'Three short patient quotes.',
    },
    { key: 'book', role: 'cta', title: 'احجز', anchorId: 'book', purpose: 'Book a visit.' },
    { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'Address.' },
  ],
  facts: [],
});

const STUDIO = accepted({
  intent: 'new-page',
  locale: { lang: 'en' },
  title: 'Northlight',
  description: 'A brand studio.',
  tokens: {
    ...TOKENS,
    fontDisplay: { family: 'Archivo Black' },
    fontBody: { family: 'Archivo', weights: [400] },
  },
  primaryCta: { label: 'Book a call', href: '#contact' },
  nav: [],
  sections: [
    {
      key: 'hero',
      role: 'hero',
      title: 'Brands that hold',
      anchorId: 'hero',
      purpose: 'Pitch the studio.',
      mustSay: ['40 brands since 2015'],
    },
    {
      key: 'work',
      role: 'band',
      title: 'Selected work',
      anchorId: 'work',
      purpose: 'Three case studies with results.',
      mustSay: ['Orbit: +38% sign-ups'],
    },
    { key: 'contact', role: 'cta', title: 'Contact', anchorId: 'contact', purpose: 'Convert.' },
  ],
  facts: [],
});

type Node = Record<string, JsonValue>;

function h(tag: string, content: string | Node[]): Node {
  return typeof content === 'string'
    ? { kind: 'element', tag, text: content }
    : { kind: 'element', tag, children: content };
}

function section(...children: Node[]): LandedSection {
  return { tree: { kind: 'root', children: [h('section', children)] } };
}

const CLINIC_HERO = section(
  h('h1', 'ابتسامة تثق بها في قلب إربد'),
  h('p', 'رعاية أسنان هادئة للعائلة كلها.'),
  h('ul', [h('li', '١٥ سنة خبرة'), h('li', '٤٠٠٠ مريض سعيد')]),
);

const CLINIC_SERVICES = section(
  h('h2', 'خدماتنا'),
  h('h3', 'تبييض الأسنان'),
  h('p', 'جلسة واحدة، ٩٠ دقيقة — ١٢٠ دينار'),
  h('h3', 'تقويم شفاف'),
  h('p', 'من ١٬٥٠٠ دينار'),
);

describe('summarizeNeighbours — what a writer knows about the sections around it', () => {
  it('summarises a written neighbour from what it SAYS, and a planned one from its contract', () => {
    const landed = new Map([['services', CLINIC_SERVICES]]);
    const summary = summarizeNeighbours(CLINIC, 3, landed);

    // Before: written — its headline and the claims already made, numbers first among them.
    expect(summary).toMatch(/^BEFORE/u);
    expect(summary).toContain('3/7');
    expect(summary).toContain('written');
    expect(summary).toContain('خدماتنا');
    expect(summary).toContain('تبييض الأسنان');
    expect(summary).toContain('١٢٠ دينار');
    // After: not written — its purpose and what it will say, and it says so.
    expect(summary).toContain('AFTER');
    expect(summary).toContain('5/7');
    expect(summary).toContain('آراء المرضى');
    expect(summary).toContain('not written yet');
    expect(summary).toContain('Three short patient quotes.');
    // The hero is neither neighbour, so it rides along, not yet written here.
    expect(summary).toContain('HERO');
    expect(summary).toContain('١٥ سنة خبرة');
    expect(summary.length).toBeLessThanOrEqual(NEIGHBOUR_SUMMARY_MAX_CHARS);
  });

  it('quotes a written hero’s own headline, never its contract title', () => {
    const landed = new Map([
      ['hero', CLINIC_HERO],
      ['services', CLINIC_SERVICES],
    ]);
    const summary = summarizeNeighbours(CLINIC, 4, landed);
    const hero = summary.split('\n').find((line) => line.startsWith('HERO')) ?? '';
    expect(hero).toContain('ابتسامة تثق بها في قلب إربد');
    expect(hero).toContain('٤٠٠٠ مريض سعيد');
    expect(hero).not.toContain('not written yet');
  });

  it('names chrome for what it is and spends no characters on it', () => {
    const summary = summarizeNeighbours(CLINIC, 1, new Map());
    const before = summary.split('\n').find((line) => line.startsWith('BEFORE')) ?? '';
    expect(before).toContain('site header');
    expect(before.length).toBeLessThan(80);
    // Section 2 is the hero itself: no HERO line about itself.
    expect(summary).not.toMatch(/^HERO/mu);
  });

  it.each([
    ['first', 0, ['AFTER'], ['BEFORE']],
    ['last', 2, ['BEFORE', 'HERO'], ['AFTER']],
  ])(
    'has no line for a neighbour that does not exist (%s section, English)',
    (_n, index, has, lacks) => {
      const summary = summarizeNeighbours(STUDIO, index, new Map());
      for (const label of has) expect(summary).toMatch(new RegExp(`^${label}`, 'mu'));
      for (const label of lacks) expect(summary).not.toMatch(new RegExp(`^${label}`, 'mu'));
      if (index === 0) expect(summary).toContain('Orbit: +38% sign-ups');
    },
  );

  it('never exceeds the ceiling, however much a neighbour wrote, and cuts on a mark', () => {
    const long = section(
      h('h2', 'An extremely long headline that goes on and on '.repeat(6)),
      ...Array.from({ length: 30 }, (_, index) =>
        h(
          'h3',
          `Claim number ${String(index)} with a figure of ${String(index * 7)}% that is long`,
        ),
      ),
    );
    const landed = new Map<string, LandedSection>([
      ['hero', long],
      ['contact', long],
    ]);
    const summary = summarizeNeighbours(STUDIO, 1, landed);
    expect(summary.length).toBeLessThanOrEqual(NEIGHBOUR_SUMMARY_MAX_CHARS);
    expect(summary).toContain('…');
    expect(summary).toMatch(/^BEFORE/mu);
    expect(summary).toMatch(/^AFTER/mu);
  });

  it('is empty for a position outside the plan, and deterministic for one inside it', () => {
    expect(summarizeNeighbours(STUDIO, -1, new Map())).toBe('');
    expect(summarizeNeighbours(STUDIO, 3, new Map())).toBe('');
    const landed = new Map([['services', CLINIC_SERVICES]]);
    expect(summarizeNeighbours(CLINIC, 3, landed)).toBe(summarizeNeighbours(CLINIC, 3, landed));
  });

  it('survives a neighbour whose landed tree is not a tree', () => {
    const landed = new Map<string, LandedSection>([['hero', { tree: 'garbage' }]]);
    const summary = summarizeNeighbours(STUDIO, 1, landed);
    expect(summary).toMatch(/^BEFORE/u);
    expect(summary).toContain('Brands that hold');
  });
});
