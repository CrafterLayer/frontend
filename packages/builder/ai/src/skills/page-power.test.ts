import { describe, expect, it } from 'vitest';

import { isLucideIconName, utilityVocabulary } from '@craftkit/builder-schema';

import { PHOTO_CATALOG } from '../context/providers/photo-catalog';
import {
  DIRECTION_DECK_ROWS,
  directionDeckImportUrl,
  type DeckFace,
  type DirectionDeckRow,
} from './direction-deck';
import { CRAFTKIT_AI_SKILL_DEFINITIONS, createCraftkitAiSkillRegistry } from './index';
import { SECTION_VARIANT_PARTS, SECTION_VARIANTS } from './section-variants';
import { NO_TASHKEEL_FACES, ONE_STEP_UP_FACES, VERIFIED_FONT_FAMILIES } from './verified-fonts';

/*
  Mirrors builtins.test.ts: floor + any single skill (with its dependencies)
  stays under this. A new skill earns no exemption.
*/
const SINGLE_SKILL_TOKEN_CEILING = 2_800;

const registry = createCraftkitAiSkillRegistry();

function definition(id: string) {
  const found = CRAFTKIT_AI_SKILL_DEFINITIONS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`missing ${id}`);
  return found;
}

function skillText(id: string): string {
  const skill = definition(id);
  return [skill.instructions, ...Object.values(skill.references ?? {})].join('\n');
}

/*
  The utility families worth checking, as builtins.test.ts lists them, so
  prose hyphens ("type-led", "full-bleed") stay prose.
*/
const CLASS_FAMILY =
  /^-?(bg|text|border|from|via|to|p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me|gap|space|divide|font|tracking|leading|whitespace|line-clamp|tabular-nums|flex|grid|block|inline|inline-block|inline-flex|hidden|shrink|grow|items|justify|self|order|col|row|relative|absolute|fixed|sticky|isolate|inset|top|bottom|start|end|z|w|h|max-w|min-w|min-h|max-h|aspect|rounded|shadow|ring|opacity|object|overflow|blur|transition|duration|delay|ease|animate|scale|translate|transform|sr-only|italic|underline|uppercase|lowercase|capitalize|size|snap|grayscale|mix-blend|drop-shadow|backdrop|place|content|list|decoration|underline-offset)(-|$)/u;

/**
 * Every class-shaped token a recipe writes, INCLUDING the slashed ones the
 * builtins guard skips as prose (`from-black/70` was absent from the
 * vocabulary until 2026-09-28, and a recipe naming it would have shipped).
 * Palette slots (`bg-{card}`), icon lists, quoted attribute values,
 * bracketed placeholders and «…» copy are removed first.
 */
function classTokens(text: string): readonly string[] {
  const stripped = text
    .replace(/\{[^}]*\}/gu, 'SLOT')
    .replace(/icons?\s+[a-z0-9-]+(?:\s*\/\s*[a-z0-9-]+)*/gu, ' ')
    .replace(/'[^']*'/gu, ' ')
    .replace(/\[[^\]]*\]/gu, ' ')
    .replace(/«[^»]*»/gu, ' ');
  return stripped
    .split(/[\s"`<>(),;{}+×]+/u)
    .map((token) => token.replace(/[.:,;]+$/u, ''))
    .filter((token) => /^[a-z0-9:/.-]+$/u.test(token))
    .filter((token) => !token.endsWith('-') && !token.startsWith('ck-') && !token.includes('*'))
    .filter((token) => !/^(?:https?|mailto|tel):/u.test(token))
    .filter(
      (token) =>
        /^[a-z0-9-]+:[a-z-]/u.test(token) ||
        /^-?[a-z]+(?:-[a-z0-9.]+)*-(?:[a-z]+\/\d+|\d+\/\d+)$/u.test(token) ||
        (CLASS_FAMILY.test(token) && token.includes('-')),
    );
}

function unknownClasses(text: string): readonly string[] {
  const vocabulary = utilityVocabulary();
  return [...new Set(classTokens(text))].filter((token) => !vocabulary.has(token));
}

function iconNames(text: string): readonly string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/icons?\s+([a-z0-9-]+(?:\s*\/\s*[a-z0-9-]+)*)/gu)) {
    names.push(...(match[1] ?? '').split(/\s*\/\s*/u));
  }
  return names.filter((name) => !['size', 'and', 'or', 'beside', 'in', 'with'].includes(name));
}

