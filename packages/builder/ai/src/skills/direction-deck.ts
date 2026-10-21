import type { PhotoTopic } from '../context/providers/photo-catalog.data';
import type { AiSkillDefinitionV1 } from './types';

/**
 * The industry direction deck: the look of a page, decided once, from a wide
 * and checked menu.
 *
 * ## The failure it answers
 *
 * Measured 2026-09-28 over the 9 recorded page skeletons: Cairo headings in 9
 * of 9, an amber accent in 9 of 9 — 8 of them on a cream stone-50 ground —
 * and a glow or circle behind the headline in 5. That is the first look the
 * frontend-design guidance lists as the AI default, and it is what the skills
 * themselves offered: four Arabic faces, one warm palette, "one glow". A
 * model asked to be distinctive with nothing to choose from picks the most
 * likely thing, every time.
 *
 * ## What a row is
 *
 * One trade's starting point: a palette by ROLE whose every pair was computed
 * (WCAG, ≥4.5 for text — the accent's INK on the ground and on the card too,
 * page-power.test.ts recomputes them), an Arabic and a Latin font pair whose import URLs were
 * fetched with exactly these weights, a named section-variants layout per
 * section, the catalog subjects its photos come from, and ONE signature. Rows
 * adapted from the page-power research table (Tailwind v3 hex contrast;
 * v4's OKLCH shifts are small, so every pair keeps a margin).
 *
 * Explicit-only: the orchestrator loads it for the skeleton pass alone, where
 * the direction is decided. Section writers never see it — they receive the
 * direction line it produced.
 */

export interface DeckFace {
  readonly family: string;
  /** The weights to import; empty for a one-weight face, imported bare. */
  readonly weights: readonly number[];
}

export interface DeckPalette {
  readonly ground: string;
  readonly card: string;
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
  readonly onAccent: string;
  /**
   * The accent as TEXT and icons — a step number, a stat, a check — at ≥4.5:1
   * on the ground AND the card, the small-text bar, so one class serves every
   * size. The fill when it passes; a darker (or, on a dark ground, lighter)
   * shade when it does not. It was "≥3:1 on the ground" and the recipes wrote
   * the FILL as text anyway: the construction row's text-yellow-400 on white
   * measured 1.57:1 (wave-1 verifier, 2026-09-28).
   */
  readonly accentInk: string;
  readonly band: string;
  readonly bandText: string;
  readonly bandMuted: string;
}

export interface DirectionDeckRow {
  readonly id: string;
  readonly trades: string;
  readonly palette: DeckPalette;
  /** Display face, body face. */
  readonly arabic: readonly [DeckFace, DeckFace];
  readonly latin: readonly [DeckFace, DeckFace];
  /** [section name, section-variants id], the hero first. */
  readonly sections: readonly (readonly [string, string])[];
  readonly photos: readonly PhotoTopic[];
  readonly signature: string;
}

const face = (family: string, ...weights: number[]): DeckFace => ({ family, weights });

function palette(surfaces: string, accent: string, band: string): DeckPalette {
  const [ground = '', card = '', ink = '', muted = ''] = surfaces.split(' ');
  const [fill = '', onAccent = '', accentInk = fill] = accent.split(' ');
  const [bandFill = '', bandText = '', bandMuted = ''] = band.split(' ');
  return {
    ground,
    card,
    ink,
    muted,
    accent: fill,
    onAccent,
    accentInk,
    band: bandFill,
    bandText,
    bandMuted,
  };
}

