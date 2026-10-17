import {
  DEFAULT_AI_BUILD_MAX_TASKS,
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  type PagePlan,
} from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { clinicPlan, clinicPlanCandidate, validatedPlan } from '../testing/page-plans';

import {
  FONT_PAIRS,
  PLAN_MAX_SECTIONS,
  PLAN_MIN_SECTIONS,
  applyPlanOp,
  canAddSection,
  canRemoveSection,
  createPlanDraft,
  draftFromEnginePagePlan,
  duplicateSectionKeys,
  fontPairById,
  isEdited,
  moveOp,
  planDraftOf,
  planFields,
  planProblems,
  sectionAnchor,
  swatchContrast,
  toEnginePagePlan,
  type PagePlanDraft,
} from './page-plan-draft';
import type { PlanOp, SwatchView } from './view-types';

const CLINIC = [
  'Header',
  'Hero',
  'Services',
  'Why us',
  'Doctors',
  'Testimonials',
  'FAQ',
  'Contact',
];

/* Calm, clinical, teal: every pair readable (text 17.4:1 on white, white 5.5:1 on teal). */
const SWATCHES: readonly SwatchView[] = [
  { role: 'background', hex: '#ffffff' },
  { role: 'surface', hex: '#f0fdfa' },
  { role: 'text', hex: '#0f172a' },
  { role: 'accent', hex: '#0f766e' },
  { role: 'onAccent', hex: '#ffffff' },
];

function clinic(sections: readonly string[] = CLINIC): PagePlanDraft {
  return createPlanDraft({
    subject: 'Dental clinic, Amman',
    sections,
    direction: {
      mood: 'Calm, clinical, teal',
      swatches: SWATCHES,
      fontPairId: 'reem-kufi--ibm-plex-sans-arabic',
    },
  });
}

const titles = (draft: PagePlanDraft): string[] => draft.sections.map(({ title }) => title);
const keyOf = (draft: PagePlanDraft, title: string): string =>
  draft.sections.find((section) => section.title === title)?.key ?? 'missing';

describe('limits, grounded in the engine (SPEC §4.11)', () => {
  it('needs two sections: below two regions the engine skips the build (build.skipped)', () => {
    /* run-build.ts: `if (tasks.length < 2)` emits `build.skipped` and runs one ordinary call. */
    expect(PLAN_MIN_SECTIONS).toBe(2);
  });

  it('holds at most the engine’s own maxTasks default', () => {
    expect(PLAN_MAX_SECTIONS).toBe(DEFAULT_AI_BUILD_MAX_TASKS);
    expect(PLAN_MAX_SECTIONS).toBe(12);
  });

  it('takes both limits from the engine’s page-plan constants, which its validator enforces', () => {
    expect(PLAN_MIN_SECTIONS).toBe(PAGE_PLAN_MIN_SECTIONS);
    expect(PLAN_MAX_SECTIONS).toBe(PAGE_PLAN_MAX_SECTIONS);
  });

  it('flags a plan under two or over twelve, and nothing else', () => {
    expect(planProblems(clinic(['Hero']))).toEqual(['min']);
    expect(
      planProblems(clinic(Array.from({ length: 13 }, (_u, i) => `S${String(i + 1)}`))),
    ).toEqual(['max']);
    expect(planProblems(clinic())).toEqual([]);
  });

  it('refuses a remove at two sections, and says so before it is tried', () => {
    const two = clinic(['Hero', 'Contact']);
    expect(canRemoveSection(two)).toBe(false);
    expect(applyPlanOp(two, { kind: 'remove', key: keyOf(two, 'Hero') })).toBe(two);
    expect(canRemoveSection(clinic(['Hero', 'Services', 'Contact']))).toBe(true);
  });

  it('refuses an add at twelve, and says so before it is tried', () => {
    const full = clinic(Array.from({ length: 12 }, (_u, i) => `S${String(i + 1)}`));
    expect(canAddSection(full)).toBe(false);
    expect(applyPlanOp(full, { kind: 'add', title: 'Pricing' })).toBe(full);
    expect(canAddSection(clinic())).toBe(true);
  });

  it('still lets a plan that arrived over the limit be brought back under it', () => {
    const over = clinic(Array.from({ length: 13 }, (_u, i) => `S${String(i + 1)}`));
    const trimmed = applyPlanOp(over, { kind: 'remove', key: keyOf(over, 'S13') });
    expect(planProblems(trimmed)).toEqual([]);
  });
});

