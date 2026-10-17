import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DIRECTION_DECK_ROWS } from '../../skills/direction-deck';
import { expandCompactPagePlan } from './compact-plan';
import { resolveColour } from './schema';
import { validatePagePlan } from './validate-page-plan';

/*
  The compact page-plan answer (fast-build DESIGN §3, 2026-10-05): the model
  writes the deck row's id instead of its palette, an outline instead of full
  contracts, and one brief per section. These pin the expansion rules, and that
  the documented example becomes a plan the validator accepts.
*/

type Json = Record<string, unknown>;

/** DESIGN §3's example `pagePlan`, verbatim. */
function example(): Json {
  return {
    intent: 'new-page',
    locale: { lang: 'en', dir: 'ltr' },
    title: 'Cardamom Roasters — specialty coffee in Amman',
    description: 'Small-batch coffee roasted every morning in Amman, delivered fresh.',
    tokens: { deckRowId: 'cafe', signature: 'The brand name at text-8xl, faint behind the menu.' },
    primaryCta: { label: 'Order beans', href: '#order' },
    sections: [
      { key: 'header', role: 'header', title: 'Header' },
      { key: 'hero', role: 'hero', title: 'Roasted this morning', variant: 'split' },
      { key: 'menu', role: 'band', title: 'Menu', variant: 'menu', nav: 'Menu' },
      { key: 'order', role: 'cta', title: 'Order', variant: 'cta-split', nav: 'Order' },
      { key: 'footer', role: 'footer', title: 'Footer', variant: 'footer' },
    ],
    briefs: [
      {
        key: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['Roasted daily in Amman'],
        images: [{ subject: 'cafe', aspect: 'landscape', alt: 'Freshly roasted coffee beans' }],
      },
      {
        key: 'menu',
        purpose: 'The drinks and beans, with prices.',
        mustNotRepeat: ['Roasted daily in Amman'],
        facts: [{ key: 'price-espresso', sample: 'JOD 1.50' }],
      },
      {
        key: 'order',
        purpose: 'One clear way to order.',
        slots: {
          title: 'Fresh beans, delivered in Amman',
          cta: { label: 'Order beans', href: '#order' },
        },
      },
      {
        key: 'footer',
        purpose: 'Address, hours and contact.',
        facts: [{ key: 'phone', sample: '+962 6 461 2750' }],
      },
    ],
    seo: {
      keyword: 'specialty coffee Amman',
      pageKind: 'home',
      businessType: 'CafeOrCoffeeShop',
      slug: 'specialty-coffee-amman',
    },
  };
}

function expanded(value: unknown): Json {
  return expandCompactPagePlan(value).value as Json;
}

function sectionsOf(value: Json): Json[] {
  return value['sections'] as Json[];
}

const CAFE = DIRECTION_DECK_ROWS.find(({ id }) => id === 'cafe');