function tokensFor(id: string): number {
  return registry.prepare({ request: '', selectedSkillIds: [id], auto: false }).totalTokens;
}

// ── Tailwind v3 hex, the contrast yardstick the research computed on ────────
/*
  Tailwind v4 is OKLCH; the deltas against these v3 values are small but real,
  so every pair below keeps a margin rather than scraping 4.5.
*/
const HEX: Readonly<Record<string, string>> = {
  white: '#ffffff',
  black: '#000000',
  'stone-50': '#fafaf9',
  'stone-100': '#f5f5f4',
  'stone-200': '#e7e5e4',
  'stone-300': '#d6d3d1',
  'stone-400': '#a8a29e',
  'stone-600': '#57534e',
  'stone-900': '#1c1917',
  'stone-950': '#0c0a09',
  'slate-50': '#f8fafc',
  'slate-300': '#cbd5e1',
  'slate-600': '#475569',
  'slate-900': '#0f172a',
  'slate-950': '#020617',
  'zinc-50': '#fafafa',
  'zinc-100': '#f4f4f5',
  'zinc-300': '#d4d4d8',
  'zinc-400': '#a1a1aa',
  'zinc-600': '#52525b',
  'zinc-900': '#18181b',
  'zinc-950': '#09090b',
  'neutral-50': '#fafafa',
  'neutral-100': '#f5f5f5',
  'neutral-400': '#a3a3a3',
  'neutral-600': '#525252',
  'neutral-900': '#171717',
  'neutral-950': '#0a0a0a',
  'emerald-50': '#ecfdf5',
  'emerald-200': '#a7f3d0',
  'emerald-700': '#047857',
  'emerald-800': '#065f46',
  'emerald-950': '#022c22',
  'lime-50': '#f7fee7',
  'lime-200': '#d9f99d',
  'lime-800': '#3f6212',
  'orange-50': '#fff7ed',
  'orange-700': '#c2410c',
  'orange-800': '#9a3412',
  'red-50': '#fef2f2',
  'red-200': '#fecaca',
  'red-400': '#f87171',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-950': '#450a0a',
  'rose-50': '#fff1f2',
  'rose-200': '#fecdd3',
  'rose-700': '#be123c',
  'rose-800': '#9f1239',
  'rose-900': '#881337',
  'pink-50': '#fdf2f8',
  'pink-800': '#9d174d',
  'amber-300': '#fcd34d',
  'amber-400': '#fbbf24',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'yellow-400': '#facc15',
  'yellow-700': '#a16207',
  'yellow-800': '#854d0e',
  'teal-50': '#f0fdfa',
  'teal-200': '#99f6e4',
  'teal-700': '#0f766e',
  'teal-950': '#042f2e',
  'sky-50': '#f0f9ff',
  'sky-200': '#bae6fd',
  'sky-300': '#7dd3fc',
  'sky-700': '#0369a1',
  'sky-800': '#075985',
  'sky-950': '#082f49',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'cyan-50': '#ecfeff',
  'cyan-200': '#a5f3fc',
  'cyan-800': '#155e75',
  'cyan-950': '#083344',
};