describe('createPlanDraft', () => {
  it('keys each section and keeps the page order', () => {
    const draft = clinic();
    expect(titles(draft)).toEqual(CLINIC);
    expect(new Set(draft.sections.map(({ key }) => key)).size).toBe(CLINIC.length);
  });

  it('keeps keys and purposes the engine already gave', () => {
    const draft = createPlanDraft({
      subject: 'x',
      sections: [{ key: 'n1', title: 'Hero', purpose: 'Say what the clinic is' }, 'Contact'],
    });
    expect(draft.sections[0]).toEqual({
      key: 'n1',
      title: 'Hero',
      purpose: 'Say what the clinic is',
    });
    expect(draft.sections[1]?.key).not.toBe('n1');
  });

  it('reads the engine’s direction prose as the mood when there is no structure yet (E7)', () => {
    expect(
      createPlanDraft({ subject: 'x', sections: CLINIC, direction: 'Warm, bold' }).direction,
    ).toEqual({
      mood: 'Warm, bold',
    });
  });

  it('names the font pair for the direction line', () => {
    expect(clinic().direction?.fonts).toBe('Reem Kufi / IBM Plex Sans Arabic');
  });

  it('drops a section with no title, as the engine does: a region without a label is no task', () => {
    // run-build.ts `nodeTitle` returns undefined for a blank label, so `plannedTitles`
    // never lists that region and the build never writes it. A nameless row would be a
    // section the card promises and the engine skips.
    const draft = createPlanDraft({
      subject: 'x',
      sections: ['Hero', '   ', { key: 'n9', title: '' }, 'Contact'],
    });
    expect(titles(draft)).toEqual(['Hero', 'Contact']);
    expect(planProblems(draft)).toEqual([]);
  });

  it('counts the limits after the blank rows are gone', () => {
    expect(planProblems(createPlanDraft({ subject: 'x', sections: ['Hero', ''] }))).toEqual([
      'min',
    ]);
  });
});

describe('applyPlanOp: rename', () => {
  it('saves the new title, tidied', () => {
    const draft = clinic();
    const renamed = applyPlanOp(draft, {
      kind: 'rename',
      key: keyOf(draft, 'Testimonials'),
      title: '  Patient   stories ',
    });
    expect(titles(renamed)[5]).toBe('Patient stories');
    expect(renamed.sections[5]?.key).toBe(draft.sections[5]?.key);
  });

  it('refuses an empty title, the same title, or an unknown row (Esc-like: nothing changes)', () => {
    const draft = clinic();
    const key = keyOf(draft, 'FAQ');
    for (const op of [
      { kind: 'rename', key, title: '   ' },
      { kind: 'rename', key, title: 'FAQ' },
      { kind: 'rename', key: 'nope', title: 'Pricing' },
    ] satisfies PlanOp[]) {
      expect(applyPlanOp(draft, op)).toBe(draft);
    }
  });

  it('never mutates the draft it was given', () => {
    const draft = clinic();
    const snapshot = structuredClone(draft);
    applyPlanOp(draft, { kind: 'rename', key: keyOf(draft, 'FAQ'), title: 'Questions' });
    applyPlanOp(draft, { kind: 'move', key: keyOf(draft, 'FAQ'), to: 0 });
    expect(draft).toEqual(snapshot);
  });
});