describe('expandCompactPagePlan — the compact answer becomes the classic plan', () => {
  it('turns the DESIGN §3 example into a plan validatePagePlan accepts', () => {
    const result = validatePagePlan(example());
    if (!result.ok) {
      throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
    }
    const { plan } = result;
    expect(plan.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    expect(plan.sections.map(({ anchorId }) => anchorId)).toEqual([
      'header',
      'hero',
      'menu',
      'order',
      'footer',
    ]);
    expect(plan.nav).toEqual([
      { label: 'Menu', anchorId: 'menu' },
      { label: 'Order', anchorId: 'order' },
    ]);
    expect(plan.sections[1]?.purpose).toBe('Say what the roastery is and invite the first order.');
    expect(plan.sections[1]?.mustSay).toEqual(['Roasted daily in Amman']);
    expect(plan.sections[0]?.purpose).toBe('Header');
    expect(plan.facts).toEqual([
      { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
      { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
    ]);
    expect(plan.tokens.deckRowId).toBe('cafe');
    expect(plan.tokens.signature).toBe('The brand name at text-8xl, faint behind the menu.');
    // Every section of the example has a brief or is the header: no brief warnings.
    const briefWarnings = (result.warnings ?? []).filter(
      ({ path }) => path.startsWith('briefs') || path.endsWith('.purpose'),
    );
    expect(briefWarnings).toEqual([]);
  });

  it('fills the tokens from the named deck row: the cafe row’s own values', () => {
    expect(CAFE).toBeDefined();
    if (CAFE === undefined) return;
    const tokens = expanded(example())['tokens'] as Json;
    const hex = (shade: string) => resolveColour(shade);
    expect(tokens).toMatchObject({
      bg: hex(CAFE.palette.ground),
      surface: hex(CAFE.palette.card),
      ink: hex(CAFE.palette.ink),
      muted: hex(CAFE.palette.muted),
      accent: hex(CAFE.palette.accent),
      onAccent: hex(CAFE.palette.onAccent),
      accentInk: hex(CAFE.palette.accentInk),
      fontDisplay: { family: CAFE.latin[0].family, weights: [...CAFE.latin[0].weights] },
      fontBody: { family: CAFE.latin[1].family, weights: [...CAFE.latin[1].weights] },
      radius: 'xl',
      deckRowId: 'cafe',
    });
    expect(tokens['bg']).toBe('#f7fee7');
    // 80 % ground, 20 % muted: a hairline, lower-case #rrggbb, the same every time.
    expect(tokens['border']).toBe('#c7dec7');
    // The signature the model wrote wins over the row's.
    expect(tokens['signature']).toBe('The brand name at text-8xl, faint behind the menu.');
    const unsigned = example();
    unsigned['tokens'] = { deckRowId: 'cafe' };
    expect((expanded(unsigned)['tokens'] as Json)['signature']).toBe(CAFE.signature);
  });

  it('gives an Arabic page the row’s Arabic faces', () => {
    if (CAFE === undefined) throw new Error('no cafe row');
    const arabic = example();
    arabic['locale'] = { lang: 'ar' };
    const tokens = expanded(arabic)['tokens'] as Json;
    expect(tokens['fontDisplay']).toEqual({ family: 'Lalezar', weights: [] });
    expect(tokens['fontBody']).toEqual({ family: 'Almarai', weights: [400, 700] });
    expect(tokens['fontDisplay']).toEqual({
      family: CAFE.arabic[0].family,
      weights: [...CAFE.arabic[0].weights],
    });

    const result = validatePagePlan(arabic);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.locale.dir).toBe('rtl');
      expect(result.plan.tokens.fontDisplay.family).toBe('Lalezar');
      expect(result.plan.tokens.fontBody.family).toBe('Almarai');
    }
  });

  it('lets a token the model wrote win — a person who asked for blue gets blue', () => {
    const blue = example();
    blue['tokens'] = { deckRowId: 'cafe', signature: 'Blue.', accent: 'blue-700' };
    const tokens = expanded(blue)['tokens'] as Json;
    expect(tokens['accent']).toBe('blue-700');
    // The deck's orange ink is not kept under a blue accent; the validator derives it.
    expect(tokens['accentInk']).toBeUndefined();
    const result = validatePagePlan(blue);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.tokens.accent).toBe('#1d4ed8');
      expect(result.plan.tokens.accentInk).toBe('#1d4ed8');
    }
  });

  it('merges each brief into its section and hoists its facts with the section’s key', () => {
    const value = expanded(example());
    expect(value['briefs']).toBeUndefined();
    const [, hero, menu, order, footer] = sectionsOf(value);
    expect(hero).toMatchObject({
      key: 'hero',
      anchorId: 'hero',
      purpose: 'Say what the roastery is and invite the first order.',
      mustSay: ['Roasted daily in Amman'],
      mustNotRepeat: [],
      variant: 'split',
    });
    expect(menu).toMatchObject({ mustNotRepeat: ['Roasted daily in Amman'], mustSay: [] });
    expect(order?.['slots']).toEqual({
      title: 'Fresh beans, delivered in Amman',
      cta: { label: 'Order beans', href: '#order' },
    });
    expect(footer?.['purpose']).toBe('Address, hours and contact.');
    expect(value['facts']).toEqual([
      { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
      { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
    ]);

    // A brief's values win over the outline's.
    const mixed = example();
    sectionsOf(mixed)[1] = { ...sectionsOf(mixed)[1], purpose: 'Outline purpose.' };
    expect(sectionsOf(expanded(mixed))[1]?.['purpose']).toBe(
      'Say what the roastery is and invite the first order.',
    );

    // Facts already at the top stay first; the briefs' join after them.
    const topFacts = example();
    topFacts['facts'] = [{ key: 'hours', sample: '8:00–22:00', section: 'footer' }];
    expect((expanded(topFacts)['facts'] as Json[]).map(({ key }) => key)).toEqual([
      'hours',
      'price-espresso',
      'phone',
    ]);
  });

  it('derives the nav from the sections’ nav labels, in page order, and strips them', () => {
    const value = expanded(example());
    expect(value['nav']).toEqual([
      { label: 'Menu', anchorId: 'menu' },
      { label: 'Order', anchorId: 'order' },
    ]);
    for (const section of sectionsOf(value)) expect(section).not.toHaveProperty('nav');

    // A top-level nav wins; the labels are still stripped.
    const own = example();
    own['nav'] = [{ label: 'Beans', anchorId: 'menu' }];
    const kept = expanded(own);
    expect(kept['nav']).toEqual([{ label: 'Beans', anchorId: 'menu' }]);
    for (const section of sectionsOf(kept)) expect(section).not.toHaveProperty('nav');

    // No header, no menu.
    const headless = example();
    headless['sections'] = sectionsOf(headless).slice(1);
    expect(expanded(headless)['nav']).toEqual([]);
  });

  it('drops a brief that names no section, with a warning', () => {
    const value = example();
    (value['briefs'] as Json[]).push({ key: 'gallery', purpose: 'Photos.' });
    const { value: out, warnings } = expandCompactPagePlan(value);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.path).toBe('briefs[4].key');
    expect(warnings[0]?.message).toMatch(/gallery/u);
    expect(sectionsOf(out as Json).map(({ key }) => key)).not.toContain('gallery');
    expect(validatePagePlan(value).ok).toBe(true);
  });

  it('builds a section with no brief from its title, with a warning — never an issue', () => {
    const value = example();
    value['briefs'] = (value['briefs'] as Json[]).filter(({ key }) => key !== 'menu');
    const { value: out, warnings } = expandCompactPagePlan(value);
    expect(sectionsOf(out as Json)[2]?.['purpose']).toBe('Menu');
    expect(warnings.map(({ path }) => path)).toEqual(['sections[2].purpose']);
    expect(warnings[0]?.message).toMatch(/no brief/iu);

    const result = validatePagePlan(value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.sections[2]?.purpose).toBe('Menu');
      expect(result.warnings?.map(({ path }) => path)).toContain('sections[2].purpose');
    }
  });

  it('is idempotent', () => {
    const once = expanded(example());
    const twice = expandCompactPagePlan(once);
    expect(twice.value).toEqual(once);
    expect(twice.value).toBe(once);
    expect(twice.warnings).toEqual([]);
  });

  it('returns a classic plan unchanged — the same object, no warnings', () => {
    const classic = expanded(example());
    const again = expandCompactPagePlan(classic);
    expect(again.value).toBe(classic);

    const plain = {
      intent: 'new-page',
      locale: { lang: 'en' },
      title: 'T',
      description: 'D',
      tokens: {
        bg: 'white',
        surface: 'zinc-100',
        ink: 'zinc-900',
        muted: 'zinc-600',
        accent: 'blue-700',
        onAccent: 'white',
        border: 'zinc-300',
        fontDisplay: { family: 'Sora' },
        fontBody: { family: 'Nunito Sans' },
        radius: 'md',
        signature: 'S',
      },
      primaryCta: { label: 'Go', href: '#hero' },
      sections: [
        {
          key: 'hero',
          role: 'hero',
          title: 'Hero',
          anchorId: 'hero',
          purpose: 'P',
          mustSay: [],
          mustNotRepeat: [],
        },
        {
          key: 'band',
          role: 'band',
          title: 'Band',
          anchorId: 'band',
          purpose: 'P',
          mustSay: [],
          mustNotRepeat: [],
        },
      ],
    };
    const result = expandCompactPagePlan(plain);
    expect(result.value).toBe(plain);
    expect(result.warnings).toEqual([]);
  });

  it('never throws, whatever it is given', () => {
    for (const value of [
      undefined,
      null,
      'plan',
      42,
      [],
      { tokens: 'cafe', sections: 'none', briefs: { key: 'hero' } },
      { sections: [null, 3, { key: 7 }], briefs: [null, { key: 'x' }, { key: 7 }] },
      { tokens: { deckRowId: 'nowhere' } },
    ]) {
      expect(() => expandCompactPagePlan(value)).not.toThrow();
    }
    expect(expandCompactPagePlan('plan').value).toBe('plan');
  });

  describe('one fact per key (fix pass 2026-10-05)', () => {
    /** A captured T1 answer's `pagePlan` (final-run dumps, Arabic restaurant). */
    function captured(name: string): Json {
      const answer = JSON.parse(
        readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'),
      ) as Json;
      return answer['pagePlan'] as Json;
    }

    it('accepts wire-ar-restaurant-02: the same facts at the top and in the briefs', () => {
      const value = captured('wire-ar-restaurant-02');
      // The dump really is the mixed answer the validator refused twice.
      expect((value['facts'] as Json[]).length).toBe(6);
      const result = validatePagePlan(value);
      if (!result.ok) {
        throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
      }
      expect(result.plan.facts.map(({ key }) => key)).toEqual([
        'price-kebab',
        'price-grilled-chicken',
        'price-hummus',
        'phone',
        'address',
        'hours',
      ]);
      expect(result.plan.facts.find(({ key }) => key === 'phone')?.section).toBe('contact');
      // Identical copies are dropped silently: no fact warning for them.
      expect((result.warnings ?? []).filter(({ path }) => path.startsWith('facts'))).toEqual([]);
    });

    it('keeps the brief’s fact when the same key carries a different sample, with a warning', () => {
      const value = example();
      value['facts'] = [{ key: 'phone', sample: '+962 6 400 0001', section: 'footer' }];
      const { value: out, warnings } = expandCompactPagePlan(value);
      expect((out as Json)['facts']).toEqual([
        { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
        { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
      ]);
      expect(warnings.map(({ path }) => path)).toEqual(['facts']);
      expect(warnings[0]?.message).toMatch(/phone/u);
      expect(validatePagePlan(value).ok).toBe(true);
    });

    it('drops a section’s own facts when its brief carries facts, and hoists them when not', () => {
      const value = example();
      sectionsOf(value)[2] = {
        ...sectionsOf(value)[2],
        facts: [{ key: 'price-espresso', sample: 'JOD 9.00' }],
      };
      sectionsOf(value)[1] = {
        ...sectionsOf(value)[1],
        facts: [{ key: 'opening', sample: '7:00' }],
      };
      const out = expanded(value);
      for (const section of sectionsOf(out)) expect(section).not.toHaveProperty('facts');
      expect(out['facts']).toEqual([
        { key: 'opening', sample: '7:00', section: 'hero' },
        { key: 'price-espresso', sample: 'JOD 1.50', section: 'menu' },
        { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
      ]);
    });

    it('drops an identical duplicate in a classic plan too, but still asks about a conflict', () => {
      const plan = expanded(example());
      plan['facts'] = [...(plan['facts'] as Json[]), { key: 'phone', sample: '+962 6 461 2750', section: 'footer' }];
      const result = validatePagePlan(plan);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.plan.facts).toHaveLength(2);
        expect(result.warnings?.map(({ path }) => path)).toContain('facts[2].key');
      }
      plan['facts'] = [...(plan['facts'] as Json[]).slice(0, 2), { key: 'phone', sample: '+962 6 999 1234', section: 'footer' }];
      expect(validatePagePlan(plan).ok).toBe(false);
    });
  });

  it('takes the brand from the footer brief’s slots, and keeps a top-level one', () => {
    const value = example();
    (value['briefs'] as Json[])[3] = {
      ...(value['briefs'] as Json[])[3],
      slots: { brand: 'Cardamom', text: 'Roasted daily.' },
    };
    expect(expanded(value)['brand']).toBe('Cardamom');
    const result = validatePagePlan(value);
    expect(result.ok && result.plan.brand).toBe('Cardamom');

    value['brand'] = 'Cardamom Roasters';
    expect(expanded(value)['brand']).toBe('Cardamom Roasters');
  });
});

