import { describe, expect, it } from 'vitest';

import {
  AiSkillRegistryError,
  AiSkillResolutionError,
  createAiSkillRegistry,
  createCraftkitAiSkillRegistry,
  defineAiSkill,
  type AiSkillDefinitionV1,
} from './index';

function skill(id: string, overrides: Partial<AiSkillDefinitionV1> = {}): AiSkillDefinitionV1 {
  return {
    schemaVersion: 1,
    id,
    name: id,
    description: `Skill ${id}`,
    version: '1.0.0',
    instructions: `Follow ${id}.`,
    activation: { mode: 'explicit' },
    ...overrides,
  };
}

function activeIds(registry: ReturnType<typeof createAiSkillRegistry>, request: string): string[] {
  return registry.prepare({ request, auto: true }).active.map(({ id }) => id);
}

function matches(keywords: readonly string[], request: string): boolean {
  const registry = createAiSkillRegistry([
    skill('skill.probe', { activation: { mode: 'auto', keywords } }),
  ]);
  return activeIds(registry, request).includes('skill.probe');
}

/*
  KEYWORDS ARE WORDS. The resolver used to ask `request.toLowerCase().includes(
  keyword)`, so a keyword fired inside any longer word: occasion-page's "eid
  al" inside "Reid Allen Plumbing" (wave-1 verifier, 2026-09-28), and — before
  that fix was attempted with trailing spaces — "عيد" inside "سعيد". A keyword
  now matches whole words of the request as the intent router reads them:
  folded (hamza, taa marbuta, alif maqsura, tashkeel, case), with Arabic
  clitics peeled, and with the endings an English or Arabic word inflects by.
*/
describe('keyword activation — whole words over the folded request', () => {
  it('matches only where a word starts: "eid al" is not inside "Reid Allen"', () => {
    expect(matches(['eid al'], 'a page for Reid Allen Plumbing')).toBe(false);
    expect(matches(['eid al'], 'Eid al-Fitr greetings for our clients')).toBe(true);
    expect(matches(['عيد'], 'صفحة لشركة سعيد للمقاولات')).toBe(false);
    expect(matches(['store'], 'restore the original header')).toBe(false);
  });

  it('refuses an ending that makes a different word', () => {
    expect(matches(['villa'], 'A page for our village festival')).toBe(false);
    expect(matches(['spa'], 'Add more space between the sections')).toBe(false);
    expect(matches(['hospital'], 'a hospitality group landing page')).toBe(false);
    expect(matches(['doctor'], 'a CV for my doctorate')).toBe(false);
  });

  it('keeps the inflections a stem was written to cover', () => {
    expect(matches(['animate'], 'an animated hero')).toBe(true);
    expect(matches(['animate'], 'animating the cards')).toBe(true);
    expect(matches(['testimonial'], 'add testimonials')).toBe(true);
    expect(matches(['bakery'], 'a site for our three bakeries')).toBe(true);
    expect(matches(['orthodont'], 'an orthodontist in Amman')).toBe(true);
    expect(matches(['dermatology'], 'a dermatologist in Amman')).toBe(true);
    expect(matches(['veterinary'], 'our veterinarian clinic')).toBe(true);
    expect(matches(['scroll'], 'a scrolling story')).toBe(true);
    expect(matches(['coffee shop'], 'two coffee shops')).toBe(true);
    expect(matches(['wedding'], "the bride's weddings page")).toBe(true);
    expect(matches(['restaurant'], "the restaurant's hours")).toBe(true);
  });

  it('reads Arabic words through the clitics a sentence glues on', () => {
    for (const request of ['موقع لعيادتي', 'صفحة العيادة', 'وعيادة أسنان', 'بالعيادة']) {
      expect({ request, hit: matches(['عيادة'], request) }).toEqual({ request, hit: true });
    }
    expect(matches(['العيد'], 'تهنئة بالعيد')).toBe(true);
    expect(matches(['عيد الفطر'], 'بطاقة بعيد الفطر')).toBe(true);
    expect(matches(['عقار'], 'شركة عقارية في دبي')).toBe(true);
    expect(matches(['حفل'], 'صفحة حفلة تخرج')).toBe(true);
  });

  it('folds the spellings people type interchangeably, on both sides', () => {
    expect(matches(['مستشفى'], 'موقع مستشفي خاص')).toBe(true);
    expect(matches(['أسنان'], 'عيادة اسنان')).toBe(true);
    expect(matches(['قهوة'], 'مـحـل قَهْوَه')).toBe(true);
    expect(matches(['café'], 'a CAFE in Irbid')).toBe(true);
    expect(matches(['cafe'], 'a Café in Irbid')).toBe(true);
  });

  it('matches a phrase across the punctuation between its words', () => {
    expect(matches(['ui ux'], 'a UI/UX review of the page')).toBe(true);
    expect(matches(['e-commerce'], 'an e-commerce site')).toBe(true);
    expect(matches(['coffee shop'], 'coffee, shop')).toBe(true);
  });

  /*
    A keyword's later Arabic words carry the "and" a list glues on, as the
    request's do: "جلدية وتجميل" compiled to the raw "وتجميل" and missed
    "مركز الجلدية والتجميل", whose readings are "التجميل" and "تجميل"
    (wave-2 verifier, 2026-09-28).
  */
  it('reads a keyword’s glued “and” the way it reads the request’s', () => {
    expect(matches(['جلدية وتجميل'], 'مركز الجلدية والتجميل')).toBe(true);
    expect(matches(['جلدية وتجميل'], 'عيادة جلدية وتجميل')).toBe(true);
    expect(matches(['جلدية وتجميل'], 'جلدية تجميل')).toBe(true);
    // The first word keeps its own letters: "فطور" (breakfast) is not "طور" (develop).
    expect(matches(['فطور'], 'طور الموقع')).toBe(false);
  });
});