function luminance(name: string): number {
  const hex = HEX[name];
  if (hex === undefined) throw new Error(`no hex for ${name}: add it or pick a listed shade`);
  const [red, green, blue] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

// ── craftkit.section-variants ────────────────────────────────────────────────

describe('craftkit.section-variants — a closed library of named layouts', () => {
  const ids = SECTION_VARIANTS.map(({ id }) => id);
  /** The recipes and the named parts they share, scanned as one. */
  const recipes: readonly (readonly [string, string])[] = [
    ...SECTION_VARIANTS.map(({ id, recipe }) => [id, recipe] as const),
    ...Object.entries(SECTION_VARIANT_PARTS),
  ];

  it('covers every section a page is built from, each id once', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'split',
      'centered',
      'overlay',
      'frame',
      'editorial',
      'grid',
      'list',
      'bento',
      'sticky',
      'zigzag',
      'steps',
      'cards',
      'quote',
      'stats',
      'pricing',
      'menu',
      'product',
      'listing',
      'team',
      'gallery',
      'rail',
      'faq',
      'contact',
      'band',
      'cta-split',
      'footer',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('writes every class of every recipe from the vocabulary, slashed ones included', () => {
    const unknown = recipes.flatMap(([id, recipe]) =>
      unknownClasses(recipe).map((token) => `${id}: ${token}`),
    );
    expect(unknown).toEqual([]);
  });

  /*
    One slot for the accent as TEXT, so the contract the deck checks is the
    one the recipes write: {accent} fills (buttons, badges, the steps rule),
    {accent-ink} is every accent-coloured glyph — step numbers, stats, icons.
  */
  it('writes accent text and icons in the ink slot, never the fill', () => {
    for (const [id, recipe] of recipes) {
      expect({ id, fillAsText: /\btext-\{accent\}/u.test(recipe) }).toEqual({
        id,
        fillAsText: false,
      });
    }
    const text = registry.readSkill('craftkit.section-variants');
    expect(text).toContain('{accent-ink}');
    expect(text).toMatch(/\{accent-ink\}[^.\n]*4\.5/u);
  });

  it('draws every colour from the direction: palette slots, never a hue or a site role', () => {
    for (const [id, recipe] of recipes) {
      expect({
        id,
        hue: /\b(?:bg|text|border|ring|from|via|to)-[a-z]+-\d{2,3}\b/u.exec(recipe),
      }).toEqual({
        id,
        hue: null,
      });
      expect({ id, role: /\b(?:bg|text)-(?:accent|surface|text)\b/u.exec(recipe) }).toEqual({
        id,
        role: null,
      });
    }
  });

  it('names only icons the renderer has', () => {
    const icons = SECTION_VARIANTS.flatMap(({ recipe }) => iconNames(recipe));
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.filter((name) => !isLucideIconName(name))).toEqual([]);
  });

  it('shows every variant in the skill it ships in', () => {
    const text = registry.readSkill('craftkit.section-variants');
    for (const id of ids) expect(text).toContain(`${id}:`);
  });

  it('puts local actions in the contact variant: WhatsApp, a phone call and a maps search', () => {
    const contact = SECTION_VARIANTS.find(({ id }) => id === 'contact')?.recipe ?? '';
    expect(contact).toContain("href='https://wa.me/");
    expect(contact).toContain("href='tel:");
    expect(contact).toContain("href='https://maps.google.com/?q=");
    expect(contact).toContain('message-circle');
  });

  it('never gives a testimonial a stranger’s face: both proof variants carry an initials monogram', () => {
    expect(SECTION_VARIANT_PARTS['MONOGRAM']).toContain('initials');
    for (const id of ['cards', 'quote']) {
      const recipe = SECTION_VARIANTS.find((variant) => variant.id === id)?.recipe ?? '';
      expect(recipe).toContain('MONOGRAM');
      expect(recipe).not.toMatch(/\bimg\b/u);
    }
  });

  it('defines every part a recipe names, in the skill it ships in', () => {
    const text = registry.readSkill('craftkit.section-variants');
    for (const [name, part] of Object.entries(SECTION_VARIANT_PARTS)) {
      expect(text).toContain(`${name} = ${part}`);
    }
    const used = new Set(
      SECTION_VARIANTS.flatMap(({ recipe }) => recipe.match(/\b[A-Z][A-Z0-9]+\b/gu) ?? []),
    );
    expect([...used].filter((name) => SECTION_VARIANT_PARTS[name] === undefined)).toEqual([]);
  });

  it('centres a short team row and keeps the faq column flush with its heading', () => {
    // Final test 2026-09-30: two initials cards left half a 4-column grid empty,
    // and a mx-auto faq column sat indented under a start-aligned heading.
    const recipe = (id: string) => SECTION_VARIANTS.find((variant) => variant.id === id)?.recipe ?? '';
    expect(recipe('team')).toMatch(/^div flex flex-wrap justify-center /u);
    expect(recipe('team')).not.toContain('grid-cols');
    expect(recipe('faq')).not.toContain('mx-auto');
    expect(recipe('faq')).toContain('flush with the h2');
  });

  it('keeps a zigzag photo first on phones and alternates it only from md up', () => {
    const zigzag = SECTION_VARIANTS.find(({ id }) => id === 'zigzag')?.recipe ?? '';
    expect(zigzag).toContain('md:order-last');
  });

  it('is explicit-only, depends on nothing, and fits under the single-skill ceiling', () => {
    const skill = definition('craftkit.section-variants');
    expect(skill.activation).toEqual({ mode: 'explicit' });
    expect(skill.dependencies ?? []).toEqual([]);
    expect(tokensFor('craftkit.section-variants')).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
  });
});

// ── craftkit.direction-deck ──────────────────────────────────────────────────

describe('craftkit.direction-deck — the look, decided once, from a wide menu', () => {
  const variantIds = new Set(SECTION_VARIANTS.map(({ id }) => id));
  const faces = (row: DirectionDeckRow): readonly DeckFace[] => [...row.arabic, ...row.latin];

  it('holds about twenty industry rows, each id once', () => {
    const ids = DIRECTION_DECK_ROWS.map(({ id }) => id);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(DIRECTION_DECK_ROWS.map((row) => [row.id, row] as const))(
    '%s: every pair it prescribes is readable (WCAG, Tailwind v3 hex)',
    (_id, { palette }) => {
      const pairs: readonly (readonly [string, string, string, number])[] = [
        ['ink on ground', palette.ink, palette.ground, 4.5],
        ['ink on card', palette.ink, palette.card, 4.5],
        ['muted on ground', palette.muted, palette.ground, 4.5],
        ['muted on card', palette.muted, palette.card, 4.5],
        ['on-accent on accent', palette.onAccent, palette.accent, 4.5],
        /*
          The accent as TEXT — a step number in text-sm, a stat, an icon — is
          the ink, never the fill. Held to 4.5 on the ground AND the card, the
          small-text bar, so one class serves every size. Measured 2026-09-28
          (wave-1 verifier): the construction row's recipes wrote text-{accent}
          = text-yellow-400 on white at 1.57:1, and the auto row's red-600 on
          its neutral-900 card at 3.76.
        */
        ['accent ink on ground', palette.accentInk, palette.ground, 4.5],
        ['accent ink on card', palette.accentInk, palette.card, 4.5],
        ['band text on band', palette.bandText, palette.band, 4.5],
        ['band muted on band', palette.bandMuted, palette.band, 4.5],
      ];
      const failing = pairs
        .map(([label, foreground, background, minimum]) => ({
          label,
          ratio: Math.round(contrast(foreground, background) * 100) / 100,
          minimum,
        }))
        .filter(({ ratio, minimum }) => ratio < minimum);
      expect(failing).toEqual([]);
    },
  );

  it('names every palette role as a class the vocabulary generates', () => {
    const vocabulary = utilityVocabulary();
    const missing = DIRECTION_DECK_ROWS.flatMap(({ id, palette }) =>
      [
        `bg-${palette.ground}`,
        `bg-${palette.card}`,
        `text-${palette.ink}`,
        `text-${palette.muted}`,
        `bg-${palette.accent}`,
        `text-${palette.onAccent}`,
        `text-${palette.accentInk}`,
        `bg-${palette.band}`,
        `text-${palette.bandText}`,
        `text-${palette.bandMuted}`,
      ]
        .filter((name) => !vocabulary.has(name))
        .map((name) => `${id}: ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it('hands the ink to the direction line, row by row, and under VARIANT: B', () => {
    const text = registry.readSkill('craftkit.direction-deck');
    for (const { id, palette } of DIRECTION_DECK_ROWS) {
      const line =
        text.split('\n').find((candidate) => new RegExp(`^${id}[ :]`, 'u').test(candidate)) ?? '';
      // A fill that passes is its own ink, and printing it twice costs every scaffold tokens.
      const printed = palette.accentInk === palette.accent ? '' : `accent-ink ${palette.accentInk}`;
      expect({
        id,
        ink: printed === '' ? !line.includes('accent-ink') : line.includes(printed),
      }).toEqual({ id, ink: true });
    }
    // Swapped, the band is the ground: accent text takes the band muted, which reads on it.
    expect(text).toMatch(/VARIANT: B[^\n]*band muted[^\n]*accent text/iu);
  });

  it('names only verified faces, with weights each face actually ships', () => {
    for (const row of DIRECTION_DECK_ROWS) {
      for (const face of faces(row)) {
        const family = VERIFIED_FONT_FAMILIES[face.family];
        expect({ row: row.id, family: face.family, known: family !== undefined }).toEqual({
          row: row.id,
          family: face.family,
          known: true,
        });
        for (const weight of face.weights) expect(family?.weights).toContain(weight);
      }
      for (const face of row.arabic) expect(VERIFIED_FONT_FAMILIES[face.family]?.arabic).toBe(true);
    }
  });

  it('builds each import URL in the form the verified fetch used', () => {
    const cafe = DIRECTION_DECK_ROWS.find(({ id }) => id === 'cafe');
    if (cafe === undefined) throw new Error('no cafe row');
    expect(directionDeckImportUrl(cafe.arabic)).toBe(
      'https://fonts.googleapis.com/css2?family=Lalezar&family=Almarai:wght@400;700&display=swap',
    );
    // One family for display and body is imported once, with both weights.
    const dental = DIRECTION_DECK_ROWS.find(({ id }) => id === 'dental');
    if (dental === undefined) throw new Error('no dental row');
    expect(directionDeckImportUrl(dental.arabic)).toBe(
      'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap',
    );
  });

  it('names a section-variants id for every section, and opens with a hero variant', () => {
    const heroes = new Set(['split', 'centered', 'overlay', 'frame', 'editorial']);
    for (const row of DIRECTION_DECK_ROWS) {
      expect(row.sections.length).toBeGreaterThanOrEqual(4);
      expect(heroes.has(row.sections[0]?.[1] ?? '')).toBe(true);
      for (const [, variant] of row.sections) expect(variantIds.has(variant)).toBe(true);
    }
  });

  it('points only at photo subjects the catalog holds', () => {
    const topics = new Set(PHOTO_CATALOG.map(({ topic }) => topic));
    for (const row of DIRECTION_DECK_ROWS) {
      for (const topic of row.photos) expect(topics.has(topic)).toBe(true);
    }
  });

  /*
    The measured monoculture, 9 recorded skeletons of 9 (2026-09-28): Cairo
    headings, an amber accent, 8 of them on a cream stone-50 ground, and 5 a
    glow or circle behind the headline. The deck exists to make those one
    choice among many, not the answer.
  */
  it('steers away from the measured monoculture', () => {
    const cream = new Set(['stone-50', 'amber-50', 'orange-50', 'yellow-50']);
    const warmAccent = /^(?:amber|orange|yellow)-/u;
    for (const row of DIRECTION_DECK_ROWS) {
      expect({
        row: row.id,
        creamAndAmber: cream.has(row.palette.ground) && warmAccent.test(row.palette.accent),
      }).toEqual({ row: row.id, creamAndAmber: false });
      expect(row.signature).not.toMatch(/glow|blob|blur|circle behind/iu);
      expect(row.palette.accent).not.toMatch(/^(?:violet|purple|fuchsia|indigo)-/u);
    }

    const displays = DIRECTION_DECK_ROWS.map(({ arabic }) => arabic[0].family);
    expect(displays).not.toContain('Cairo');
    expect(displays).not.toContain('Tajawal');
    const perFace = new Map<string, number>();
    for (const family of displays) perFace.set(family, (perFace.get(family) ?? 0) + 1);
    expect(Math.max(...perFace.values())).toBeLessThanOrEqual(2);
    expect(perFace.size).toBeGreaterThanOrEqual(14);
    const cairoBodies = DIRECTION_DECK_ROWS.filter(({ arabic }) => arabic[1].family === 'Cairo');
    expect(cairoBodies.length).toBeLessThanOrEqual(1);
  });

  it('renders every row, the import rule and the two rendering rules into its instructions', () => {
    const text = registry.readSkill('craftkit.direction-deck');
    for (const row of DIRECTION_DECK_ROWS) expect(text).toMatch(new RegExp(`^${row.id}[ :]`, 'mu'));
    expect(text).toContain('https://fonts.googleapis.com/css2?family=');
    expect(text).toMatch(/400/u);
    for (const face of NO_TASHKEEL_FACES) expect(text).toContain(face);
    for (const face of ONE_STEP_UP_FACES) expect(text).toContain(face);
    expect(text).toContain('VARIANT: B');
    // The direction line carries the section variants the fills read back.
    expect(text).toMatch(/Hero\[[a-z-]+\]/u);
  });

  it('is explicit-only, carries no command restriction, and fits under the ceiling', () => {
    const skill = definition('craftkit.direction-deck');
    expect(skill.activation).toEqual({ mode: 'explicit' });
    expect(skill.restrictToCommands).toBeUndefined();
    expect(tokensFor('craftkit.direction-deck')).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
  });
});

// ── craftkit.photo-direction ─────────────────────────────────────────────────

describe('craftkit.photo-direction — photos from the list, never from memory', () => {
  const text = skillText('craftkit.photo-direction');

  it('reads the provider’s fragment by its exact title', () => {
    expect(text).toContain('PHOTOS YOU MAY USE');
  });

  it('forbids an address from memory and every placeholder service', () => {
    expect(text).toMatch(/never from memory/iu);
    expect(text).toMatch(/placeholder/iu);
  });

  it('says where photos go and how many, and how text sits on one', () => {
    for (const word of ['hero', 'gallery', 'about']) expect(text.toLowerCase()).toContain(word);
    expect(text).toMatch(/darkening layer/iu);
    expect(unknownClasses(text)).toEqual([]);
  });

  it('keeps stock faces away from invented names: initials instead', () => {
    expect(text).toMatch(/face/iu);
    expect(text).toMatch(/monogram|initials/iu);
  });

  it('is explicit-only and fits under the ceiling', () => {
    expect(definition('craftkit.photo-direction').activation).toEqual({ mode: 'explicit' });
    expect(tokensFor('craftkit.photo-direction')).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
  });
});

// ── Industry page types ──────────────────────────────────────────────────────

describe('industry page types — each one replaces page-composition for its trade', () => {
  const INDUSTRY = [
    'craftkit.menu-page',
    'craftkit.clinic-page',
    'craftkit.shop-page',
    'craftkit.property-page',
  ] as const;

  const rows: readonly (readonly [string, (typeof INDUSTRY)[number]])[] = [
    ['صفحة هبوط لمقهى قهوة مختصة في عمّان', 'craftkit.menu-page'],
    ['موقع لمطعم مشاوي', 'craftkit.menu-page'],
    ['حلويات شرقية وكنافة', 'craftkit.menu-page'],
    ['Build a landing page for my bakery', 'craftkit.menu-page'],
    ['موقع لعيادة اسنان في الرياض', 'craftkit.clinic-page'],
    ['صفحة لمركز طبي', 'craftkit.clinic-page'],
    ['A booking page for a dental clinic', 'craftkit.clinic-page'],
    ['صالون تجميل نسائي', 'craftkit.clinic-page'],
    ['متجر عطور وبخور', 'craftkit.shop-page'],
    ['متجر عبايات أونلاين', 'craftkit.shop-page'],
    ['An online store for handmade soap', 'craftkit.shop-page'],
    ['شقق للبيع في دبي', 'craftkit.property-page'],
    ['مكتب عقارات وفلل للإيجار', 'craftkit.property-page'],
    ['Real estate listings for villas in Amman', 'craftkit.property-page'],
  ];

  it.each(rows)('"%s" activates %s in place of page-composition', (request, expected) => {
    const prepared = registry.prepare({ request, auto: true });
    const active = prepared.active.map(({ id }) => id);

    expect(active).toContain(expected);
    expect(active).not.toContain('craftkit.page-composition');
    expect(INDUSTRY.filter((id) => active.includes(id))).toEqual([expected]);
    // copywriting + visual-direction + the page type (+ arabic-rtl): one of each kind.
    expect(active.length - 1).toBeLessThanOrEqual(4);
    expect(prepared.totalTokens).toBeLessThanOrEqual(3_400);
  });

  it.each([
    'Add more space between the sections',
    'Change the dropdown menu colour',
    'restore the original header',
    'صفحة لشركة سعودية للاستشارات',
    'A page for our village festival',
    'Change the font property of the title',
  ])('stays silent on "%s"', (request) => {
    const active = registry.prepare({ request, auto: true }).active.map(({ id }) => id);
    expect(INDUSTRY.filter((id) => active.includes(id))).toEqual([]);
  });

  it.each(INDUSTRY)('%s never rides an explicit surgical run', (id) => {
    const prepared = registry.prepare({
      request: 'غيّر عنوان قسم المنيو في مطعم عيادة متجر عقارات',
      selectedSkillIds: ['craftkit.precise-edit'],
    });
    expect(prepared.active.map(({ id: active }) => active)).not.toContain(id);
  });

  it.each(INDUSTRY)('%s stays under the single-skill ceiling with its dependencies', (id) => {
    expect(tokensFor(id)).toBeLessThan(SINGLE_SKILL_TOKEN_CEILING);
  });

  it.each(INDUSTRY)('%s writes only vocabulary classes and renderer icons', (id) => {
    const text = skillText(id);
    expect(unknownClasses(text)).toEqual([]);
    expect(iconNames(text).filter((name) => !isLucideIconName(name))).toEqual([]);
  });

  it.each(INDUSTRY)('%s converts locally: WhatsApp first, then a call, hours and a map', (id) => {
    const text = skillText(id);
    expect(text).toContain('wa.me');
    expect(text).toContain('tel:');
    expect(text).toMatch(/maps\.google\.com/u);
    expect(text).toMatch(/hours|ساعات/iu);
  });

  it('keeps a doctor’s name and licence a person’s own fact, never invented', () => {
    expect(skillText('craftkit.clinic-page')).toMatch(/person['’]s own facts/iu);
  });
});

// ── Font families named anywhere ─────────────────────────────────────────────

/*
  Google Fonts families that carry the Arabic subset (ui-ux-pro-max
  google-fonts.csv, MIT, read 2026-09-28): the names a skill could mention.
  Each one a skill names must be in the verified table, so the deck, the RTL
  rules and the taste rules can never drift apart again.
*/
const GOOGLE_ARABIC_FAMILIES = [
  'Alexandria',
  'Alkalami',
  'Almarai',
  'Alyamama',
  'Amiri',
  'Aref Ruqaa',
  'Badeen Display',
  'Baloo Bhaijaan 2',
  'Beiruti',
  'Blaka',
  'Cairo',
  'Changa',
  'El Messiri',
  'Estedad',
  'Fustat',
  'Gulzar',
  'Harmattan',
  'IBM Plex Sans Arabic',
  'Jomhuria',
  'Katibeh',
  'Kufam',
  'Lalezar',
  'Lateef',
  'Lemonada',
  'Mada',
  'Marhey',
  'Markazi Text',
  'Mirza',
  'Noto Kufi Arabic',
  'Noto Naskh Arabic',
  'Noto Sans Arabic',
  'Playpen Sans Arabic',
  'Qahiri',
  'Rakkas',
  'Readex Pro',
  'Reem Kufi',
  'Rubik',
  'Ruwudu',
  'Scheherazade New',
  'Tajawal',
  'Vazirmatn',
  'Zain',
] as const;

describe('fonts a skill names', () => {
  it.each(CRAFTKIT_AI_SKILL_DEFINITIONS.map((skill) => [skill.id] as const))(
    '%s names only verified Arabic families',
    (id) => {
      const text = skillText(id);
      const named = GOOGLE_ARABIC_FAMILIES.filter((family) =>
        new RegExp(`(?<![A-Za-z])${family.replaceAll(' ', '[ +]')}(?![A-Za-z])`, 'u').test(text),
      );
      expect(named.filter((family) => VERIFIED_FONT_FAMILIES[family] === undefined)).toEqual([]);
    },
  );

  it('no skill hands the model the old four-face default list', () => {
    for (const skill of CRAFTKIT_AI_SKILL_DEFINITIONS) {
      expect({ id: skill.id, list: skillText(skill.id).includes('Cairo, Tajawal') }).toEqual({
        id: skill.id,
        list: false,
      });
    }
  });
});
