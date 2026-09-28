import { describe, expect, it } from 'vitest';

import type { JsonValue } from '@craftkit/builder-schema';

import { PHOTO_CATALOG } from '../../context/providers/photo-catalog';
import { checkSection } from './check-section';
import {
  validatePagePlan,
  type PagePlan,
  type SectionCheckCode,
  type SectionCheckIssue,
  type SectionContract,
} from './index';

/*
  The checker's messages ARE the writer's one repair round (agent-audit §3.1
  "E"): each row pins the code, where it points, and the instruction a writer
  can act on — "use ck-accent-ink", "label it exactly …" — not a bare verdict.
  Every rule is exercised in Arabic and in English, on a page whose accent reads
  as text (the café: orange-700, 5.00:1 on its ground) and on one whose accent
  does not (the builder: yellow-400 on white, 1.53:1 — the wave-1 measurement
  that made `accentInk` a token).
*/

function accepted(value: unknown): PagePlan {
  const result = validatePagePlan(value);
  if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
  return result.plan;
}

const CAFE = accepted({
  intent: 'new-page',
  locale: { lang: 'ar' },
  title: 'محمصة الهيل',
  description: 'قهوة مختصة محمصة في عمّان.',
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
  nav: [
    { label: 'القائمة', anchorId: 'menu' },
    { label: 'اطلب', anchorId: 'order' },
  ],
  sections: [
    {
      key: 'hero',
      role: 'hero',
      title: 'قهوة تُحمّص كل صباح',
      anchorId: 'hero',
      purpose: 'Say what the roastery is.',
      mustSay: ['محمصة في عمّان', 'تحميص يومي'],
      images: [{ subject: 'cafe', aspect: '16:9', alt: 'حبوب قهوة' }],
    },
    {
      key: 'menu',
      role: 'band',
      title: 'القائمة',
      anchorId: 'menu',
      purpose: 'The drinks.',
      mustSay: ['إسبريسو ١٫٥ د.أ'],
      mustNotRepeat: ['محمصة في عمّان'],
    },
    { key: 'order', role: 'cta', title: 'اطلب', anchorId: 'order', purpose: 'Order.' },
  ],
  facts: [],
});

const BUILDER = accepted({
  intent: 'new-page',
  locale: { lang: 'en' },
  title: 'Hadid Build',
  description: 'Residential construction in Amman.',
  tokens: {
    bg: 'white',
    surface: 'zinc-100',
    ink: 'zinc-900',
    muted: 'zinc-600',
    accent: 'yellow-400',
    onAccent: 'zinc-900',
    border: 'zinc-300',
    fontDisplay: { family: 'Archivo Black' },
    fontBody: { family: 'Archivo', weights: [400, 600] },
    radius: 'none',
    signature: 'a yellow rule under every heading',
  },
  primaryCta: { label: 'Get a quote', href: '#quote' },
  nav: [{ label: 'Projects', anchorId: 'projects' }],
  sections: [
    {
      key: 'hero',
      role: 'hero',
      title: 'Built to outlast',
      anchorId: 'hero',
      purpose: 'Pitch.',
      mustSay: ['Licensed since 2004'],
    },
    {
      key: 'projects',
      role: 'band',
      title: 'Projects',
      anchorId: 'projects',
      purpose: 'Proof.',
      mustSay: ['120 homes delivered'],
      mustNotRepeat: ['Licensed since 2004'],
    },
    { key: 'quote', role: 'cta', title: 'Quote', anchorId: 'quote', purpose: 'Convert.' },
  ],
  facts: [],
});

function contract(plan: PagePlan, key: string): SectionContract {
  const found = plan.sections.find((section) => section.key === key);
  if (found === undefined) throw new Error(`no section ${key}`);
  return found;
}

type Node = Record<string, JsonValue>;

/** An element: `h('p', 'ck-muted', 'text')` or `h('div', '', [children], { id })`. */
function h(
  tag: string,
  className: string,
  content: string | Node[] = [],
  attributes?: Record<string, string>,
): Node {
  return {
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(typeof content === 'string' ? { text: content } : { children: content }),
    ...(attributes === undefined ? {} : { attributes }),
  };
}

function tree(...children: Node[]): JsonValue {
  return { kind: 'root', children };
}

const CATALOG_URL = PHOTO_CATALOG[0]?.url ?? '';

/** A hero that honours its whole contract, in each language. */
function cafeHero(inner: Node[] = []): JsonValue {
  return tree(
    h('section', 'ck-ground relative py-24', [
      h('div', 'mx-auto max-w-6xl px-4', [
        h('p', 'ck-eyebrow', 'تحميص يومي'),
        // Written without the shadda and with ه for ة: the claim still counts.
        h('h1', 'text-5xl font-bold', 'قهوة تحمص كل صباح في محمصه في عمان'),
        h('p', 'ck-muted text-lg', 'حبوب مختارة من إثيوبيا وكولومبيا.'),
        h('a', 'ck-btn', 'اطلب الآن', { href: '#order' }),
        h('a', 'ck-btn ck-btn--ghost', 'القائمة', { href: '#menu' }),
        h('img', 'rounded-xl', [], { src: CATALOG_URL, alt: 'حبوب قهوة' }),
        ...inner,
      ]),
    ]),
  );
}

function builderHero(inner: Node[] = []): JsonValue {
  return tree(
    h('section', 'ck-ground py-24', [
      h('h1', 'text-6xl', 'Built to outlast'),
      h('p', 'ck-muted', 'Licensed since 2004 — family-run, on site every day.'),
      h('a', 'ck-btn', 'Get a quote', { href: '#quote' }),
      ...inner,
    ]),
  );
}

// Give the outer section its anchor id (kept apart so a row can drop it).
function withAnchor(value: JsonValue, id: string): JsonValue {
  const root = value as { children: Node[] };
  const [first, ...rest] = root.children;
  if (first === undefined) return value;
  return { kind: 'root', children: [{ ...first, attributes: { id } }, ...rest] };
}

function codes(issues: readonly SectionCheckIssue[]): SectionCheckCode[] {
  return issues.map(({ code }) => code);
}

function only(issues: readonly SectionCheckIssue[], code: SectionCheckCode): SectionCheckIssue {
  const found = issues.filter((issue) => issue.code === code);
  expect(codes(issues), JSON.stringify(issues, null, 1)).toEqual([code]);
  return found[0]!;
}