export const DIRECTION_DECK_ROWS: readonly DirectionDeckRow[] = [
  {
    id: 'cafe',
    trades: 'coffee roaster',
    palette: palette(
      'lime-50 white emerald-950 emerald-800',
      'orange-700 white',
      'emerald-950 lime-50 lime-200',
    ),
    arabic: [face('Lalezar'), face('Almarai', 400, 700)],
    latin: [face('Fraunces', 600, 700), face('Instrument Sans', 400, 500)],
    sections: [
      ['Hero', 'split'],
      ['Menu', 'menu'],
      ['Story', 'zigzag'],
      ['Visit', 'contact'],
    ],
    photos: ['cafe'],
    signature: 'the brand name at text-8xl, faint behind the menu',
  },
  {
    id: 'restaurant',
    trades: 'grill, mezze',
    palette: palette(
      'white stone-50 stone-900 stone-600',
      'red-700 white',
      'red-950 red-50 red-200',
    ),
    arabic: [face('El Messiri', 500, 700), face('Almarai', 400, 700)],
    latin: [face('DM Serif Display'), face('DM Sans', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Dishes', 'bento'],
      ['Menu', 'menu'],
      ['Review', 'quote'],
      ['Reserve', 'contact'],
    ],
    photos: ['restaurant'],
    signature: 'the dish photo bled under the hero',
  },
  {
    id: 'sweets',
    trades: 'bakery, patisserie',
    palette: palette(
      'white orange-50 stone-900 stone-600',
      'lime-800 white',
      'stone-900 orange-50 stone-300',
    ),
    arabic: [face('Lemonada', 500, 700), face('Tajawal', 400, 500)],
    latin: [face('Young Serif'), face('Instrument Sans', 400, 500)],
    sections: [
      ['Hero', 'frame'],
      ['Bestsellers', 'product'],
      ['Boxes', 'pricing'],
      ['Order', 'contact'],
    ],
    photos: ['sweets'],
    signature: 'one product photo in a rounded-full ring-8 ring-white frame',
  },
  {
    id: 'dental',
    trades: '',
    palette: palette(
      'white teal-50 slate-900 slate-600',
      'teal-700 white',
      'teal-950 teal-50 teal-200',
    ),
    arabic: [face('Vazirmatn', 600, 700), face('Vazirmatn', 400)],
    latin: [face('Sora', 600, 700), face('Nunito Sans', 400, 600)],
    sections: [
      ['Hero', 'split'],
      ['Services', 'list'],
      ['Doctors', 'team'],
      ['Booking', 'steps'],
      ['FAQ', 'faq'],
      ['Visit', 'contact'],
    ],
    photos: ['dental'],
    signature: 'the booking steps on a teal band',
  },
  {
    id: 'medical',
    trades: 'clinic, medical centre',
    palette: palette(
      'sky-50 white slate-900 slate-600',
      'sky-700 white sky-800',
      'sky-950 sky-50 sky-200',
    ),
    arabic: [face('IBM Plex Sans Arabic', 600), face('IBM Plex Sans Arabic', 400)],
    latin: [face('Sora', 600, 700), face('Nunito Sans', 400, 600)],
    sections: [
      ['Hero', 'split'],
      ['Specialties', 'sticky'],
      ['Doctors', 'team'],
      ['Insurance', 'list'],
      ['Booking', 'contact'],
    ],
    photos: ['medical'],
    signature: 'none: calm, spent on spacing',
  },
  {
    id: 'law',
    trades: 'notary',
    palette: palette(
      'white slate-50 slate-950 slate-600',
      'slate-900 white yellow-700',
      'slate-950 slate-50 slate-300',
    ),
    arabic: [face('Noto Kufi Arabic', 600, 700), face('Noto Sans Arabic', 400, 500)],
    latin: [face('Cormorant Garamond', 500, 600), face('Manrope', 400, 500)],
    sections: [
      ['Hero', 'editorial'],
      ['Practice', 'sticky'],
      ['Approach', 'steps'],
      ['Team', 'team'],
      ['Consult', 'cta-split'],
    ],
    photos: ['law'],
    signature: 'practice numerals at text-7xl in brass',
  },
  {
    id: 'realestate',
    trades: 'villas, apartments',
    palette: palette(
      'white stone-50 zinc-900 zinc-600',
      'emerald-800 white',
      'zinc-900 zinc-50 zinc-300',
    ),
    arabic: [face('Reem Kufi', 500, 700), face('IBM Plex Sans Arabic', 300, 400)],
    latin: [face('Space Grotesk', 500, 700), face('IBM Plex Sans', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Listings', 'listing'],
      ['Areas', 'gallery'],
      ['Proof', 'stats'],
      ['Agent', 'contact'],
    ],
    photos: ['realestate', 'city'],
    signature: 'a full-bleed aerial photo',
  },
  {
    id: 'gym',
    trades: 'fitness',
    palette: palette(
      'zinc-100 white zinc-950 zinc-600',
      'red-600 white red-700',
      'zinc-950 zinc-50 zinc-400',
    ),
    arabic: [face('Changa', 600, 800), face('Cairo', 400, 600)],
    latin: [face('Big Shoulders Display', 700, 800), face('Barlow', 400, 500)],
    sections: [
      ['Hero', 'centered'],
      ['Programs', 'bento'],
      ['Schedule', 'list'],
      ['Coaches', 'team'],
      ['Pricing', 'pricing'],
      ['Join', 'band'],
    ],
    photos: ['gym'],
    signature: 'an oversized text-8xl font-black headline',
  },
  {
    id: 'beauty',
    trades: 'salon, spa',
    palette: palette(
      'pink-50 white stone-900 stone-600',
      'pink-800 white',
      'stone-900 pink-50 stone-300',
    ),
    arabic: [face('Beiruti', 700, 800), face('Beiruti', 400)],
    latin: [face('Cormorant Garamond', 500, 600), face('Manrope', 400, 500)],
    sections: [
      ['Hero', 'frame'],
      ['Services', 'menu'],
      ['Gallery', 'gallery'],
      ['Booking', 'contact'],
    ],
    photos: [],
    signature: 'an arch frame, rounded-t-full',
  },
  {
    id: 'barber',
    trades: '',
    palette: palette(
      'neutral-950 neutral-900 neutral-50 neutral-400',
      'amber-500 neutral-950 amber-400',
      'neutral-900 neutral-50 neutral-400',
    ),
    arabic: [face('Alexandria', 800), face('Alexandria', 400)],
    latin: [face('Archivo Black'), face('Archivo', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Prices', 'menu'],
      ['Barbers', 'team'],
      ['Hours', 'contact'],
      ['Book', 'band'],
    ],
    photos: ['barber'],
    signature: 'the hero photo in grayscale',
  },
  {
    id: 'perfume',
    trades: 'oud, incense',
    palette: palette(
      'stone-950 stone-900 stone-50 stone-400',
      'amber-600 stone-950 amber-300',
      'red-950 red-50 red-200',
    ),
    arabic: [face('El Messiri', 500, 700), face('Noto Naskh Arabic', 400, 500)],
    latin: [face('Gloock'), face('Geist', 400, 500)],
    sections: [
      ['Hero', 'frame'],
      ['Collections', 'product'],
      ['Notes', 'list'],
      ['Gifts', 'bento'],
      ['Order', 'contact'],
    ],
    photos: ['perfume'],
    signature: 'a dark bottle photo in a ring-1 ring-amber-600 frame',
  },
  {
    id: 'wedding',
    trades: 'hall, events',
    palette: palette(
      'white rose-50 stone-900 stone-600',
      // yellow-700 read 4.48:1 on the rose-50 card; one step darker keeps the gold.
      'rose-800 white yellow-800',
      'rose-900 rose-50 rose-200',
    ),
    arabic: [face('Aref Ruqaa', 400, 700), face('Almarai', 400, 700)],
    latin: [face('Cormorant Garamond', 500, 600), face('Manrope', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Packages', 'pricing'],
      ['Gallery', 'gallery'],
      ['Review', 'quote'],
      ['Enquire', 'contact'],
    ],
    photos: ['wedding'],
    signature: 'the names in Aref Ruqaa at text-7xl',
  },
  {
    id: 'travel',
    trades: 'tours',
    palette: palette(
      'white orange-50 stone-900 stone-600',
      'orange-800 white',
      'sky-950 sky-50 sky-300',
    ),
    arabic: [face('Rubik', 500, 700), face('Rubik', 400)],
    latin: [face('Bricolage Grotesque', 600, 800), face('Figtree', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Trips', 'listing'],
      ['Itinerary', 'steps'],
      ['Review', 'quote'],
      ['Book', 'contact'],
    ],
    photos: ['travel'],
    signature: 'a trip-dates card lifted over the photo edge, md:-mt-16',
  },
  {
    id: 'construction',
    trades: 'contractor',
    palette: palette(
      'white zinc-100 zinc-900 zinc-600',
      'yellow-400 zinc-950 zinc-900',
      'zinc-900 zinc-50 zinc-400',
    ),
    arabic: [face('Fustat', 700, 800), face('Fustat', 400)],
    latin: [face('Archivo Black'), face('Archivo', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Services', 'list'],
      ['Projects', 'gallery'],
      ['Proof', 'stats'],
      ['Quote', 'cta-split'],
    ],
    photos: ['construction'],
    signature: 'a site-yellow band of years and projects',
  },
  {
    id: 'saas',
    trades: 'software, apps',
    palette: palette(
      'white slate-50 slate-950 slate-600',
      'blue-600 white blue-700',
      'slate-950 slate-50 slate-300',
    ),
    arabic: [face('Readex Pro', 500, 700), face('IBM Plex Sans Arabic', 400, 500)],
    latin: [face('Space Grotesk', 500, 700), face('IBM Plex Sans', 400, 500)],
    sections: [
      ['Hero', 'centered'],
      ['Features', 'bento'],
      ['Steps', 'steps'],
      ['Pricing', 'pricing'],
      ['FAQ', 'faq'],
    ],
    photos: ['tech'],
    signature: 'one headline word in the accent',
  },
  {
    id: 'business',
    trades: 'consulting, agency',
    palette: palette(
      'white stone-50 stone-900 stone-600',
      'cyan-800 white',
      'cyan-950 cyan-50 cyan-200',
    ),
    arabic: [face('Almarai', 800), face('Almarai', 400)],
    latin: [face('Outfit', 500, 700), face('Outfit', 400)],
    sections: [
      ['Hero', 'split'],
      ['Services', 'list'],
      ['Proof', 'stats'],
      ['Process', 'steps'],
      ['Contact', 'cta-split'],
    ],
    photos: ['business', 'city'],
    signature: 'a band of three proof numbers',
  },
  {
    id: 'education',
    trades: 'school, courses',
    palette: palette(
      'white sky-50 slate-900 slate-600',
      'sky-700 white sky-800',
      'cyan-950 cyan-50 sky-200',
    ),
    arabic: [face('Readex Pro', 500, 700), face('Almarai', 400, 700)],
    latin: [face('Sora', 600, 700), face('Nunito Sans', 400, 600)],
    sections: [
      ['Hero', 'split'],
      ['Courses', 'grid'],
      ['Outcomes', 'stats'],
      ['Teachers', 'team'],
      ['Enroll', 'contact'],
    ],
    photos: [],
    signature: 'the next start date as the lead card',
  },
  {
    id: 'charity',
    trades: 'NGO',
    palette: palette(
      'white emerald-50 stone-900 stone-600',
      'emerald-700 white emerald-800',
      'emerald-950 emerald-50 emerald-200',
    ),
    arabic: [face('Markazi Text', 600, 700), face('Noto Sans Arabic', 400)],
    latin: [face('DM Serif Display'), face('DM Sans', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Impact', 'stats'],
      ['Programs', 'list'],
      ['Story', 'quote'],
      ['Donate', 'band'],
    ],
    photos: ['charity'],
    signature: 'impact numbers at text-7xl',
  },
  {
    id: 'auto',
    trades: 'car dealer',
    palette: palette(
      'neutral-950 neutral-900 neutral-50 neutral-400',
      // red-600 as text read 3.71:1 on the neutral-900 card; on a dark ground the ink is lighter.
      'red-600 white red-400',
      'black neutral-50 neutral-400',
    ),
    arabic: [face('Changa', 600, 800), face('IBM Plex Sans Arabic', 400, 500)],
    latin: [face('Big Shoulders Display', 700, 800), face('Barlow', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Inventory', 'listing'],
      ['Financing', 'steps'],
      ['Test drive', 'contact'],
    ],
    photos: ['car'],
    signature: 'the car unframed on the dark ground',
  },
  {
    id: 'fashion',
    trades: 'abayas, boutique',
    palette: palette(
      'white neutral-100 neutral-950 neutral-600',
      'neutral-950 white rose-700',
      'neutral-950 neutral-50 neutral-400',
    ),
    arabic: [face('Alexandria', 700), face('Alexandria', 400)],
    latin: [face('Syne', 600, 800), face('Geist', 400, 500)],
    sections: [
      ['Hero', 'editorial'],
      ['New in', 'product'],
      ['Categories', 'bento'],
      ['Lookbook', 'gallery'],
      ['Order', 'contact'],
    ],
    photos: ['fashion'],
    signature: 'a tall portrait photo beside the headline',
  },
  {
    id: 'farm',
    trades: 'olive oil, organic',
    palette: palette(
      'lime-50 white stone-900 stone-600',
      'lime-800 white',
      'stone-900 lime-50 stone-300',
    ),
    arabic: [face('Amiri', 400, 700), face('Markazi Text', 400, 500)],
    latin: [face('Fraunces', 600, 700), face('Instrument Sans', 400, 500)],
    sections: [
      ['Hero', 'overlay'],
      ['Products', 'product'],
      ['Harvest', 'zigzag'],
      ['Process', 'steps'],
      ['Order', 'contact'],
    ],
    photos: ['farm'],
    signature: 'the grove photo bled under the hero',
  },
];

/**
 * The one css2 import for a pair, in the exact form the verification fetched:
 * families in order, one family imported once with every weight it is used
 * at, spaces as `+`, a one-weight face bare.
 */
export function directionDeckImportUrl(faces: readonly DeckFace[]): string {
  const weights = new Map<string, Set<number>>();
  for (const { family, weights: used } of faces) {
    const set = weights.get(family) ?? new Set<number>();
    for (const weight of used) set.add(weight);
    weights.set(family, set);
  }
  const families = [...weights].map(([family, used]) => {
    const name = family.replaceAll(' ', '+');
    const sorted = [...used].sort((left, right) => left - right);
    return sorted.length === 0 ? `family=${name}` : `family=${name}:wght@${sorted.join(';')}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

function renderFace({ family, weights }: DeckFace): string {
  return weights.length === 0 ? family : `${family} ${weights.join(';')}`;
}

function renderRow(row: DirectionDeckRow): string {
  const { palette: colours } = row;
  const accentInk =
    colours.accentInk === colours.accent ? '' : ` (accent-ink ${colours.accentInk})`;
  return [
    `${row.id}${row.trades === '' ? '' : ` (${row.trades})`}: ${colours.ground}/${colours.card}/${colours.ink}/${colours.muted}`,
    `${colours.accent}/${colours.onAccent}${accentInk}`,
    `${colours.band}/${colours.bandText}/${colours.bandMuted}`,
    `AR ${row.arabic.map(renderFace).join(' + ')}`,
    `EN ${row.latin.map(renderFace).join(' + ')}`,
    row.sections.map(([name, variant]) => `${name}[${variant}]`).join(' '),
    row.photos.length === 0 ? 'photos: the request’s' : `photos ${row.photos.join(', ')}`,
    row.signature,
  ].join(' | ');
}

export const DIRECTION_DECK_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.direction-deck',
  name: 'Industry direction deck',
  description:
    'Twenty-one trade rows — checked palettes by role, verified font pairs, a layout per section, photo subjects, one signature — for the skeleton pass.',
  version: '1.2.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 96,
  activation: { mode: 'explicit' },
  tags: ['build', 'design', 'direction', 'typography'],
  instructions: `BESPOKE: rows are optional inspiration; the brief and design contract decide geometry, palette, type and content order. No required row, variant, signature or section count. Preserve supplied content; never replace its layout with a row's recipe. LEGACY/HYBRID: a fitting row is an available starting point, adapted to the brief. A row: id (trades): ground/card/ink/muted | accent/on-accent (accent-ink for text) | band/text/muted | AR pair | EN pair | sections | photos | signature.
VARIANT: B is the legacy row swap: band becomes ground, its text becomes ink, band muted becomes secondary and accent text. Bespoke alternatives change composition and may choose another accessible palette.
FONTS: choose verified families covering the page's script; AR/EN pairs are suggestions. Use only shipped weights, spaces as +: @import url('https://fonts.googleapis.com/css2?family=Lalezar&family=Almarai:wght@400;700&display=swap'); a one-weight face imports bare; an absent weight fails the import (HTTP 400). No tashkeel in Changa, Lemonada or Reem Kufi headings; body in Markazi Text, Beiruti or Amiri goes one text-* step up.
DIRECTION: subject, audience, content-led geometry, palette, fonts and layout for each region. Legacy/hybrid may use "1 Hero[split] · 2 Menu[menu]"; bespoke layouts need no variant IDs. Different briefs deserve different spatial decisions, not repeated cards with new colours.
QUALITY: readable contrast, useful actions, purposeful imagery, responsive reading order and reduced-motion support; decoration should serve the brief.
${DIRECTION_DECK_ROWS.map(renderRow).join('\n')}`,
  references: {
    'checks/deck.md':
      'Bespoke design follows the brief, with optional row inspiration; legacy/hybrid may adapt a row and its variants; supplied content preserved; verified fonts and shipped weights; readable contrast and responsive reading order.',
  },
};