describe('section keys in Arabic script (live run 2026-10-05)', () => {
  /*
    «صفحة لمطعم مشاوي في عمّان فيها منيو وتوصيل وحجز»: haiku keyed the
    sections «بطل», «قائمة», «حجز» and linked the CTA to «#حجز». The slug rule
    refused the whole plan — a 15.7 s repair round for a name no visitor sees.
    Code renames them, and every reference with them.
  */
  function arabicAnswer(): Record<string, unknown> {
    return {
      intent: 'replace',
      locale: { lang: 'ar', dir: 'rtl' },
      title: 'مطعم المشاوي — مشاوي طازة وتوصيل في عمّان',
      description: 'مطعم مشاوي بقائمة شهية وتوصيل سريع وحجز طاولات في عمّان.',
      tokens: { deckRowId: 'restaurant', signature: 'صورة الطبق تحت البطل' },
      primaryCta: { label: 'احجز طاولة', href: '#حجز' },
      sections: [
        { key: 'header', role: 'header', title: 'الرأس', kit: 'header-bar' },
        { key: 'بطل', role: 'hero', title: 'مشاوي طازة يومياً', kit: 'hero-overlay' },
        { key: 'أطباق', role: 'band', title: 'الأطباق الشهيرة', nav: 'الأطباق', kit: 'features-bento' },
        { key: 'قائمة', role: 'band', title: 'القائمة', nav: 'القائمة', kit: 'menu-list' },
        { key: 'آراء', role: 'band', title: 'ما يقول الزبائن', nav: 'التقييمات' },
        { key: 'حجز', role: 'cta', title: 'احجز الآن', kit: 'contact-split' },
        { key: 'تذييل', role: 'footer', title: 'التذييل', kit: 'footer-columns' },
      ],
      briefs: [
        { key: 'بطل', purpose: 'مشاوي طازة يومياً مع دعوة للحجز.', mustSay: ['مشاوي طازة يومياً'] },
        { key: 'قائمة', purpose: 'القائمة بالأسعار.', facts: [{ key: 'price-kebab', sample: '5.50 د.ا' }] },
        { key: 'حجز', purpose: 'احجز أو اطلب توصيل.', facts: [{ key: 'phone', sample: '+962 6 465 3210' }] },
      ],
      seo: { keyword: 'مطعم مشاوي في عمّان', pageKind: 'home', businessType: 'Restaurant', slug: 'mashawi-amman' },
    };
  }

  it('renames them to Latin slugs from kit or role, and the plan validates with no repair round', () => {
    const result = validatePagePlan(arabicAnswer());
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
    const { plan } = result;
    expect(plan.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'features',
      'menu',
      'section',
      'contact',
      'footer',
    ]);
    expect(plan.sections.map(({ anchorId }) => anchorId)).toEqual(plan.sections.map(({ key }) => key));
    expect(plan.primaryCta).toEqual({ label: 'احجز طاولة', href: '#contact' });
    expect(plan.nav).toEqual([
      { label: 'الأطباق', anchorId: 'features' },
      { label: 'القائمة', anchorId: 'menu' },
      { label: 'التقييمات', anchorId: 'section' },
    ]);
    expect(plan.sections[1]?.purpose).toBe('مشاوي طازة يومياً مع دعوة للحجز.');
    expect(plan.facts).toEqual([
      { key: 'price-kebab', sample: '5.50 د.ا', section: 'menu' },
      { key: 'phone', sample: '+962 6 465 3210', section: 'contact' },
    ]);
    expect((result.warnings ?? []).filter(({ message }) => message.includes('not a Latin slug'))).toHaveLength(6);
  });

  it('keeps every new key unique and leaves Latin keys alone', () => {
    const value = arabicAnswer();
    value['sections'] = [
      { key: 'menu', role: 'hero', title: 'البطل', kit: 'hero-overlay' },
      { key: 'قائمة', role: 'band', title: 'القائمة', kit: 'menu-list' },
      { key: 'قائمة-2', role: 'band', title: 'المشروبات', kit: 'menu-list' },
    ];
    value['briefs'] = [];
    value['primaryCta'] = { label: 'القائمة', href: '#قائمة' };
    const sections = expanded(value)['sections'] as readonly Json[];
    expect(sections.map(({ key }) => key)).toEqual(['menu', 'menu-2', 'menu-3']);
    expect(expanded(value)['primaryCta']).toEqual({ label: 'القائمة', href: '#menu-2' });
  });
});