describe('applyPlanOp: move (drag, Alt+arrows and the menu share one op)', () => {
  it('moves a section to an index, keeping its key', () => {
    const draft = clinic();
    const faq = keyOf(draft, 'FAQ');
    const moved = applyPlanOp(draft, { kind: 'move', key: faq, to: 2 });
    expect(titles(moved)).toEqual([
      'Header',
      'Hero',
      'FAQ',
      'Services',
      'Why us',
      'Doctors',
      'Testimonials',
      'Contact',
    ]);
    expect(moved.sections[2]?.key).toBe(faq);
  });

  it('clamps a drop past either end, and refuses a move to where it already is', () => {
    const draft = clinic();
    expect(
      titles(applyPlanOp(draft, { kind: 'move', key: keyOf(draft, 'Hero'), to: 99 })).at(-1),
    ).toBe('Hero');
    expect(
      titles(applyPlanOp(draft, { kind: 'move', key: keyOf(draft, 'Contact'), to: -3 }))[0],
    ).toBe('Contact');
    expect(applyPlanOp(draft, { kind: 'move', key: keyOf(draft, 'Hero'), to: 1 })).toBe(draft);
  });

  it('refuses a move to an index that is not a number, rather than sending the row to the top', () => {
    const draft = clinic();
    const faq = keyOf(draft, 'FAQ');
    for (const to of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(applyPlanOp(draft, { kind: 'move', key: faq, to })).toBe(draft);
    }
  });

  it('gives Alt+↑ / Alt+↓ an op, or null at the edge so the key does nothing', () => {
    const draft = clinic();
    expect(moveOp(draft, keyOf(draft, 'Hero'), -1)).toEqual({
      kind: 'move',
      key: keyOf(draft, 'Hero'),
      to: 0,
    });
    expect(moveOp(draft, keyOf(draft, 'Header'), -1)).toBeNull();
    expect(moveOp(draft, keyOf(draft, 'Contact'), 1)).toBeNull();
    expect(moveOp(draft, 'nope', 1)).toBeNull();
  });
});

describe('applyPlanOp: remove and add', () => {
  it('removes one section', () => {
    const draft = clinic();
    expect(
      titles(applyPlanOp(draft, { kind: 'remove', key: keyOf(draft, 'Doctors') })),
    ).not.toContain('Doctors');
  });

  it('adds at the end with a fresh key that no section has', () => {
    const draft = clinic();
    const added = applyPlanOp(draft, { kind: 'add', title: ' Pricing ' });
    expect(titles(added).at(-1)).toBe('Pricing');
    const keys = added.sections.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    const again = applyPlanOp(added, { kind: 'add', title: 'Gallery' });
    expect(new Set(again.sections.map(({ key }) => key)).size).toBe(again.sections.length);
  });

  it('refuses an empty name', () => {
    const draft = clinic();
    expect(applyPlanOp(draft, { kind: 'add', title: '  ' })).toBe(draft);
  });
});

describe('applyPlanOp: direction (set token, set fonts, set mood)', () => {
  it('sets one role’s colour, normalised, leaving the others', () => {
    const draft = clinic();
    const next = applyPlanOp(draft, { kind: 'setToken', role: 'accent', hex: '#0E7490' });
    expect(next.direction?.swatches?.find(({ role }) => role === 'accent')?.hex).toBe('#0e7490');
    expect(next.direction?.swatches).toHaveLength(5);
    expect(
      applyPlanOp(draft, { kind: 'setToken', role: 'text', hex: '#abc' }).direction?.swatches?.find(
        ({ role }) => role === 'text',
      )?.hex,
    ).toBe('#aabbcc');
  });

  it('refuses a colour that is not a hex code, or the same colour', () => {
    const draft = clinic();
    expect(applyPlanOp(draft, { kind: 'setToken', role: 'accent', hex: 'teal' })).toBe(draft);
    expect(applyPlanOp(draft, { kind: 'setToken', role: 'accent', hex: '#0F766E' })).toBe(draft);
  });

  it('adds a missing role in display order', () => {
    const partial = createPlanDraft({
      subject: 'x',
      sections: CLINIC,
      direction: { mood: 'm', swatches: [{ role: 'text', hex: '#111111' }] },
    });
    const next = applyPlanOp(partial, { kind: 'setToken', role: 'background', hex: '#ffffff' });
    expect(next.direction?.swatches?.map(({ role }) => role)).toEqual(['background', 'text']);
  });

  it('has nothing to edit when the plan carries no direction', () => {
    const bare = createPlanDraft({ subject: 'x', sections: CLINIC });
    expect(applyPlanOp(bare, { kind: 'setToken', role: 'text', hex: '#000000' })).toBe(bare);
    expect(applyPlanOp(bare, { kind: 'setMood', mood: 'Warm' })).toBe(bare);
  });

  it('sets a curated font pair by id and names it; an unknown id changes nothing', () => {
    const draft = clinic();
    const next = applyPlanOp(draft, { kind: 'setFonts', pairId: 'el-messiri--almarai' });
    expect(next.direction?.fontPairId).toBe('el-messiri--almarai');
    expect(next.direction?.fonts).toBe('El Messiri / Almarai');
    expect(applyPlanOp(draft, { kind: 'setFonts', pairId: 'comic-sans' })).toBe(draft);
  });

  it('sets the mood, tidied; an empty mood restores the old one', () => {
    const draft = clinic();
    expect(applyPlanOp(draft, { kind: 'setMood', mood: ' Warm,  bold ' }).direction?.mood).toBe(
      'Warm, bold',
    );
    expect(applyPlanOp(draft, { kind: 'setMood', mood: '' })).toBe(draft);
  });
});

