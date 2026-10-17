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

  /*
    The claims are what the summary exists to carry: a writer who cannot see
    "يمن حرازي" in the section before writes it again. The purpose came first
    in each line and the cut fell at the line's end, so on this plan — the
    verifier's 7-section café, 2026-09-28 (neighbours-real.mjs) — section 4's
    summary dropped four claims while keeping 140 characters of every purpose.
    Now the purposes give way first.
  */
  const CAFE_SEVEN = accepted({
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'محمصة الهيل',
    description: 'قهوة مختصة في عمّان.',
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: '#E7E5E4',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'the brand name, faint behind the menu',
    },
    primaryCta: { label: 'اطلب الآن', href: '#order' },
    nav: [],
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'التنقل.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'قهوة تُحمّص كل صباح في قلب عمّان',
        anchorId: 'hero',
        purpose:
          'تعريف الزائر بالمحمصة ووعدها: قهوة مختصة طازجة تُحمّص يومياً وتصل إلى بابك خلال ساعتين داخل عمّان.',
        mustSay: ['محمصة مختصة في جبل عمّان', 'توصيل مجاني داخل عمّان', 'تحميص يومي'],
      },
      {
        key: 'origins',
        role: 'band',
        title: 'من أين تأتي حبوبنا',
        anchorId: 'origins',
        purpose:
          'عرض مصادر البن الثلاثة (إثيوبيا، كولومبيا، اليمن) مع ملاحظات التذوق لكل منها بشكل بطاقات بسيطة.',
        mustSay: ['إثيوبيا يرغاتشيفي', 'كولومبيا هويلا', 'يمن حرازي'],
        mustNotRepeat: ['تحميص يومي'],
      },
      {
        key: 'stats',
        role: 'band',
        title: 'أرقامنا',
        anchorId: 'stats',
        purpose:
          'إثبات اجتماعي بالأرقام: عدد العملاء، سنوات الخبرة، عدد أصناف البن المتوفرة حالياً في المتجر.',
        mustSay: ['أكثر من ١٢٠٠ عميل', '١٢ سنة خبرة', '١٥ صنفاً'],
        mustNotRepeat: ['توصيل مجاني داخل عمّان'],
      },
      {
        key: 'menu',
        role: 'band',
        title: 'القائمة',
        anchorId: 'menu',
        purpose:
          'المشروبات الأكثر طلباً مع أسعارها بالدينار الأردني، مرتبة من الأخف إلى الأقوى، مع علامة للأكثر مبيعاً.',
        mustSay: ['إسبريسو ١٫٥ د.أ', 'لاتيه ٢٫٥ د.أ', 'قهوة عربية ١ د.أ'],
      },
      {
        key: 'order',
        role: 'cta',
        title: 'اطلب قهوتك',
        anchorId: 'order',
        purpose: 'دعوة ختامية للطلب عبر الموقع مع تذكير بسرعة التوصيل.',
      },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'العنوان.' },
    ],
    facts: [],
  });

  /** A lone half of a surrogate pair: what a prompt renders as a replacement box. */
  const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

  it.each([2, 3, 4])(
    'keeps every neighbour’s claims whole on the verifier’s 7-section plan (section %i)',
    (index) => {
      const summary = summarizeNeighbours(CAFE_SEVEN, index, new Map());
      expect(summary.length).toBeLessThanOrEqual(NEIGHBOUR_SUMMARY_MAX_CHARS);
      const shown = [index - 1, index + 1, 1].filter((at) => at !== index);
      for (const at of shown) {
        for (const claim of CAFE_SEVEN.sections[at]?.mustSay ?? []) {
          expect(summary, `${String(at)}: ${claim}`).toContain(`"${claim}"`);
        }
      }
      // In each line the claims come first and the purpose after them: the purpose is what gives way.
      for (const at of shown) {
        const contract = CAFE_SEVEN.sections[at];
        if (contract === undefined || contract.mustSay.length === 0) continue;
        const own = summary.split('\n').find((line) => line.includes(`"${contract.title}"`)) ?? '';
        const purpose = own.indexOf(contract.purpose.slice(0, 12));
        expect(own.indexOf('Will say')).toBeGreaterThan(-1);
        if (purpose !== -1) expect(purpose).toBeGreaterThan(own.indexOf('Will say'));
      }
    },
  );

  it('gives three long unwritten neighbours all their claims, cutting their purposes instead', () => {
    const long = (label: string) =>
      `${label} 🍩 — ${'وصف طويل جداً لما يفعله هذا القسم ولماذا يوجد في الصفحة، '.repeat(8)}`.slice(
        0,
        400,
      );
    const plan = accepted({
      ...JSON.parse(JSON.stringify(CAFE_SEVEN)),
      sections: CAFE_SEVEN.sections.map((section, at) =>
        at >= 1 && at <= 4
          ? {
              ...section,
              title: `${'🍩'.repeat(12)} ${section.title}`.slice(0, 60),
              purpose: long(section.key),
              mustSay: [
                `ادعاء قصير ${String(at)}أ`,
                `ادعاء قصير ${String(at)}ب`,
                `ادعاء قصير ${String(at)}ج`,
              ],
            }
          : section,
      ),
    });
    const summary = summarizeNeighbours(plan, 3, new Map());
    expect(summary.length).toBeLessThanOrEqual(NEIGHBOUR_SUMMARY_MAX_CHARS);
    expect(summary).not.toMatch(LONE_SURROGATE);
    for (const at of [1, 2, 4]) {
      for (const claim of plan.sections[at]?.mustSay ?? []) expect(summary).toContain(`"${claim}"`);
    }
    // Each purpose was cut to fit (all three are 400 characters long), and the cut is marked.
    expect(summary.split('\n').every((line) => line.endsWith('…'))).toBe(true);
  });

  it('never splits a surrogate pair where it cuts, whatever the emoji', () => {
    const emoji = section(
      h('h2', `${'🍩'.repeat(150)} عنوان`),
      ...Array.from({ length: 6 }, (_, at) => h('h3', `${'☕️🍩'.repeat(40)} ${String(at)}`)),
    );
    const landed = new Map<string, LandedSection>([
      ['hero', emoji],
      ['work', emoji],
      ['contact', emoji],
    ]);
    for (const index of [0, 1, 2]) {
      const summary = summarizeNeighbours(STUDIO, index, landed);
      expect(summary.length).toBeLessThanOrEqual(NEIGHBOUR_SUMMARY_MAX_CHARS);
      expect(summary).not.toMatch(LONE_SURROGATE);
    }
  });
});