describe('checkSection — a landed section held to its contract', () => {
  it.each([
    ['Arabic', CAFE, 'hero', withAnchor(cafeHero(), 'hero')],
    ['English', BUILDER, 'hero', withAnchor(builderHero(), 'hero')],
  ])('passes a %s hero that honours its contract', (_language, plan, key, landed) => {
    expect(checkSection(plan, contract(plan, key), { tree: landed })).toEqual([]);
  });

  it('reads a tree written as markup, the way a writer proposes it', () => {
    const markup =
      "<section id='projects' class='ck-surface py-16'><h2 class='text-3xl'>Projects</h2><p class='ck-muted'>120 homes delivered across Amman.</p></section>";
    expect(checkSection(BUILDER, contract(BUILDER, 'projects'), { tree: markup })).toEqual([]);
  });

  describe('missing-anchor', () => {
    it.each([
      ['Arabic', CAFE, cafeHero()],
      ['English', BUILDER, builderHero()],
    ])('asks for the anchor id on the outer element (%s)', (_language, plan, landed) => {
      const issue = only(
        checkSection(plan, contract(plan, 'hero'), { tree: landed }),
        'missing-anchor',
      );
      expect(issue.message).toContain('id="hero"');
      expect(issue.path).toBe('tree.children[0].attributes.id');
    });

    it('names a link to a section that does not exist, and the ones that do', () => {
      const landed = withAnchor(builderHero([h('a', '', 'Pricing', { href: '#pricing' })]), 'hero');
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed }),
        'missing-anchor',
      );
      expect(issue.message).toContain('#pricing');
      expect(issue.message).toContain('#projects');
    });

    it('refuses another section’s anchor id, which would break its jump', () => {
      const landed = withAnchor(cafeHero([h('div', '', 'x', { id: 'menu' })]), 'hero');
      const issue = only(
        checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed }),
        'missing-anchor',
      );
      expect(issue.message).toContain('id="menu"');
      expect(issue.message).toContain('القائمة');
    });

    /*
      A section's own table of contents jumps inside the section: `#q1` to the
      answer that carries id q1. Verifier, 2026-09-28: flagged "points at no
      section", a repair round for a FAQ that worked.
    */
    it.each([
      ['Arabic', CAFE, 'menu', 'كم يستغرق التوصيل؟'],
      ['English', BUILDER, 'projects', 'How long does a villa take?'],
    ])('lets a link jump to an id inside its own section (%s)', (_l, plan, key, question) => {
      const claim = contract(plan, key).mustSay.join(' ');
      const landed = tree(
        h(
          'section',
          'ck-ground',
          [
            h('h2', '', 'x'),
            h('p', '', claim),
            h('a', 'ck-link', question, { href: '#q1' }),
            h('div', '', [h('h3', '', question)], { id: 'q1' }),
          ],
          { id: key },
        ),
      );
      expect(checkSection(plan, contract(plan, key), { tree: landed })).toEqual([]);
      // …while a jump to an id no section and no element carries is still broken.
      const broken = tree(
        h(
          'section',
          'ck-ground',
          [h('p', '', claim), h('a', 'ck-link', question, { href: '#q2' })],
          {
            id: key,
          },
        ),
      );
      expect(
        only(checkSection(plan, contract(plan, key), { tree: broken }), 'missing-anchor').message,
      ).toContain('#q2');
    });
  });

  describe('heading-level', () => {
    it.each([
      ['Arabic', CAFE, 'menu', h('h1', '', 'القائمة'), 'إسبريسو ١٫٥ د.أ'],
      ['English', BUILDER, 'projects', h('h1', '', 'Projects'), '120 homes delivered'],
    ])('turns a second h1 in a band into an h2 (%s)', (_l, plan, key, heading, claim) => {
      const landed = tree(h('section', 'ck-ground', [heading, h('p', '', claim)], { id: key }));
      const issue = only(
        checkSection(plan, contract(plan, key), { tree: landed }),
        'heading-level',
      );
      expect(issue.message).toMatch(/h2/u);
    });

    it('asks a hero without an h1 for one, and a hero with two to keep one', () => {
      const none = withAnchor(
        tree(
          h('section', '', [
            h('h2', '', 'Built to outlast'),
            h('p', '', 'Licensed since 2004.'),
            h('a', 'ck-btn', 'Get a quote', { href: '#quote' }),
          ]),
        ),
        'hero',
      );
      expect(
        only(checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: none }), 'heading-level')
          .message,
      ).toContain('h1');
      const two = withAnchor(builderHero([h('h1', '', 'Again')]), 'hero');
      expect(codes(checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: two }))).toEqual([
        'heading-level',
      ]);
    });
  });

  describe('cta-label', () => {
    it.each([
      ['Arabic', CAFE, cafeHero, 'اطلب', 'اطلب الآن', '#order'],
      ['English', BUILDER, builderHero, 'Get started', 'Get a quote', '#quote'],
    ])(
      'holds a link to the CTA target to the plan’s exact label (%s)',
      (_l, plan, hero, wrong, right, href) => {
        const landed = withAnchor(hero([h('a', 'ck-btn', wrong, { href })]), 'hero');
        const issue = only(
          checkSection(plan, contract(plan, 'hero'), { tree: landed }),
          'cta-label',
        );
        expect(issue.message).toContain(`"${right}"`);
        expect(issue.message).toContain(`"${wrong}"`);
      },
    );

    it('asks a closing CTA section with no action for the page’s action', () => {
      const landed = tree(
        h(
          'section',
          'ck-accent-fill',
          [h('h2', '', 'Quote'), h('p', '', 'Tell us about the plot.')],
          { id: 'quote' },
        ),
      );
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'quote'), { tree: landed }),
        'cta-label',
      );
      expect(issue.message).toContain('Get a quote');
      expect(issue.message).toContain('#quote');
    });

    // The action is its address AND its words: a button elsewhere is only a button.
    it.each([
      ['Arabic', CAFE, cafeHero, 'القائمة', '#menu'],
      ['English', BUILDER, builderHero, 'Projects', '#projects'],
    ])(
      'leaves a button to another section alone, whatever it says (%s)',
      (_l, plan, hero, words, href) => {
        const landed = withAnchor(hero([h('a', 'ck-btn', words, { href })]), 'hero');
        expect(checkSection(plan, contract(plan, 'hero'), { tree: landed })).toEqual([]);
      },
    );

    it.each([
      ['Arabic', CAFE, 'order', 'اطلب', '#menu'],
      ['English', BUILDER, 'quote', 'Quote', '#projects'],
    ])(
      'does not count the CTA’s words on a link to somewhere else as the action (%s)',
      (_l, plan, key, title, elsewhere) => {
        const link = h('a', 'ck-btn', plan.primaryCta.label, { href: elsewhere });
        const landed = tree(
          h('section', 'ck-accent-fill', [h('h2', '', title), link], { id: key }),
        );
        const issue = only(checkSection(plan, contract(plan, key), { tree: landed }), 'cta-label');
        expect(issue.message).toContain(`<a href='${plan.primaryCta.href}'`);
      },
    );

    it('turns a dead button carrying the CTA label into the link', () => {
      const landed = tree(
        h(
          'section',
          'ck-accent-fill',
          [h('h2', '', 'Quote'), h('button', 'ck-btn', 'Get a quote')],
          { id: 'quote' },
        ),
      );
      expect(
        only(checkSection(BUILDER, contract(BUILDER, 'quote'), { tree: landed }), 'cta-label')
          .message,
      ).toMatch(/link/u);
    });

    /*
      The renderer keeps `href` on an `a` only (CustomCode.tsx elementAttributes:
      `tag === 'a' ? safeHref(value) : undefined`), so a button written with the
      CTA's href ships as a button that goes nowhere. Verifier, 2026-09-28: this
      exact hero passed with [] before.
    */
    it.each([
      ['Arabic', CAFE, 'قهوة تحمص كل صباح في محمصة في عمّان', 'تحميص يومي'],
      ['English', BUILDER, 'Built to outlast', 'Licensed since 2004'],
    ])(
      'does not count a button with the CTA href as the action — the renderer drops its href (%s)',
      (_l, plan, headline, claim) => {
        const button = h('button', 'ck-btn', plan.primaryCta.label, {
          href: plan.primaryCta.href,
        });
        const landed = tree(
          h('section', 'ck-ground', [h('h1', '', headline), h('p', '', claim), button], {
            id: 'hero',
          }),
        );
        const issue = only(
          checkSection(plan, contract(plan, 'hero'), { tree: landed }),
          'cta-label',
        );
        expect(issue.message).toMatch(/link/u);
        expect(issue.message).toContain(`<a href='${plan.primaryCta.href}'`);
        expect(issue.path).toBe('tree.children[0].children[2]');
      },
    );

    it.each([
      ['Arabic', CAFE, cafeHero],
      ['English', BUILDER, builderHero],
    ])(
      'names a dead button that repeats the action even when a link already carries it (%s)',
      (_l, plan, hero) => {
        const landed = withAnchor(
          hero([h('button', 'ck-btn', plan.primaryCta.label, { href: plan.primaryCta.href })]),
          'hero',
        );
        expect(
          only(checkSection(plan, contract(plan, 'hero'), { tree: landed }), 'cta-label').message,
        ).toMatch(/link/u);
      },
    );

    // Written with the action's address, a button in other words is the same dead end.
    it.each([
      ['Arabic', CAFE, 'menu', 'اطلب قهوتك'],
      ['English', BUILDER, 'projects', 'Start now'],
    ])(
      'names a button aimed at the CTA target, whatever it says, as a dead action (%s)',
      (_l, plan, key, words) => {
        const claim = contract(plan, key).mustSay.join(' ');
        const button = h('button', 'ck-btn', words, { href: plan.primaryCta.href });
        const landed = tree(
          h('section', 'ck-ground', [h('h2', '', 'x'), h('p', '', claim), button], { id: key }),
        );
        const issue = only(checkSection(plan, contract(plan, key), { tree: landed }), 'cta-label');
        expect(issue.message).toContain(`<a href='${plan.primaryCta.href}'`);
        expect(issue.path).toBe('tree.children[0].children[2]');
      },
    );

    /*
      A filled card that links to the order section is a card, not a button:
      the verifier's menu card `<a class='block bg-white p-6 rounded-xl'
      href='#order'>` was told to relabel itself "اطلب الآن".
    */
    it.each([
      [
        'Arabic',
        CAFE,
        'menu',
        h('a', 'block bg-white p-6 rounded-xl', [h('h3', '', 'إسبريسو'), h('p', '', '١٫٥ د.أ')], {
          href: '#order',
        }),
      ],
      [
        'English',
        BUILDER,
        'projects',
        h(
          'a',
          'block bg-zinc-100 p-6',
          [h('h3', '', 'Villa in Dabouq'), h('p', '', '120 homes delivered')],
          { href: '#quote' },
        ),
      ],
      // A filled banner link whose words are a sentence, not a button's label.
      [
        'Arabic banner',
        CAFE,
        'menu',
        h(
          'a',
          'block bg-white p-4',
          'اطلب كيس قهوة من محمصتنا واستلمه طازجاً من المحل في جبل عمّان',
          {
            href: '#order',
          },
        ),
      ],
      [
        'English banner',
        BUILDER,
        'projects',
        h(
          'a',
          'block bg-zinc-100 p-4',
          'Request a free site visit and a written quote for your plot',
          {
            href: '#quote',
          },
        ),
      ],
    ])('leaves a filled card that links to the CTA target alone (%s)', (_l, plan, key, card) => {
      const claim = contract(plan, key).mustSay.join(' ');
      const landed = tree(
        h('section', 'ck-ground', [h('h2', '', 'x'), h('p', '', claim), card], { id: key }),
      );
      expect(checkSection(plan, contract(plan, key), { tree: landed })).toEqual([]);
    });

    it('still holds a filled link shaped as a button to the CTA label', () => {
      const landed = tree(
        h(
          'section',
          'ck-ground',
          [
            h('h2', '', 'Projects'),
            h('p', '', '120 homes delivered'),
            h('a', 'bg-yellow-400 px-6 py-3 font-semibold', 'Start now', { href: '#quote' }),
          ],
          { id: 'projects' },
        ),
      );
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'projects'), { tree: landed }),
        'cta-label',
      );
      expect(issue.message).toContain('"Start now"');
    });

    /*
      The hero is where a visitor decides: it must carry the page's action as
      much as the closing CTA does. Verifier's mutant V8 (the rule held to
      role 'cta' alone) passed the whole suite, 2026-09-28.
    */
    it.each([
      ['Arabic', CAFE, 'قهوة تحمص كل صباح في محمصة في عمّان', 'تحميص يومي'],
      ['English', BUILDER, 'Built to outlast', 'Licensed since 2004'],
    ])('asks a hero with no action for the page’s action (%s)', (_l, plan, headline, claim) => {
      const landed = tree(
        h('section', 'ck-ground', [h('h1', '', headline), h('p', '', claim)], { id: 'hero' }),
      );
      const issue = only(checkSection(plan, contract(plan, 'hero'), { tree: landed }), 'cta-label');
      expect(issue.message).toContain("Add the page's action");
      expect(issue.message).toContain(`<a href='${plan.primaryCta.href}' class='ck-btn'>`);
      expect(issue.message).toContain(plan.primaryCta.label);
    });

    /*
      The action's WORDS on a link that goes elsewhere: a visitor who presses
      it expects the action. Verifier, 2026-09-28: in a band this passed with
      [], and in a hero the only issue asked for a second button beside it.
    */
    it.each([
      ['Arabic band', CAFE, 'menu', 'ck-btn', '#menu'],
      ['English band', BUILDER, 'projects', 'ck-btn', 'https://hadid.jo/contact'],
      ['Arabic ghost button', CAFE, 'menu', 'ck-btn ck-btn--ghost', '#hero'],
      ['English text link', BUILDER, 'projects', 'ck-link', '#projects'],
    ])(
      'points the action’s words back at the action, wherever they sit (%s)',
      (_l, plan, key, className, elsewhere) => {
        const claim = contract(plan, key).mustSay.join(' ');
        const link = h('a', className, plan.primaryCta.label, { href: elsewhere });
        const landed = tree(
          h('section', 'ck-ground', [h('h2', '', 'x'), h('p', '', claim), link], { id: key }),
        );
        const issue = only(checkSection(plan, contract(plan, key), { tree: landed }), 'cta-label');
        expect(issue.message).toContain(`leads to ${elsewhere}`);
        expect(issue.message).toContain(`<a href='${plan.primaryCta.href}'`);
        expect(issue.path).toBe('tree.children[0].children[2].attributes.href');
      },
    );

    it.each([
      ['Arabic', CAFE, 'قهوة تحمص كل صباح في محمصة في عمّان', 'تحميص يومي'],
      ['English', BUILDER, 'Built to outlast', 'Licensed since 2004'],
    ])(
      'asks a hero to re-point its misdirected action, not to add a second one (%s)',
      (_l, plan, headline, claim) => {
        const link = h('a', 'ck-btn', plan.primaryCta.label, { href: '#hero' });
        const landed = tree(
          h('section', 'ck-ground', [h('h1', '', headline), h('p', '', claim), link], {
            id: 'hero',
          }),
        );
        const issue = only(
          checkSection(plan, contract(plan, 'hero'), { tree: landed }),
          'cta-label',
        );
        expect(issue.message).toContain('leads to #hero');
        expect(issue.message).not.toContain("Add the page's action");
      },
    );

    // The action's words, folded: an arrow after them, or no hamza, is still the label.
    it.each([
      ['Arabic, no hamza', CAFE, cafeHero, 'اطلب الان'],
      ['English, an arrow glyph', BUILDER, builderHero, 'Get a quote →'],
      ['English, capitals', BUILDER, builderHero, 'GET A QUOTE'],
      /*
        Wrapped in bidi isolates (FSI … PDI), as a right-to-left writer does
        around a mixed-script label: still the action. The verifier's mutant
        V5 (isolates left in the label) survived the suite, 2026-09-28.
      */
      ['Arabic, in bidi isolates', CAFE, cafeHero, '\u2068اطلب الآن\u2069'],
      ['English, a mark before it', BUILDER, builderHero, '\u200EGet a quote'],
    ])('reads the action’s words however they are typed (%s)', (_l, plan, hero, words) => {
      const landed = withAnchor(hero(), 'hero');
      // Swap the hero's own action for the variant spelling.
      const swapped = JSON.parse(
        JSON.stringify(landed).replace(
          JSON.stringify(plan.primaryCta.label),
          JSON.stringify(words),
        ),
      ) as JsonValue;
      expect(checkSection(plan, contract(plan, 'hero'), { tree: swapped })).toEqual([]);
    });

    /*
      The action's address, however it is typed: a trailing slash, the host's
      case, a phone's spacing lead to the same place. An exact compare flagged
      each as "leads to" somewhere else — a repair model call for a button
      that worked.
    */
    it.each([
      ['a trailing slash', 'https://wa.me/962791234567', 'https://wa.me/962791234567/'],
      ['the host in capitals', 'https://wa.me/962791234567', 'https://WA.ME/962791234567'],
      ['a phone’s spacing', 'tel:+96264612750', 'tel:+962 6 461 2750'],
      ['Arabic-Indic digits in a phone', 'tel:+96264612750', 'tel:+٩٦٢٦٤٦١٢٧٥٠'],
    ])('reads the action’s address however it is typed (%s)', (_name, target, written) => {
      const plan: PagePlan = {
        ...BUILDER,
        primaryCta: { label: BUILDER.primaryCta.label, href: target },
      };
      const landed = JSON.parse(
        JSON.stringify(withAnchor(builderHero(), 'hero')).replace(
          '"#quote"',
          JSON.stringify(written),
        ),
      ) as JsonValue;
      expect(checkSection(plan, contract(plan, 'hero'), { tree: landed })).toEqual([]);
    });

    it('still names an address that differs in its path', () => {
      const plan: PagePlan = {
        ...BUILDER,
        primaryCta: { label: BUILDER.primaryCta.label, href: 'https://wa.me/962791234567' },
      };
      const landed = JSON.parse(
        JSON.stringify(withAnchor(builderHero(), 'hero')).replace(
          '"#quote"',
          '"https://wa.me/962791234568"',
        ),
      ) as JsonValue;
      const issue = only(checkSection(plan, contract(plan, 'hero'), { tree: landed }), 'cta-label');
      expect(issue.message).toContain('leads to https://wa.me/962791234568');
    });
  });

  describe('placeholder-left', () => {
    it.each([
      ['Arabic bracket', CAFE, 'menu', 'إسبريسو ١٫٥ د.أ — [السعر]', '[السعر]'],
      [
        'English bracket',
        BUILDER,
        'projects',
        '120 homes delivered by [Client Name]',
        '[Client Name]',
      ],
      [
        'Latin filler',
        BUILDER,
        'projects',
        '120 homes delivered. Lorem ipsum dolor sit amet.',
        'Lorem',
      ],
      [
        'Arabic filler',
        CAFE,
        'menu',
        'إسبريسو ١٫٥ د.أ. هذا النص هو مثال لنص يمكن أن يستبدل في نفس المساحة',
        'هذا النص هو مثال',
      ],
      [
        'scaffold text',
        BUILDER,
        'projects',
        'THE SECTION TITLE — 120 homes delivered',
        'THE SECTION TITLE',
      ],
    ])('flags %s', (_name, plan, key, text, quoted) => {
      const landed = tree(
        h('section', 'ck-ground', [h('h2', '', 'x'), h('p', '', text)], { id: key }),
      );
      const issue = only(
        checkSection(plan, contract(plan, key), { tree: landed }),
        'placeholder-left',
      );
      expect(issue.message).toContain(quoted);
    });

    /*
      Facts written as their stand-ins. Four of five live Dubai plans of
      2026-09-28 sampled the phone as "+971 4 XXX XXXX", and a writer puts the
      sample on the page as given; none of the placeholder patterns read a
      mask, so it shipped.
    */
    function factSection(plan: PagePlan, key: string, lines: readonly Node[]): JsonValue {
      const claim = contract(plan, key).mustSay.join(' ');
      return tree(h('section', 'ck-ground', [h('p', '', claim), ...lines], { id: key }));
    }

    it.each([
      [
        'a masked phone (English)',
        BUILDER,
        'projects',
        'Call +971 4 XXX XXXX',
        'Call +971 4 XXX XXXX',
      ],
      ['a masked mobile (Arabic)', CAFE, 'menu', 'واتساب: 07XXXXXXXX', 'واتساب: 07XXXXXXXX'],
      ['masked digits', CAFE, 'menu', 'هاتف: ٠٠٠٠٠٠٠', 'هاتف: ٠٠٠٠٠٠٠'],
      ['a run of zeros', BUILDER, 'projects', 'Phone: +962 7 9000 0000', 'Phone: +962 7 9000 0000'],
      ['the field’s name (Arabic)', CAFE, 'menu', 'رقم الهاتف', 'رقم الهاتف'],
      ['the field’s name after a label', CAFE, 'menu', 'الهاتف: رقم الهاتف', 'الهاتف: رقم الهاتف'],
      ['the field’s name (English)', BUILDER, 'projects', 'Company name', 'Company name'],
      ['an example address', BUILDER, 'projects', 'Write to info@example.com', 'info@example.com'],
      // The template's instruction before the field's name is the stand-in all the same.
      [
        'an instruction and the field (Arabic)',
        CAFE,
        'menu',
        'ضع رقم هاتفك هنا',
        'ضع رقم هاتفك هنا',
      ],
      [
        'an instruction and the field (English)',
        BUILDER,
        'projects',
        'Enter your phone number',
        'Enter your phone number',
      ],
      ['a counting run', BUILDER, 'projects', 'Call +962 79 123 4567', 'Call +962 79 123 4567'],
      [
        'a placeholder business domain',
        BUILDER,
        'projects',
        'hello@yourbusiness.com',
        'hello@yourbusiness.com',
      ],
    ])('flags a fact left as its stand-in: %s', (_name, plan, key, text, quoted) => {
      const landed = factSection(plan, key, [h('p', '', text)]);
      const issue = only(
        checkSection(plan, contract(plan, key), { tree: landed }),
        'placeholder-left',
      );
      expect(issue.message).toContain(quoted);
      expect(issue.message).toMatch(/realistic value/u);
    });

    it('flags a stand-in address a link leads to, but never the plan’s own action', () => {
      const landed = factSection(BUILDER, 'projects', [
        h('a', 'ck-link', 'Email us', { href: 'mailto:hello@example.com' }),
      ]);
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'projects'), { tree: landed }),
        'placeholder-left',
      );
      expect(issue.path).toBe('tree.children[0].children[1].attributes.href');
      const own: PagePlan = {
        ...BUILDER,
        primaryCta: { label: 'Email us', href: 'mailto:hello@example.com' },
      };
      expect(checkSection(own, contract(own, 'projects'), { tree: landed })).toEqual([]);
    });

    it.each([
      ['a real phone', BUILDER, 'projects', [h('p', '', 'Call +962 6 461 2750')]],
      ['a real Arabic phone', CAFE, 'menu', [h('p', '', 'اتصل بنا: ٠٦ ٤٦١ ٢٧٥٠')]],
      ['a round price', BUILDER, 'projects', [h('p', '', 'Villas from 1,000,000 JD')]],
      ['clothing sizes', BUILDER, 'projects', [h('p', '', 'Sizes S to XXL')]],
      ['opening hours', CAFE, 'menu', [h('p', '', 'من ٠٩:٠٠ حتى ٠٠:٠٠')]],
      // A field's name beside its value is a label, not a stand-in.
      [
        'a label beside the number',
        CAFE,
        'menu',
        [h('p', '', 'رقم الهاتف'), h('p', '', '+962 6 461 2750')],
      ],
      ['a form label', BUILDER, 'projects', [h('label', '', 'Phone number')]],
      // A sentence that asks for the number is copy, not a stand-in for it.
      [
        'a sentence asking for the number',
        BUILDER,
        'projects',
        [h('p', '', 'Enter your phone number and we call you back within the hour.')],
      ],
      [
        'a real number with a short count in it',
        BUILDER,
        'projects',
        [h('p', '', 'Call +962 6 512 3456')],
      ],
    ])('leaves a real value alone: %s', (_name, plan, key, lines) => {
      const landed = factSection(plan, key, lines);
      expect(checkSection(plan, contract(plan, key), { tree: landed })).toEqual([]);
    });
  });

  describe('foreign-image', () => {
    const memory = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1600';

    it.each([
      ['Arabic', CAFE, cafeHero, 'حبوب'],
      ['English', BUILDER, builderHero, 'site'],
    ])('flags a stock address the catalog never gave (%s)', (_l, plan, hero, alt) => {
      const landed = withAnchor(hero([h('img', '', [], { src: memory, alt })]), 'hero');
      const issue = only(
        checkSection(plan, contract(plan, 'hero'), { tree: landed }),
        'foreign-image',
      );
      expect(issue.message).toContain(memory);
      expect(issue.path).toMatch(/attributes\.src$/u);
    });

    it('admits a catalog photo, a data: URI, and an address the person’s request gave', () => {
      const landed = withAnchor(
        builderHero([
          h('img', '', [], { src: CATALOG_URL.replaceAll('&', '&amp;'), alt: 'a' }),
          h('img', '', [], { src: 'data:image/svg+xml,%3Csvg/%3E', alt: 'b' }),
          h('img', '', [], { src: memory, alt: 'c' }),
        ]),
        'hero',
      );
      const request = `Use my photo ${memory} in the hero`;
      expect(
        checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed }, { request }),
      ).toEqual([]);
    });

    it('reads background photos in the region css too', () => {
      const landed = withAnchor(builderHero(), 'hero');
      const css = `.ck-hero-bg{background-image:url("${memory}")}`;
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed, css }),
        'foreign-image',
      );
      expect(issue.path).toBe('css');
    });

    /*
      The playground's live Tailwind oracle generates arbitrary values, so the
      door admits `bg-[url('…')]` — and a photo from memory there passed
      unread (verifier, 2026-09-28).
    */
    it.each([
      ['Arabic, quoted', CAFE, cafeHero, `bg-[url('${memory}')] bg-cover`],
      ['English, bare', BUILDER, builderHero, `md:bg-[url(${memory})]`],
      ['English, arbitrary property', BUILDER, builderHero, `[background-image:url("${memory}")]`],
    ])('reads a photo written in an arbitrary class (%s)', (_l, plan, hero, className) => {
      const landed = withAnchor(hero([h('div', className, 'x')]), 'hero');
      const issue = only(
        checkSection(plan, contract(plan, 'hero'), { tree: landed }),
        'foreign-image',
      );
      expect(issue.message).toContain(memory);
      expect(issue.path).toMatch(/\.className$/u);
    });

    it('admits a catalog photo in an arbitrary class', () => {
      const landed = withAnchor(
        builderHero([h('div', `bg-[url('${CATALOG_URL}')] bg-cover`, 'x')]),
        'hero',
      );
      expect(checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed })).toEqual([]);
    });
  });

  describe('raw-colour', () => {
    it.each([
      ['Arabic', CAFE, cafeHero],
      ['English', BUILDER, builderHero],
    ])(
      'names palette and site-role classes that are not the page’s colours (%s)',
      (_l, plan, hero) => {
        const landed = withAnchor(
          hero([h('div', 'bg-amber-500 md:hover:text-sky-700 border-accent', 'x')]),
          'hero',
        );
        const issue = only(
          checkSection(plan, contract(plan, 'hero'), { tree: landed }),
          'raw-colour',
        );
        expect(issue.message).toContain('bg-amber-500');
        expect(issue.message).toContain('md:hover:text-sky-700');
        expect(issue.message).toContain('border-accent');
        expect(issue.message).toContain('ck-accent-ink');
      },
    );

    it('admits a palette class that IS a token, black and white, and var(--ck-*) values', () => {
      const landed = withAnchor(
        cafeHero([
          h('p', 'text-emerald-950 border-emerald-800/20', 'x'),
          h('div', 'bg-black/50 text-white', 'y'),
          h('div', 'bg-[var(--ck-surface)] text-[var(--ck-ink)]', 'z'),
        ]),
        'hero',
      );
      expect(checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed })).toEqual([]);
    });

    it('reads colour literals in the region css, and lets token hex and var() through', () => {
      const landed = withAnchor(builderHero(), 'hero');
      const css =
        '#hero .ck-rule{border-color:#facc15;color:#18181b}.ck-glow{box-shadow:0 0 0 4px rgba(0,0,0,.2);background:hsl(280 80% 60%);outline-color:#ff00aa}';
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed, css }),
        'raw-colour',
      );
      expect(issue.message).toContain('hsl(280 80% 60%)');
      expect(issue.message).toContain('#ff00aa');
      expect(issue.message).not.toContain('#facc15');
      expect(issue.path).toBe('css');
    });

    // A colour by NAME is a colour literal too (verifier, 2026-09-28: all of these passed).
    it.each([
      ['Arabic', CAFE, cafeHero, 'text-[crimson]'],
      ['English, with opacity', BUILDER, builderHero, 'bg-[gold]/50'],
      ['English, arbitrary property', BUILDER, builderHero, '[color:tomato]'],
    ])('names a named-colour class (%s)', (_l, plan, hero, className) => {
      const landed = withAnchor(hero([h('p', className, 'x')]), 'hero');
      const issue = only(
        checkSection(plan, contract(plan, 'hero'), { tree: landed }),
        'raw-colour',
      );
      expect(issue.message).toContain(className);
    });

    it.each([
      ['Arabic', CAFE, cafeHero],
      ['English', BUILDER, builderHero],
    ])(
      'names named colours in the region css, past urls, vars and strings (%s)',
      (_l, plan, hero) => {
        const landed = withAnchor(hero(), 'hero');
        const css =
          ".ck-x{color:crimson;background:gold url('data:image/svg+xml,red-dot')}.ck-y{border:1px solid var(--tan);box-shadow:0 0 0 1px navy}.ck-z{content:'red';color:var(--ck-ink);background:transparent}";
        const issue = only(
          checkSection(plan, contract(plan, 'hero'), { tree: landed, css }),
          'raw-colour',
        );
        expect(issue.message).toContain('crimson, gold, navy');
        expect(issue.message).not.toMatch(/\bred\b|\btan\b/u);
        expect(issue.path).toBe('css');
      },
    );
  });

  describe('contrast', () => {
    it('sends accent-coloured text to accentInk when the accent does not read as text', () => {
      // yellow-400 on white is 1.53:1; the plan's accentInk is the ink.
      expect(BUILDER.tokens.accentInk).toBe(BUILDER.tokens.ink);
      const landed = withAnchor(builderHero([h('p', 'text-yellow-400 text-4xl', '120')]), 'hero');
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed }),
        'contrast',
      );
      expect(issue.message).toContain('ck-accent-ink');
      expect(issue.message).toContain('text-yellow-400');
    });

    it('lets the café use its accent as text, because orange-700 reads on both its grounds', () => {
      const landed = withAnchor(cafeHero([h('p', 'text-orange-700', '١٫٥')]), 'hero');
      expect(checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed })).toEqual([]);
    });

    it('measures a known text colour on a known ground and gives the ratio', () => {
      const landed = withAnchor(
        builderHero([h('div', 'bg-yellow-400', [h('p', 'text-white', 'Free site visit')])]),
        'hero',
      );
      const issue = only(
        checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed }),
        'contrast',
      );
      expect(issue.message).toMatch(/1\.\d\d:1/u);
      expect(issue.path).toBe('tree.children[0].children[3].children[0]');
    });

    /*
      orange-700 on the café's border colour is 4.12:1 (measured 2026-09-28 with
      contrastRatio): short of 4.5 for body text, enough for display text.
    */
    it.each([
      ['display size passes at 3:1', 'text-2xl', []],
      ['body size needs 4.5:1', 'text-base', ['contrast']],
    ])('%s', (_name, size, expected) => {
      const landed = withAnchor(
        cafeHero([h('div', 'bg-[#e7e5e4]', [h('p', `text-orange-700 ${size}`, '١٫٥ د.أ')])]),
        'hero',
      );
      expect(codes(checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed }))).toEqual(expected);
    });

    // One pair, one issue: the same failing pair on every card is one repair, not six.
    it('reports a failing text pair once, however many elements repeat it', () => {
      const landed = withAnchor(
        cafeHero([h('p', 'text-white', 'واحد'), h('p', 'text-white', 'اثنان')]),
        'hero',
      );
      const issue = only(checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed }), 'contrast');
      expect(issue.path).toBe('tree.children[0].children[0].children[6]');
    });

    it('does not guess a ground under a photo: white text over an image layer is not measured', () => {
      const landed = withAnchor(
        tree(
          h('section', 'ck-ground relative', [
            h('img', 'absolute inset-0', [], { src: CATALOG_URL, alt: 'site' }),
            h('div', 'relative', [
              h('h1', 'text-white', 'Built to outlast'),
              h('p', 'text-white', 'Licensed since 2004.'),
              h('a', 'ck-btn', 'Get a quote', { href: '#quote' }),
            ]),
          ]),
        ),
        'hero',
      );
      expect(checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed })).toEqual([]);
    });
  });

  describe('must-say and repeats', () => {
    it.each([
      ['Arabic', CAFE, 'menu', 'قهوة مختصة', 'إسبريسو ١٫٥ د.أ'],
      ['English', BUILDER, 'projects', 'Our work', '120 homes delivered'],
    ])('asks for a missing claim, quoted (%s)', (_l, plan, key, text, claim) => {
      const landed = tree(h('section', 'ck-ground', [h('h2', '', text)], { id: key }));
      const issue = only(checkSection(plan, contract(plan, key), { tree: landed }), 'must-say');
      expect(issue.message).toContain(`"${claim}"`);
    });

    it('matches claims however they are spelled: hamza, taa marbuta, digits, case, suffixes', () => {
      const landed = tree(
        h('section', 'ck-ground', [h('h2', '', 'القائمة'), h('p', '', 'اسبريسو 1٫5 د.ا')], {
          id: 'menu',
        }),
      );
      expect(checkSection(CAFE, contract(CAFE, 'menu'), { tree: landed })).toEqual([]);
      const english = tree(
        h(
          'section',
          'ck-ground',
          [h('h2', '', 'Projects'), h('p', '', 'We have DELIVERED 120 new homes.')],
          { id: 'projects' },
        ),
      );
      expect(checkSection(BUILDER, contract(BUILDER, 'projects'), { tree: english })).toEqual([]);
    });

    it.each([
      ['Arabic', CAFE, 'menu', 'إسبريسو ١٫٥ د.أ من محمصة في عمان', 'محمصة في عمّان'],
      [
        'English',
        BUILDER,
        'projects',
        '120 homes delivered — licensed since 2004',
        'Licensed since 2004',
      ],
    ])('flags a claim another section already makes (%s)', (_l, plan, key, text, claim) => {
      const landed = tree(
        h('section', 'ck-ground', [h('h2', '', 'x'), h('p', '', text)], { id: key }),
      );
      const issue = only(checkSection(plan, contract(plan, key), { tree: landed }), 'repeats');
      expect(issue.message).toContain(`"${claim}"`);
    });

    /*
      Every false verdict here costs the writer a model repair round for a
      section that was right (or ships one that was wrong). Rows from the
      verifier's probe of 2026-09-28 (mustsay.mjs), each reproduced before the
      fix: thousands separators read as two numbers, "20" found inside "2020",
      "7" inside "17", a stat's "+" not reading as "more than", and three common
      words scattered across a section reading as a repeated claim.
    */
    function band(key: string, texts: readonly string[]): JsonValue {
      return tree(
        h(
          'section',
          'ck-ground',
          texts.map((text) => h('p', '', text)),
          { id: key },
        ),
      );
    }

    function said(
      plan: PagePlan,
      key: string,
      claims: { mustSay?: string[]; mustNotRepeat?: string[] },
      texts: readonly string[],
    ): SectionCheckCode[] {
      const held: SectionContract = {
        ...contract(plan, key),
        mustSay: claims.mustSay ?? [],
        mustNotRepeat: claims.mustNotRepeat ?? [],
      };
      return codes(checkSection(plan, held, { tree: band(key, texts) }));
    }

    it.each([
      // Digit-group separators: one number, however it is grouped.
      ['English comma', BUILDER, 'projects', '1200 customers', 'Trusted by 1,200 customers', []],
      ['Arabic separator ٬', CAFE, 'menu', 'أكثر من ١٢٠٠ عميل', 'أكثر من ١٬٢٠٠ عميل', []],
      ['thin space', BUILDER, 'projects', '1200 customers', 'Trusted by 1\u2009200 customers', []],
      ['narrow no-break space', CAFE, 'menu', '١٢٠٠ عميل', 'ثقة ١\u202F٢٠٠ عميل', []],
      // The stat form: "+" for "more than", once the number itself is there.
      ['Arabic stat +', CAFE, 'menu', 'أكثر من ١٢٠٠ عميل', '+١٢٠٠ عميل', []],
      ['English stat +', BUILDER, 'projects', 'More than 1200 customers', '+1,200 customers', []],
      // …and the other way round: the plan's stat, said in words.
      ['Arabic + in the claim', CAFE, 'menu', '+١٢٠٠ عميل', 'أكثر من ١٬٢٠٠ عميل', []],
      ['Arabic + after the number', CAFE, 'menu', '١٢٠٠+ عميل', 'أكثر من ١٬٢٠٠ عميل', []],
      [
        'English + in the claim',
        BUILDER,
        'projects',
        '+1200 customers',
        'More than 1,200 customers',
        [],
      ],
      // A number is whole: 7 is not inside 17, 2 is not inside 12.
      ['English 7 in 17', BUILDER, 'projects', 'Open 7 days', 'Open 17 days a year', ['must-say']],
      ['Arabic ٢ in ١٢', CAFE, 'menu', 'ضمان ٢ سنة', 'ضمان ١٢ سنة على كل آلة', ['must-say']],
      ['decimal 1.5 is not 15', CAFE, 'menu', 'إسبريسو ١٫٥ د.أ', 'إسبريسو ١٥ د.أ', ['must-say']],
      // A percentage is its figure AND its sign, whichever script writes the sign.
      ['Arabic ٪ is %', CAFE, 'menu', 'خصم 20% على الطلب الأول', 'خصم ٢٠٪ على الطلب الأول', []],
      [
        'English 20% is not 20',
        BUILDER,
        'projects',
        '20% off the first order',
        'Save 20 dollars off the first order',
        ['must-say'],
      ],
      // ة written ت before a suffix (محمصة → محمصتنا): the stem counts.
      ['taa marbuta stem', CAFE, 'menu', 'محمصة في عمّان', 'تعالوا إلى محمصتنا في عمان', []],
      // Three of four content words is the claim, said in the writer's words.
      [
        'English ¾ of four words',
        BUILDER,
        'projects',
        'Fresh roasted beans daily',
        'Fresh roasted beans, every morning',
        [],
      ],
      [
        'Arabic ¾ of four words',
        CAFE,
        'menu',
        'نحمص البن الإثيوبي يوميا',
        'نحمص البن الإثيوبي كل صباح',
        [],
      ],
      [
        'English half is not enough',
        BUILDER,
        'projects',
        'Fresh roasted beans daily',
        'Fresh roasted bread, every morning',
        ['must-say'],
      ],
      [
        'Arabic half is not enough',
        CAFE,
        'menu',
        'نحمص البن الإثيوبي يوميا',
        'نحمص البن السوري كل صباح',
        ['must-say'],
      ],
    ])('mustSay — %s', (_name, plan, key, claim, text, expected) => {
      expect(said(plan, key, { mustSay: [claim] }, [text])).toEqual(expected);
    });

    it.each([
      // "20%" is not inside "2020", and the Arabic ٪ is a percent sign.
      [
        'Arabic 20% vs 2020',
        CAFE,
        'menu',
        'خصم ٢٠٪ على الطلب الأول',
        ['خصم ١٠٪ على الطلب الأول لعملائنا منذ ٢٠٢٠'],
        [],
      ],
      [
        'English 20% vs 2020',
        BUILDER,
        'projects',
        '20% off the first order',
        ['10% off the first order for clients since 2020'],
        [],
      ],
      // Common words scattered across a section are not the claim.
      [
        'Arabic scattered words',
        CAFE,
        'menu',
        'توصيل مجاني داخل عمّان',
        ['توصيل الطلبات خلال ساعة', 'الماء مجاني مع كل كوب', 'فروعنا داخل عمّان'],
        [],
      ],
      [
        'English scattered words',
        BUILDER,
        'projects',
        'Free delivery across Amman',
        ['Delivery on schedule', 'Free site visits', 'Homes across Amman'],
        [],
      ],
      // The same claim in one sentence, reordered, is the repeat.
      [
        'Arabic reordered in one sentence',
        CAFE,
        'menu',
        'خصم ٢٠٪ على الطلب الأول',
        ['على الطلب الأول: خصم ٢٠ ٪'],
        ['repeats'],
      ],
      [
        'English reordered in one sentence',
        BUILDER,
        'projects',
        'Free delivery across Amman',
        ['Across Amman, delivery is free'],
        ['repeats'],
      ],
    ])('mustNotRepeat — %s', (_name, plan, key, claim, texts, expected) => {
      expect(said(plan, key, { mustNotRepeat: [claim] }, texts)).toEqual(expected);
    });

    /*
      Markup splits a sentence at its inline tags: `<p>على الطلب الأول: <strong>
      خصم ٢٠٪</strong></p>` parses to a p holding "على الطلب الأول:" and a
      strong holding "خصم ٢٠٪" (parseTreeMarkup, probed 2026-09-28). Held to
      one TEXT NODE, the reordered repeat hides in the split; held to one line
      of copy (the p and everything inside it), it is found.
    */
    it.each([
      [
        'Arabic',
        CAFE,
        'menu',
        'خصم ٢٠٪ على الطلب الأول',
        { tag: 'p', text: 'على الطلب الأول: ', inline: 'خصم ٢٠٪' },
      ],
      [
        'English',
        BUILDER,
        'projects',
        'Free delivery across Amman',
        { tag: 'p', text: 'Across Amman, ', inline: 'delivery is free' },
      ],
    ])(
      'mustNotRepeat — finds a reordered repeat split across a line’s inline tags (%s)',
      (_l, plan, key, claim, line) => {
        const held: SectionContract = {
          ...contract(plan, key),
          mustSay: [],
          mustNotRepeat: [claim],
        };
        const split: Node = {
          kind: 'element',
          tag: line.tag,
          text: line.text,
          children: [h('strong', '', line.inline)],
        };
        const landed = tree(h('section', 'ck-ground', [h('h2', '', 'x'), split], { id: key }));
        expect(codes(checkSection(plan, held, { tree: landed }))).toEqual(['repeats']);
      },
    );

    /*
      Morphology (2026-09-28). A claim word is found in any form a page writes
      it: Arabic with or without ال, و/ف, ب/ل/ك and a possessive (طلبك, فريقنا),
      ة written ت before a suffix, sound plurals, tanween's alif, the
      imperative's alif (احجز); English plurals, possessives, -ed and -ing, any
      case. Before, 8 of the verifier's 12 light paraphrases were flagged
      (mustsay-r2.mjs) — each a repair model call for a section that was right.
      Every row below is a paraphrase a writer produces for the plan's claim.
    */
    it.each([
      // The verifier's rows, each flagged before this change.
      ['article dropped', 'التوصيل المجاني', 'توصيل مجاني لكل طلب'],
      ['article dropped, adjective too', 'القهوة المختصة', 'قهوة مختصة من أجود المزارع'],
      ['possessive for the article', 'خصم ٢٠٪ على الطلب الأول', 'خصم 20% على طلبك الأول'],
      ['possessive noun, bare plurals', 'فريق من المهندسين المرخصين', 'فريقنا من مهندسين مرخصين'],
      ['possessive, two words', 'الطلب الأول', 'خصم على طلبك الأول'],
      ['imperative and ة as ت', 'حجز الطاولات', 'احجز طاولتك الآن'],
      ['لمدة frames the figure', 'ضمان لمدة سنة', 'ضمان سنة كاملة على كل جهاز'],
      // More of the same shapes, across trades.
      ['tanween alif, suffix ة', 'تحميص يومي', 'التحميص يومياً في محمصتنا'],
      ['hamza and article', 'الأسعار المناسبة', 'أسعار مناسبة للجميع'],
      ['construct without article', 'خدمة العملاء على مدار الساعة', 'خدمة عملاء على مدار الساعة'],
      ['ة before a possessive', 'استشارة مجانية', 'استشارتك الأولى مجانية'],
      ['digits and a possessive plural', 'منتجات طبيعية ١٠٠٪', 'كل منتجاتنا طبيعية 100%'],
      ['لل and a plural with a suffix', 'تعقيم كامل للأدوات', 'نعقم أدواتنا تعقيماً كاملاً'],
      ['imperative for the noun', 'الدفع عند الاستلام', 'ادفع عند استلام طلبك'],
      ['possessives on every noun', 'أطباق مصنوعة في البيت', 'أطباقنا مصنوعة في بيتنا'],
      ['plural and singular', 'جلسات العلاج الطبيعي', 'جلسة علاج طبيعي مع أخصائي'],
      ['feminine plural and singular', 'دورات تدريبية معتمدة', 'دورة تدريبية معتمدة دولياً'],
      ['ون and ين', 'المعلمون المؤهلون', 'معلمين مؤهلين بخبرة طويلة'],
      ['لل and shadda', 'مكتب محاماة في عمّان', 'مكتبنا للمحاماة في عمان'],
      ['three of four words', 'صالة رياضية مجهزة بالكامل', 'صالتنا الرياضية مجهزة تماماً'],
      ['خلال frames the time', 'التوصيل خلال ساعتين', 'توصيل الطلبات في ساعتين'],
      ['ل with a possessive', 'ورشة صيانة السيارات', 'ورشتنا لصيانة سيارتك'],
      ['articles added', 'حلويات شرقية طازجة', 'الحلويات الشرقية الطازجة كل يوم'],
      ['possessive on the object', 'تبييض الأسنان بالليزر', 'تبييض أسنانك بالليزر في جلسة'],
      ['stat for words, Latin digits', 'أكثر من ١٢٠٠ عميل', '+1,200 عميل سعيد'],
      ['possessive plural to singular', 'شهادات معتمدة', 'شهادتنا معتمدة'],
      ['possessive plural', 'مواعيد مرنة', 'مواعيدنا مرنة للعائلات'],
    ])('mustSay — Arabic paraphrase passes: %s', (_name, claim, text) => {
      expect(said(CAFE, 'menu', { mustSay: [claim] }, [text])).toEqual([]);
    });

    it.each([
      ['plural and hyphen', 'Fixed-price quotes', 'Every job gets a fixed-price quote.'],
      ['reordered', 'Free delivery', 'Delivery is free inside Amman.'],
      ['plural, participle', 'Licensed engineers', 'Our engineers are licensed.'],
      ['case and an apostrophe', 'Licensed since 2004', "We've been licensed since 2004."],
      ['plural', 'Same-day appointments', 'Book a same-day appointment online.'],
      [
        'plural, three words',
        'Certified personal trainers',
        'Every trainer is a certified personal trainer.',
      ],
      ['plural and punctuation', '24/7 emergency service', 'Emergency services, 24/7.'],
      ['ies plural', 'Handmade pastries', 'Our pastry is handmade daily.'],
      ['reordered with its figure', 'Family-owned since 1998', 'Owned by one family since 1998.'],
      ['possessive plural', "Kids' classes every Saturday", 'A kids class every Saturday morning.'],
      ['hyphen and plural', 'Board-certified dentists', 'Our dentist is board certified.'],
      ['plural, reordered', 'Organic ingredients', 'Every ingredient is organic.'],
      [
        'grouped figure, plural',
        'Wedding packages from 1,500 JD',
        'Wedding package: from 1500 JD.',
      ],
      ['three of four words', 'Free shipping on orders over 50 JD', 'Orders over 50 JD ship free.'],
      ['possessive', 'Client reviews', "Read our clients' reviews"],
      ['participle, reordered', 'Roasted in small batches', 'Every batch is roasted small.'],
    ])('mustSay — English paraphrase passes: %s', (_name, claim, text) => {
      expect(said(BUILDER, 'projects', { mustSay: [claim] }, [text])).toEqual([]);
    });

    // …and a claim that is NOT there is still asked for, forms and all.
    it.each([
      ['a fee, not free delivery', 'التوصيل المجاني', 'التوصيل برسوم رمزية داخل عمّان'],
      ['another figure', 'خصم ٢٠٪ على الطلب الأول', 'خصم ١٠٪ على الطلب الأول'],
      [
        'craftsmen, not licensed engineers',
        'فريق من المهندسين المرخصين',
        'فريق من الحرفيين المهرة',
      ],
      ['another coffee', 'القهوة المختصة', 'قهوة تركية تقليدية'],
      ['a month, not a year', 'ضمان لمدة سنة', 'ضمان لمدة شهر'],
      ['weekly, not daily', 'تحميص يومي', 'تحميص أسبوعي'],
      ['another price', 'إسبريسو ١٫٥ د.أ', 'إسبريسو ٢٫٥ د.أ'],
      ['another action', 'حجز الطاولات', 'اطلب قهوتك الآن'],
      ['paid in advance', 'الدفع عند الاستلام', 'الدفع مسبقاً ببطاقة الائتمان'],
      ['cleaning, not whitening', 'تبييض الأسنان', 'تنظيف الأسنان'],
      ['the negation dropped', 'بدون رسوم إضافية', 'رسوم إضافية بسيطة'],
      ['paid, not free', 'استشارة مجانية', 'استشارة مدفوعة'],
    ])('mustSay — a missing Arabic claim is flagged: %s', (_name, claim, text) => {
      expect(said(CAFE, 'menu', { mustSay: [claim] }, [text])).toEqual(['must-say']);
    });

    it.each([
      ['hourly, not fixed', 'Fixed-price quotes', 'Hourly rates, billed monthly.'],
      ['a fee, not free', 'Free delivery', 'Delivery from 3 JD.'],
      ['friendly, not licensed', 'Licensed engineers', 'Our engineers are friendly.'],
      ['a week, not the same day', 'Same-day appointments', 'Appointments within a week.'],
      ['not certified', 'Certified personal trainers', 'Friendly personal trainers.'],
      ['other hours', '24/7 emergency service', 'Emergency service, 9 to 5.'],
      ['fresh, not organic', 'Organic ingredients', 'Fresh ingredients.'],
      ['imported, not handmade', 'Handmade pastries', 'Imported pastries.'],
      // A word is whole: the substring test found "rent" inside "current".
      ['a word inside another', 'Rent from 300 JD', 'Current prices from 300 JD.'],
      ['paid, not for guests', 'Parking for guests', 'Paid parking nearby.'],
      ['the negation dropped', 'No hidden fees', 'Hidden fees may apply.'],
    ])('mustSay — a missing English claim is flagged: %s', (_name, claim, text) => {
      expect(said(BUILDER, 'projects', { mustSay: [claim] }, [text])).toEqual(['must-say']);
    });

    // The same forms find a repeat: the words in order, clitics and inflections aside.
    it.each([
      ['Arabic, article dropped', CAFE, 'menu', 'التوصيل المجاني', 'توصيل مجاني لكل طلب'],
      [
        'English, singular',
        BUILDER,
        'projects',
        'Fixed-price quotes',
        'A fixed-price quote on every job.',
      ],
    ])('mustNotRepeat — %s is the repeat', (_name, plan, key, claim, text) => {
      expect(said(plan, key, { mustNotRepeat: [claim] }, [text])).toEqual(['repeats']);
    });
  });

  describe('foreign-font', () => {
    it.each([
      ['Arabic', CAFE, cafeHero, "'Cairo'"],
      ['English', BUILDER, builderHero, 'Inter'],
    ])('names a face that is not the plan’s (%s)', (_l, plan, hero, face) => {
      const landed = withAnchor(hero(), 'hero');
      const css = `.ck-big{font-family:${face},sans-serif}.ck-ok{font-family:var(--ck-font-display)}`;
      const issue = only(
        checkSection(plan, contract(plan, 'hero'), { tree: landed, css }),
        'foreign-font',
      );
      expect(issue.message).toContain(face.replaceAll("'", ''));
      expect(issue.message).toContain('var(--ck-font-display)');
    });

    it('admits the plan’s own families by name, and flags the site-face classes', () => {
      const css = ".a{font-family:'Almarai',system-ui}.b{font-family:Lalezar}";
      expect(
        checkSection(CAFE, contract(CAFE, 'hero'), { tree: withAnchor(cafeHero(), 'hero'), css }),
      ).toEqual([]);
      const landed = withAnchor(cafeHero([h('p', 'font-serif', 'x')]), 'hero');
      expect(
        only(checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed }), 'foreign-font').message,
      ).toContain('font-serif');
    });

    it('flags a region importing its own web font', () => {
      const css = "@import url('https://fonts.googleapis.com/css2?family=Cairo&display=swap');";
      const issue = only(
        checkSection(CAFE, contract(CAFE, 'hero'), { tree: withAnchor(cafeHero(), 'hero'), css }),
        'foreign-font',
      );
      expect(issue.message).toContain('Cairo');
    });

    // A face named in an arbitrary class switches to a face the page never loaded.
    it.each([
      ['Arabic, bare', CAFE, cafeHero, 'font-[Cairo]', 'Cairo'],
      ['English, quoted', BUILDER, builderHero, "font-['Inter']", 'Inter'],
      [
        'English, spaced',
        BUILDER,
        builderHero,
        "md:font-['Playfair_Display',serif]",
        'Playfair Display',
      ],
      ['Arabic, arbitrary property', CAFE, cafeHero, '[font-family:Tajawal]', 'Tajawal'],
    ])('names a face written in an arbitrary class (%s)', (_l, plan, hero, className, face) => {
      const landed = withAnchor(hero([h('p', className, 'x')]), 'hero');
      const issue = only(
        checkSection(plan, contract(plan, 'hero'), { tree: landed }),
        'foreign-font',
      );
      expect(issue.message).toContain(face);
      expect(issue.message).toContain('ck-display');
      expect(issue.path).toMatch(/\.className$/u);
    });

    it('admits a weight, the page’s own faces and its variables in an arbitrary class', () => {
      const landed = withAnchor(
        cafeHero([
          h('p', 'font-[700]', 'x'),
          h('p', "font-['Almarai']", 'y'),
          h('p', 'font-[var(--ck-font-display)]', 'z'),
        ]),
        'hero',
      );
      expect(checkSection(CAFE, contract(CAFE, 'hero'), { tree: landed })).toEqual([]);
    });
  });

  it('never throws on a malformed tree, and reports what the contract then lacks', () => {
    const deep: Node = h('div', '', 'x');
    let cursor = deep;
    for (let depth = 0; depth < 5_000; depth += 1) {
      const next = h('div', '', []);
      (cursor as { children: Node[] }).children = [next];
      cursor = next;
    }
    const shapes: unknown[] = [
      null,
      42,
      'not markup',
      '<section><h1>unclosed',
      { kind: 'root' },
      { kind: 'root', children: [null, 7, { kind: 'element' }, { tag: 'h1', children: 'no' }] },
      { kind: 'root', children: [deep] },
    ];
    for (const shape of shapes) {
      const issues = checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: shape as JsonValue });
      expect(codes(issues)).toContain('missing-anchor');
    }
  });

  it('keeps the repair round bounded: one issue per distinct defect, never a wall', () => {
    const noisy = Array.from({ length: 60 }, (_, index) =>
      h('p', `bg-amber-${String((index % 9) * 100 + 100)} text-red-600`, `[slot ${String(index)}]`),
    );
    const landed = withAnchor(builderHero(noisy), 'hero');
    const issues = checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed });
    expect(issues.length).toBeLessThanOrEqual(12);
    expect(issues.filter(({ code }) => code === 'raw-colour')).toHaveLength(1);
    expect(issues.filter(({ code }) => code === 'placeholder-left').length).toBeLessThanOrEqual(3);
  });

  it('caps a section with more than twelve distinct defects at twelve', () => {
    // Fifteen different addresses from memory: fifteen distinct defects before the cap.
    const images = Array.from({ length: 15 }, (_, index) =>
      h('img', '', [], { src: `https://example.com/photo-${String(index)}.jpg`, alt: 'x' }),
    );
    const landed = withAnchor(builderHero(images), 'hero');
    const issues = checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed });
    expect(issues).toHaveLength(12);
    expect(new Set(issues.map(({ message }) => message)).size).toBe(12);
  });

  /*
    The check runs synchronously on the build's thread before each section
    lands. Verifier, 2026-09-28: 874 ms on a door-legal tree of 2,000 nodes at
    depth 30 (5.9 s at 4,000), because every element's label was read by a
    walk of the whole tree. Best of five, so a loaded machine's slow runs do
    not fail it: warm, this tree checks in 4.5 ms (best of 40, 2026-09-28),
    but at a load average of ~790 three runs measured 72–510 ms, the first
    one paying for the JIT. The quadratic walk stays far above the bar.
  */
  it('checks a 2,000-node tree at depth 30 in well under a frame budget', () => {
    const chain = (index: number): Node => {
      let node: Node = h('a', 'ck-link', `Link ${String(index)}`, { href: '#quote' });
      for (let depth = 0; depth < 28; depth += 1) node = h('div', '', [node]);
      return node;
    };
    const chains = Array.from({ length: 68 }, (_, index) => chain(index));
    const landed = withAnchor(builderHero(chains), 'hero');
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      checkSection(BUILDER, contract(BUILDER, 'hero'), { tree: landed });
      best = Math.min(best, performance.now() - started);
    }
    expect(best).toBeLessThan(100);
  });
});