/* The verifier's precision rows against the real built-ins. */
describe('built-in keyword precision (wave-1 verifier, 2026-09-28)', () => {
  const registry = createCraftkitAiSkillRegistry();
  const ids = (request: string): string[] => activeIds(registry, request);

  it('reads no occasion into a business named for its owner', () => {
    for (const request of ['a page for Reid Allen Plumbing', 'Reid Allen & Sons landing page']) {
      expect({ request, occasion: ids(request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: false,
      });
    }
    for (const request of ['Eid al-Adha greeting page', 'an eid al fitr card for our clients']) {
      expect({ request, occasion: ids(request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: true,
      });
    }
  });

  /*
    "جلدية" is leather as often as it is dermatology: "متجر حقائب جلدية" (a
    leather-bags shop) loaded clinic-page, and clinic outranks shop. The clinic
    now needs a medical co-term beside it.
  */
  it('sells leather bags as a shop, and treats skin only with a medical word', () => {
    const shop = ids('متجر حقائب جلدية');
    expect(shop).toContain('craftkit.shop-page');
    expect(shop).not.toContain('craftkit.clinic-page');
    for (const request of [
      'عيادة جلدية وتجميل',
      'مركز أمراض جلدية في عمان',
      'مركز الأمراض الجلدية',
      'a dermatologist in Amman',
      'مركز الجلدية والتجميل',
    ]) {
      expect({ request, clinic: ids(request).includes('craftkit.clinic-page') }).toEqual({
        request,
        clinic: true,
      });
    }
  });

  /*
    OCCASIONS, wave-2 verifier (2026-09-28). Recall: "Eid" named on its own
    lost the page once whole words replaced substrings — HEAD's "eid "/"عيد "
    had caught these. Precision: bare "دعوة" is also the Arabic of
    "call to action" and bare "engagement" is marketing's word, and each loaded
    the invitation playbook plus visual-direction (3,333 and 2,724 tokens)
    into a request for one section.

    The Arabic recall comes from co-terms, not a bare "عيد": in Levantine it
    is "redo" ("عيد تصميم الصفحة" — Amman is the product's first market), and
    "بعيد" ("far") peels to it. English "eid" has no such twin and is bare.
  */
  it('finds an Eid page however it is named, and no occasion in “far” or “redo”', () => {
    for (const request of [
      'an Eid page for our shop',
      'بطاقة عيد لعملائنا',
      'صفحة عيد سعيد لعملائنا',
      'تهنئة عيد للموظفين',
      'صفحة معايدة لعملائنا',
    ]) {
      expect({ request, occasion: ids(request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: true,
      });
    }
    for (const request of [
      'صمم صفحة لمنتجع بعيد عن المدينة',
      'عيد تصميم الصفحة لشركة محاماة',
      'موقع لمكتب أبو سعيد',
    ]) {
      expect({ request, occasion: ids(request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: false,
      });
    }
  });

  it('reads a call to action and customer engagement as no invitation', () => {
    for (const request of [
      'أضف قسم دعوة لاتخاذ إجراء',
      'add a section on customer engagement',
      'صمم قسم دعوة للتسجيل',
      // "Invite" is marketing's verb too, and its -ing form reached it: 2,724 tokens (probed).
      'add a section inviting visitors to sign up',
      'add an invite your team section',
    ]) {
      const active = ids(request);
      expect({ request, occasion: active.includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: false,
      });
      expect({ request, taste: active.includes('craftkit.visual-direction') }).toEqual({
        request,
        taste: false,
      });
    }
    for (const request of [
      'دعوة زفاف لسارة وعمر',
      'بطاقة دعوة لحفل تخرج',
      'دعوة لحضور حفل افتتاح المعرض',
      'دعوة عشاء لفريق العمل',
      'an engagement party page for Sara and Omar',
      'a party invite for Saturday night',
      'an invitation for our open day',
    ]) {
      expect({ request, occasion: ids(request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: true,
      });
    }
  });

  /* A stock brokerage is not an estate agency: bare "brokerage" loaded property-page. */
  it('keeps a stock brokerage out of real estate', () => {
    const active = ids('stock brokerage firm landing page');
    expect(active).not.toContain('craftkit.property-page');
    expect(active).toContain('craftkit.page-composition');
    for (const request of ['a property brokerage in Dubai', 'estate agents in Amman']) {
      expect({ request, property: ids(request).includes('craftkit.property-page') }).toEqual({
        request,
        property: true,
      });
    }
  });
});

/*
  PAGE-LEVEL EXPERTISE STAYS OUT OF EDITS.

  The page archetypes, the industry page types, the scroll journey and the
  taste skill are written for a whole page — "You are the design lead", "One
  region per section, in this order". Their trade nouns fire on edits that
  merely NAME the trade, and each brought copywriting and visual-direction
  along. Measured 2026-09-28
  (wave-1 verifier, skill tokens, HEAD → wave 1 → now):
    غيّر سعر القهوة في القائمة إلى 3 دنانير              936 → 3,138 → floor + rtl
    Change the restaurant menu prices                      377 → 2,529 → floor
    make the hero text bigger on the restaurant page       377 → 2,529 → floor
    عدّل رقم هاتف العيادة                                 936 → 3,205 → floor + rtl
    أضف صورة للشقة في القسم الثالث                         936 → 3,104 → floor + rtl
    اجعل لون الخلفية بلون القهوة                          1,835 → 4,070 → floor + rtl + design-direction
  The "now" totals are pinned below as the edit set's own cost, so a new page
  skill that leaks into edits fails here by name.
*/
const PAGE_LEVEL = [
  'craftkit.clinic-page',
  'craftkit.cv-page',
  'craftkit.menu-page',
  'craftkit.occasion-page',
  'craftkit.page-composition',
  'craftkit.property-page',
  'craftkit.scroll-cinematic',
  'craftkit.shop-page',
  'craftkit.visual-direction',
] as const;

const FLOOR = 'craftkit.craft-manual';
const RTL = 'craftkit.arabic-rtl';

describe('page-level skills stay out of edits', () => {
  const registry = createCraftkitAiSkillRegistry();
  const EDITS: readonly (readonly [string, readonly string[]])[] = [
    ['غيّر سعر القهوة في القائمة إلى 3 دنانير', [FLOOR, RTL]],
    ['Change the restaurant menu prices', [FLOOR]],
    ['make the hero text bigger on the restaurant page', [FLOOR]],
    ['عدّل رقم هاتف العيادة', [FLOOR, RTL]],
    ['أضف صورة للشقة في القسم الثالث', [FLOOR, RTL]],
    ['اجعل لون الخلفية بلون القهوة', [FLOOR, RTL, 'craftkit.design-direction']],
    // The audit's P0-1 edits that name an archetype's noun.
    ['change the wedding date to June 12', [FLOOR]],
    ['غيّر تاريخ الزفاف إلى ١٢ يونيو', [FLOOR, RTL]],
    ['change the resume download link', [FLOOR]],
    ['make the hero stand out', [FLOOR]],
    // A scroll BUG is not a scroll story: "5-7 scenes, one journey" has no place in its fix.
    ['fix horizontal scrolling on mobile', [FLOOR]],
    ['غير سعر الرحلة إلى 300 دينار', [FLOOR, RTL]],
    /*
      An Arabic construct naming the existing page, with a comparative. Before
      (wave-2 verifier): routed build-page/new-page, and "خلي صفحة العيادة
      أغمق" carried 6 skills and 4,137 tokens — over the 3,400 page ceiling.
      Now 2,005: darker and lighter are colour edits, and carry the colour
      skill as "make the clinic page darker" does (1,396 in English).
    */
    ['خلي صفحة العيادة أغمق', [FLOOR, RTL, 'craftkit.design-direction']],
    ['اجعل صفحة المطعم أبسط', [FLOOR, RTL]],
    ['خلي صفحة الهبوط أفتح', [FLOOR, RTL, 'craftkit.design-direction']],
    /*
      MSA verbal nouns of change. Before (wave-2 verifier, 2026-09-28): no verb
      at all, so the resolver's blank-page route made each a page brief —
      clinic-page 3,205, menu-page 3,138 ×2, property-page 3,104 tokens. Now
      the floor and the language, 1,073.
    */
    ['هل يمكن تعديل رقم هاتف العيادة؟', [FLOOR, RTL]],
    ['أريد تعديل سعر القهوة في المنيو', [FLOOR, RTL]],
    ['الرجاء حذف قسم المنيو من صفحة المطعم', [FLOOR, RTL]],
    ['أرجو تغيير صور الشقة', [FLOOR, RTL]],
    /*
      A title edit on a CV page: no cv-page, no page skill. The section recipe
      rides on "الشهادات" (certificates, read as testimonials) — a section's
      expertise, not a page's.
    */
    [
      'تغيير عنوان قسم التعليم والشهادات إلى مرحبا',
      [FLOOR, RTL, 'craftkit.conversion-recipes'],
    ],
    // A question about the person's own action writes nothing and needs nothing.
    ['what if I delete the hero?', [FLOOR]],
  ];

  it.each(EDITS)('“%s” carries only the edit set, at its own cost', (request, expected) => {
    const prepared = registry.prepare({ request, auto: true });
    const active = prepared.active.map(({ id }) => id);
    expect(active.filter((id) => (PAGE_LEVEL as readonly string[]).includes(id))).toEqual([]);
    expect([...active].sort()).toEqual([...expected].sort());
    /*
      The same set selected explicitly costs a token more per skill at most:
      its fragments say "explicit" where these say "auto".
    */
    const editSet = registry.prepare({
      request: '',
      selectedSkillIds: expected.filter((id) => id !== FLOOR),
      auto: false,
    });
    expect(prepared.totalTokens).toBeLessThanOrEqual(editSet.totalTokens);
    expect(prepared.totalTokens).toBeGreaterThanOrEqual(editSet.totalTokens - expected.length);
  });

  it.each([
    ['Build a landing page for my restaurant', 'craftkit.menu-page'],
    ['صمم لي موقع لعيادة أسنان', 'craftkit.clinic-page'],
    ['دعوة زفاف لسارة وعمر', 'craftkit.occasion-page'],
    ['حلويات شرقية وكنافة', 'craftkit.menu-page'],
    ['Add a farewell banner for a retiring colleague', 'craftkit.occasion-page'],
    ['a scrollytelling page for our coffee farm', 'craftkit.scroll-cinematic'],
  ] as const)('keeps them on a page ask: “%s” → %s', (request, id) => {
    expect(activeIds(registry, request)).toContain(id);
  });

  it('declares the page scope on every page playbook and the taste skill, and nowhere else', () => {
    const scoped = createCraftkitAiSkillRegistry()
      .list()
      .filter(({ activation }) => activation.mode === 'auto' && activation.intents !== undefined);
    expect(scoped.map(({ id }) => id)).toEqual([...PAGE_LEVEL]);
    for (const { id, activation } of scoped) {
      if (activation.mode !== 'auto') continue;
      /* A banner is one region of an occasion page, so the occasion also serves a section. */
      expect({ id, intents: activation.intents }).toEqual({
        id,
        intents:
          id === 'craftkit.occasion-page'
            ? ['add-section', 'build-page', 'build-site']
            : ['build-page', 'build-site'],
      });
    }
  });
});

describe('activation.intents and the prepare intent hint', () => {
  const registry = createAiSkillRegistry([
    skill('skill.page', {
      activation: { mode: 'auto', keywords: ['bakery'], intents: ['build-page', 'build-site'] },
      dependencies: ['skill.words'],
    }),
    skill('skill.words', { activation: { mode: 'auto', keywords: ['bakery'] } }),
    skill('skill.helper'),
  ]);
  const ids = (request: string, intent?: 'build-page' | 'edit' | 'question'): string[] =>
    registry
      .prepare({ request, auto: true, ...(intent === undefined ? {} : { intent }) })
      .active.map(({ id }) => id);

  it('routes the words itself when the host gives no hint', () => {
    expect(ids('Build a website for my bakery')).toContain('skill.page');
    expect(ids('a bakery in Amman')).toContain('skill.page');
    expect(ids('change the bakery phone number')).not.toContain('skill.page');
    expect(ids('how do I add a bakery menu?')).not.toContain('skill.page');
  });

  it('obeys the host’s own route over the words', () => {
    expect(ids('Build a website for my bakery', 'edit')).not.toContain('skill.page');
    expect(ids('bakery opening hours', 'build-page')).toContain('skill.page');
  });

  it('leaves a skill without intents exactly as it was, whatever the hint', () => {
    for (const intent of ['edit', 'question', 'build-page'] as const) {
      expect(ids('change the bakery phone number', intent)).toContain('skill.words');
    }
  });

  it('never gates what the host selected, nor a selected skill’s dependencies', () => {
    const prepared = registry.prepare({
      request: 'change the bakery phone number',
      selectedSkillIds: ['skill.page'],
      intent: 'edit',
    });
    expect(prepared.active.map(({ id }) => id)).toEqual(['skill.page', 'skill.words']);
  });

  it('refuses a hint that is not an intent', () => {
    expect(() =>
      registry.prepare({
        request: 'x',
        intent: 'build-everything' as unknown as 'edit',
      }),
    ).toThrow(AiSkillResolutionError);
  });
});

describe('defineAiSkill — activation.intents', () => {
  const auto = (intents: unknown) =>
    defineAiSkill(
      skill('skill.scoped', {
        activation: { mode: 'auto', keywords: ['x'], intents } as unknown as {
          mode: 'auto';
          keywords: string[];
        },
      }),
    );

  it('canonicalises the list: trimmed, sorted, one of each', () => {
    const { activation } = auto([' build-site', 'build-page']).manifest;
    expect(activation).toEqual({
      mode: 'auto',
      keywords: ['x'],
      intents: ['build-page', 'build-site'],
    });
  });

  it('refuses an unknown, an empty or a repeated intent', () => {
    expect(() => auto(['build-everything'])).toThrow(AiSkillRegistryError);
    expect(() => auto([])).toThrow(AiSkillRegistryError);
    expect(() => auto(['edit', 'edit'])).toThrow(AiSkillRegistryError);
  });

  it('is a gate, not a trigger: intents alone cannot activate a skill', () => {
    expect(() =>
      defineAiSkill(
        skill('skill.gate-only', {
          activation: { mode: 'auto', intents: ['edit'] } as unknown as { mode: 'auto' },
        }),
      ),
    ).toThrow(/requires keywords/iu);
  });

  it('is refused on an explicit activation, like every other trigger field', () => {
    expect(() =>
      defineAiSkill(
        skill('skill.explicit-scoped', {
          activation: { mode: 'explicit', intents: ['edit'] } as unknown as { mode: 'explicit' },
        }),
      ),
    ).toThrow(/activation/iu);
  });
});

/*
  A DEPENDENCY SERVES THE ROUTES IT SERVES (router-3, 2026-09-28). occasion-page
  serves one section (a banner is add-section) and depends on visual-direction,
  which serves only page and site builds. Pulled in as a dependency it
  bypassed its own gate: "أضف قسم عروض رمضان" carried it at 3,333 tokens and
  "add a section with a ramadan offer" at 2,724 (wave-2 verifier).
*/
describe('a dependency stays inside its own intent scope', () => {
  const registry = createAiSkillRegistry([
    skill('skill.banner', {
      activation: { mode: 'auto', keywords: ['banner'], intents: ['add-section', 'build-page'] },
      dependencies: ['skill.taste', 'skill.words'],
    }),
    skill('skill.taste', {
      activation: { mode: 'auto', keywords: ['distinctive'], intents: ['build-page'] },
      dependencies: ['skill.palette'],
    }),
    skill('skill.palette'),
    skill('skill.words', { activation: { mode: 'auto', keywords: ['copy'] } }),
  ]);
  const prepare = (intent: 'add-section' | 'build-page', selected: readonly string[] = []) =>
    registry.prepare({ request: 'a banner', intent, selectedSkillIds: selected });

  it('leaves out a dependency whose scope excludes the route, and what only it needed', () => {
    const prepared = prepare('add-section');
    expect(prepared.active.map(({ id }) => id)).toEqual(['skill.words', 'skill.banner']);
    expect(prepared.omitted).toEqual([
      {
        id: 'skill.taste',
        code: 'intent',
        message: expect.stringMatching(/dependency of skill\.banner.*routes to add-section/u),
      },
    ]);
  });

  it('keeps it, and its own dependencies, on a route it serves', () => {
    const prepared = prepare('build-page');
    expect(prepared.active.map(({ id }) => id)).toEqual([
      'skill.palette',
      'skill.taste',
      'skill.words',
      'skill.banner',
    ]);
    expect(prepared.omitted).toEqual([]);
  });

  it('never gates a selected skill, nor a dependency already active', () => {
    expect(prepare('add-section', ['skill.banner']).active.map(({ id }) => id)).toContain(
      'skill.taste',
    );
    const withTaste = prepare('add-section', ['skill.taste']);
    expect(withTaste.active.map(({ id }) => id)).toEqual([
      'skill.taste',
      'skill.palette',
      'skill.words',
      'skill.banner',
    ]);
    expect(withTaste.omitted).toEqual([]);
  });
});

describe('one-section occasion requests carry no page taste (built-ins)', () => {
  const registry = createCraftkitAiSkillRegistry();

  it('costs a Ramadan-offers section the floor, and no occasion playbook', () => {
    const arabic = registry.prepare({ request: 'أضف قسم عروض رمضان', auto: true });
    expect(arabic.active.map(({ id }) => id)).toEqual([FLOOR, RTL]);
    expect(arabic.totalTokens).toBeLessThanOrEqual(1_100);
    const english = registry.prepare({ request: 'add a section with a ramadan offer', auto: true });
    expect(english.active.map(({ id }) => id)).toEqual([FLOOR]);
  });

  it('keeps the occasion for a banner, without visual-direction', () => {
    const prepared = registry.prepare({
      request: 'Add a farewell banner for a retiring colleague',
      auto: true,
    });
    const active = prepared.active.map(({ id }) => id);
    expect(active).toContain('craftkit.occasion-page');
    expect(active).not.toContain('craftkit.visual-direction');
    expect(prepared.omitted.map(({ id, code }) => `${id}:${code}`)).toEqual([
      'craftkit.visual-direction:intent',
    ]);
    // Was 2,724 with the taste skill (wave-2 verifier).
    expect(prepared.totalTokens).toBeLessThan(2_000);
  });

  it('keeps visual-direction on an occasion PAGE', () => {
    const active = registry
      .prepare({ request: 'دعوة زفاف لسارة وعمر', auto: true })
      .active.map(({ id }) => id);
    expect(active).toContain('craftkit.occasion-page');
    expect(active).toContain('craftkit.visual-direction');
  });

  it('reads Ramadan as an occasion only with its greeting words', () => {
    for (const request of [
      'Ramadan Kareem greeting card for our clients',
      'بطاقة رمضان كريم لعملائنا',
      'تهنئة برمضان للموظفين',
      'صفحة رمضان لمتجرنا',
    ]) {
      expect({ request, occasion: activeIds(registry, request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: true,
      });
    }
    for (const request of ['عروض رمضان على العطور', 'a ramadan sale page for our shop']) {
      expect({ request, occasion: activeIds(registry, request).includes('craftkit.occasion-page') }).toEqual({
        request,
        occasion: false,
      });
    }
  });
});

/*
  SHORT KEYWORDS TAKE NO ENDINGS (router-3, 2026-09-28): "eid" + "er" is Eider
  and "cv" + "s" is CVS. Measured (wave-2 verifier): "a page for Eider Ducks
  conservation" loaded occasion-page, "website for CVS pharmacy branch"
  cv-page, 2,724 and 2,733 tokens.
*/
describe('keyword endings stop below four Latin letters', () => {
  it('matches a short keyword only as written', () => {
    expect(matches(['eid'], 'a page for Eider Ducks conservation')).toBe(false);
    expect(matches(['cv'], 'website for CVS pharmacy branch')).toBe(false);
    expect(matches(['faq'], 'add FAQs')).toBe(false);
    expect(matches(['eid'], 'an Eid page for our shop')).toBe(true);
    expect(matches(['cv'], 'my CV page')).toBe(true);
    // Four letters and up still inflect; Arabic keeps its endings.
    expect(matches(['café'], 'two cafés')).toBe(true);
    expect(matches(['حفل'], 'صفحة حفلة تخرج')).toBe(true);
  });

  it('keeps the built-ins’ plurals by listing them', () => {
    const registry = createCraftkitAiSkillRegistry();
    expect(activeIds(registry, 'add FAQs')).toContain('craftkit.conversion-recipes');
    expect(activeIds(registry, 'a page for our juice bars in Amman')).toContain('craftkit.menu-page');
    expect(activeIds(registry, 'a website for our day spas')).toContain('craftkit.clinic-page');
    expect(activeIds(registry, 'a page for Eider Ducks conservation')).not.toContain(
      'craftkit.occasion-page',
    );
    expect(activeIds(registry, 'website for CVS pharmacy branch')).not.toContain('craftkit.cv-page');
  });
});