describe('unique anchors', () => {
  it('derives an anchor a nav link can point at', () => {
    expect(sectionAnchor('Why us')).toBe('why-us');
    expect(sectionAnchor('  FAQ & Help ')).toBe('faq-help');
    expect(sectionAnchor('آراء المرضى')).toBe('اراء-المرضى');
  });

  it('folds what a keyboard may or may not type: tashkeel, tatweel, alef forms', () => {
    expect(sectionAnchor('الأسعار')).toBe(sectionAnchor('الاسعار'));
    expect(sectionAnchor('الخدمَات')).toBe(sectionAnchor('الخدمات'));
    expect(sectionAnchor('الخـدمات')).toBe(sectionAnchor('الخدمات'));
  });

  it('flags two sections that would share an anchor, and names both rows', () => {
    const draft = clinic(['Hero', 'FAQ', 'Contact', ' faq ']);
    expect(planProblems(draft)).toEqual(['duplicateTitle']);
    expect(duplicateSectionKeys(draft)).toEqual(
      new Set([draft.sections[1]?.key, draft.sections[3]?.key]),
    );
    expect(planProblems(clinic(['البطل', 'الأسعار', 'الاسعار']))).toEqual(['duplicateTitle']);
  });

  it('lets a rename create the clash, so Build can say why it is disabled', () => {
    const draft = clinic();
    const clash = applyPlanOp(draft, { kind: 'rename', key: keyOf(draft, 'FAQ'), title: 'hero' });
    expect(planProblems(clash)).toEqual(['duplicateTitle']);
  });

  it('never calls two titles with no letter or digit a clash: neither has a title anchor', () => {
    // «🎉» and «***» both fold to ''. Reading '' as a shared anchor told the person
    // «يحتاج كل قسم إلى اسم لا يتكرر» about two names that differ.
    const draft = clinic(['Hero', '🎉', '***', 'Contact']);
    expect(sectionAnchor('🎉')).toBe('');
    expect(duplicateSectionKeys(draft).size).toBe(0);
    expect(planProblems(draft)).toEqual([]);
  });

  it('anchors a title with no letter or digit by its stable key, never by nothing', () => {
    const draft = clinic(['Hero', '🎉', 'Contact']);
    const party = draft.sections[1];
    expect(party).toBeDefined();
    expect(sectionAnchor('🎉', party?.key)).toBe(party?.key);
    // A rename keeps the key, so the anchor a nav link points at does not move.
    const renamed = applyPlanOp(draft, { kind: 'rename', key: party?.key ?? '', title: '***' });
    expect(sectionAnchor('***', renamed.sections[1]?.key)).toBe(party?.key);
    // A title with letters is its own anchor, key or not.
    expect(sectionAnchor('Why us', 'section-9')).toBe('why-us');
  });

  it('still flags a real clash beside an anchor-less title', () => {
    const draft = clinic(['FAQ', '🎉', 'faq', '✨']);
    expect(duplicateSectionKeys(draft)).toEqual(
      new Set([draft.sections[0]?.key, draft.sections[2]?.key]),
    );
  });
});

describe('contrast, through the design-system gate (validateDesignSystem)', () => {
  it('passes a readable direction', () => {
    expect(planProblems(clinic())).toEqual([]);
  });

  it('flags text that does not read on the background', () => {
    const draft = applyPlanOp(clinic(), { kind: 'setToken', role: 'text', hex: '#dddddd' });
    expect(planProblems(draft)).toEqual(['contrast']);
  });

  it('flags text that reads on the background but not on the surface', () => {
    const draft = applyPlanOp(clinic(), { kind: 'setToken', role: 'surface', hex: '#1e293b' });
    expect(planProblems(draft)).toEqual(['contrast']);
  });

  it('flags the accent’s own text', () => {
    const draft = applyPlanOp(clinic(), { kind: 'setToken', role: 'onAccent', hex: '#14b8a6' });
    expect(planProblems(draft)).toEqual(['contrast']);
  });

  it('measures nothing when the plan carries no colours (E7 fallback)', () => {
    expect(
      planProblems(createPlanDraft({ subject: 'x', sections: CLINIC, direction: 'Warm' })),
    ).toEqual([]);
  });

  it('gives SwatchPopover a live verdict for each role, against what it sits on', () => {
    const direction = clinic().direction;
    expect(swatchContrast(direction, 'text')).toMatchObject({
      against: 'background',
      readable: true,
    });
    expect(swatchContrast(direction, 'surface')).toMatchObject({ against: 'text', readable: true });
    expect(swatchContrast(direction, 'onAccent')).toMatchObject({
      against: 'accent',
      readable: true,
    });
    expect(swatchContrast(direction, 'accent')).toMatchObject({ against: 'onAccent' });
    const black = swatchContrast(
      {
        mood: '',
        swatches: [
          { role: 'background', hex: '#ffffff' },
          { role: 'text', hex: '#000000' },
        ],
      },
      'background',
    );
    expect(black?.ratio).toBeCloseTo(21, 5);
    const low = applyPlanOp(clinic(), { kind: 'setToken', role: 'text', hex: '#dddddd' }).direction;
    expect(swatchContrast(low, 'text')?.readable).toBe(false);
  });

  it('has no verdict when the pair is incomplete', () => {
    expect(swatchContrast({ mood: '' }, 'text')).toBeNull();
    expect(swatchContrast(undefined, 'text')).toBeNull();
  });
});

describe('isEdited', () => {
  it('is false for the plan as it arrived', () => {
    const draft = clinic();
    expect(isEdited(draft, draft)).toBe(false);
    expect(isEdited(draft, clinic())).toBe(false);
  });

  it('is true after any change the build would read', () => {
    const draft = clinic();
    const ops: PlanOp[] = [
      { kind: 'rename', key: keyOf(draft, 'FAQ'), title: 'Questions' },
      { kind: 'move', key: keyOf(draft, 'FAQ'), to: 0 },
      { kind: 'remove', key: keyOf(draft, 'FAQ') },
      { kind: 'add', title: 'Pricing' },
      { kind: 'setToken', role: 'accent', hex: '#0e7490' },
      { kind: 'setFonts', pairId: 'el-messiri--almarai' },
      { kind: 'setMood', mood: 'Warm' },
    ];
    for (const op of ops) expect(isEdited(draft, applyPlanOp(draft, op))).toBe(true);
  });

  it('is false again once an edit is undone by hand', () => {
    const draft = clinic();
    const key = keyOf(draft, 'FAQ');
    const back = applyPlanOp(applyPlanOp(draft, { kind: 'rename', key, title: 'Questions' }), {
      kind: 'rename',
      key,
      title: 'FAQ',
    });
    expect(isEdited(draft, back)).toBe(false);
  });
});

describe('planFields: the PlanView fields this module owns', () => {
  it('carries the draft, whether it was edited, and what blocks Build', () => {
    const draft = clinic();
    const clash = applyPlanOp(draft, { kind: 'rename', key: keyOf(draft, 'FAQ'), title: 'Hero' });
    expect(planFields(draft, clash)).toEqual({
      subject: 'Dental clinic, Amman',
      direction: clash.direction,
      sections: clash.sections,
      edited: true,
      problems: ['duplicateTitle'],
    });
    expect(planFields(draft, draft)).toMatchObject({ edited: false, problems: [] });
  });
});

describe('FONT_PAIRS: curated Arabic-capable pairs for FontPairMenu', () => {
  it('has unique ids, a heading and a body face each', () => {
    expect(FONT_PAIRS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(FONT_PAIRS.map(({ id }) => id)).size).toBe(FONT_PAIRS.length);
    for (const pair of FONT_PAIRS) {
      expect(pair.heading.trim()).not.toBe('');
      expect(pair.body.trim()).not.toBe('');
    }
  });

  it('finds a pair by id', () => {
    expect(fontPairById('reem-kufi--ibm-plex-sans-arabic')).toEqual({
      id: 'reem-kufi--ibm-plex-sans-arabic',
      heading: 'Reem Kufi',
      body: 'IBM Plex Sans Arabic',
    });
    expect(fontPairById('nope')).toBeUndefined();
  });
});

/* ── The engine's structured plan (SPEC §7.6 E6, E7): edit it, build it verbatim ── */

describe('the engine’s PagePlan, edited on the card and built as shown', () => {
  const plan = clinicPlan();
  const draft = draftFromEnginePagePlan(plan);
  const built = (edited: PagePlanDraft): PagePlan => {
    const result = toEnginePagePlan(edited);
    if (!result?.ok) throw new Error(`refused: ${JSON.stringify(result)}`);
    return result.plan;
  };
  const keyed = (key: string) => (section: { readonly key: string }) => section.key === key;

  it('reads the plan as rows, a subject and a direction, and gives the same plan back', () => {
    expect(draft.subject).toBe('عيادة الابتسامة');
    expect(draft.sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'services',
      'doctors',
      'booking',
      'footer',
    ]);
    expect(draft.direction).toEqual({
      mood: 'رقم الهاتف كبيرًا فوق زر الحجز',
      swatches: [
        { role: 'background', hex: '#fbfbfd' },
        { role: 'surface', hex: '#ffffff' },
        { role: 'text', hex: '#0e1116' },
        { role: 'accent', hex: '#0f766e' },
        { role: 'onAccent', hex: '#ffffff' },
      ],
      fonts: 'Reem Kufi / IBM Plex Sans Arabic',
      fontPairId: 'reem-kufi--ibm-plex-sans-arabic',
    });
    expect(planProblems(draft)).toEqual([]);
    // Untouched, the card builds exactly what the engine planned: the real validator agrees.
    expect(built(draft)).toEqual(plan);
  });

  it('builds a renamed section under its new title, its anchor and its nav link kept', () => {
    const renamed = applyPlanOp(draft, { kind: 'rename', key: 'services', title: 'العلاجات' });
    const result = built(renamed);
    expect(result.sections.find(keyed('services'))).toMatchObject({
      title: 'العلاجات',
      anchorId: 'services',
      purpose: 'خدمات العيادة الست بسطر لكل خدمة.',
    });
    // The nav label was the section's title, so it follows the rename.
    expect(result.nav[0]).toEqual({ label: 'العلاجات', anchorId: 'services' });
  });

  it('builds the sections in the order the person moved them to', () => {
    const moved = applyPlanOp(draft, { kind: 'move', key: 'doctors', to: 2 });
    expect(built(moved).sections.map(({ key }) => key)).toEqual([
      'header',
      'hero',
      'doctors',
      'services',
      'booking',
      'footer',
    ]);
  });

  it('refuses an op the engine would refuse for its shape, as it refuses an empty name', () => {
    // The header opens the page, the hero follows it, the footer closes it, one hero only.
    expect(applyPlanOp(draft, { kind: 'move', key: 'header', to: 3 })).toBe(draft);
    expect(applyPlanOp(draft, { kind: 'move', key: 'footer', to: 2 })).toBe(draft);
    expect(applyPlanOp(draft, { kind: 'remove', key: 'hero' })).toBe(draft);
    // A section title the page cannot carry (the engine's 80 characters).
    expect(applyPlanOp(draft, { kind: 'rename', key: 'doctors', title: 'ط'.repeat(81) })).toBe(
      draft,
    );
  });

  it('adds a section before the footer, as a band keyed and anchored by its stable key', () => {
    const added = applyPlanOp(draft, { kind: 'add', title: 'الأسعار' });
    expect(added.sections.map(({ title }) => title).slice(-2)).toEqual(['الأسعار', 'التذييل']);
    const section = built(added).sections.at(-2);
    expect(section).toMatchObject({ role: 'band', title: 'الأسعار', purpose: 'الأسعار' });
    // Anchors are Latin slugs even on an Arabic page: the key is one, and stable.
    expect(section?.anchorId).toBe(section?.key);
    expect(section?.key).toMatch(/^[a-z][a-z0-9-]*$/u);
  });

  it('adds a section named with no letters without a false clash', () => {
    const party = applyPlanOp(applyPlanOp(draft, { kind: 'add', title: '🎉' }), {
      kind: 'add',
      title: '***',
    });
    expect(party.sections).toHaveLength(8);
    expect(planProblems(party)).toEqual([]);
    expect(built(party).sections).toHaveLength(8);
  });

  it('removes the CTA’s section and points the CTA at the one that took its place', () => {
    const removed = applyPlanOp(draft, { kind: 'remove', key: 'booking' });
    const result = built(removed);
    expect(result.primaryCta).toEqual({ label: 'احجز موعدًا', href: '#contact' });
    expect(result.nav.map(({ anchorId }) => anchorId)).toEqual(['services', 'doctors']);
    expect(result.facts.map(({ key }) => key)).toEqual(['hours']);
  });

  it('maps the swatches onto the plan’s tokens, and lets the engine re-derive what follows them', () => {
    const dark = [
      { role: 'background', hex: '#0e1116' },
      { role: 'surface', hex: '#1f2937' },
      { role: 'text', hex: '#fbfbfd' },
    ] as const;
    let edited = draft;
    for (const { role, hex } of dark) edited = applyPlanOp(edited, { kind: 'setToken', role, hex });
    const tokens = built(edited).tokens;
    expect(tokens).toMatchObject({ bg: '#0e1116', surface: '#1f2937', ink: '#fbfbfd' });
    // The old muted slate no longer reads on the dark grounds: it follows the ink.
    expect(tokens.muted).toBe('#fbfbfd');
    // The teal no longer reads as text on the dark ground: the engine derives the ink.
    expect(tokens.accentInk).toBe('#fbfbfd');
  });

  it('lets an unreadable colour through and names it, as the card must say why Build is off', () => {
    const faint = applyPlanOp(draft, { kind: 'setToken', role: 'text', hex: '#d1d5db' });
    expect(faint).not.toBe(draft);
    expect(planProblems(faint)).toEqual(['contrast']);
    const result = toEnginePagePlan(faint);
    expect(result?.ok).toBe(false);
    expect(result?.ok === false ? result.issues.map(({ path }) => path) : []).toContain(
      'tokens.ink',
    );
  });

  it('sets the faces from a curated pair, keeping weights a face ships and no others', () => {
    const paired = applyPlanOp(draft, { kind: 'setFonts', pairId: 'el-messiri--almarai' });
    const { fontDisplay, fontBody } = built(paired).tokens;
    expect(fontDisplay).toMatchObject({ family: 'El Messiri', weights: [500, 700] });
    // Almarai has no 600: one wrong weight drops every face in the import, so the engine's
    // own default for it is taken instead.
    expect(fontBody).toMatchObject({ family: 'Almarai', weights: [400, 700] });
  });

  it('builds the mood as the plan’s signature', () => {
    const mood = applyPlanOp(draft, { kind: 'setMood', mood: 'هادئ ونظيف، والأخضر للحجز' });
    expect(built(mood).tokens.signature).toBe('هادئ ونظيف، والأخضر للحجز');
  });

  it('has no engine plan to give for a draft made from titles alone', () => {
    expect(toEnginePagePlan(clinic())).toBeUndefined();
  });

  it('rebuilds the draft a stored turn holds, and builds the person’s edits from it', () => {
    const edited = applyPlanOp(draft, { kind: 'rename', key: 'doctors', title: 'فريقنا' });
    // What a page-plan turn stores, through JSON as the session store keeps it.
    const stored = JSON.parse(
      JSON.stringify({
        subject: edited.subject,
        sections: edited.sections,
        direction: edited.direction,
        enginePlan: plan,
      }),
    ) as Parameters<typeof planDraftOf>[0];
    expect(built(planDraftOf(stored))).toEqual(built(edited));
    expect(built(planDraftOf(stored)).sections.find(keyed('doctors'))?.title).toBe('فريقنا');
  });
});

describe('FONT_PAIRS are the engine’s verified faces (its own validator is the judge)', () => {
  it.each(FONT_PAIRS.map((pair) => [pair.id]))(
    '%s builds on an Arabic and an English page',
    (id) => {
      const english = draftFromEnginePagePlan(
        validatedPlan({ ...clinicPlanCandidate(), locale: { lang: 'en' } }),
      );
      for (const base of [draftFromEnginePagePlan(clinicPlan()), english]) {
        const paired = applyPlanOp(base, { kind: 'setFonts', pairId: id });
        const result = toEnginePagePlan(paired);
        expect(result?.ok, id).toBe(true);
      }
    },
  );
});
