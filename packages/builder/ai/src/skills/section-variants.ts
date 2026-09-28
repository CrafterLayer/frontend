import type { AiSkillDefinitionV1 } from './types';

/**
 * A closed library of named section layouts.
 *
 * ## Why named variants, and why closed
 *
 * Measured 2026-09-28: without names every section writer reached for the
 * same answer — a centred hero, then three identical cards — because "a
 * features section" has one most-likely shape and a model writes the
 * most-likely shape. The direction (decided once, in the skeleton pass) now
 * names a variant per section, `2 Menu[menu] · 3 Story[zigzag]`, and the
 * writer builds that one. A closed list is what makes the name mean
 * something: an id the writer has to interpret is a suggestion again.
 *
 * Patterns transcribed from HyperUI and Tailark (both MIT; ~92% of HyperUI's
 * class uses already fit this vocabulary) and restated in this product's own
 * terms: every class below is checked against the utility vocabulary by
 * page-power.test.ts — slashed ones too, which the builtins guard skips — and
 * every colour is a slot the direction fills, never a hue of the recipe's own.
 */

export type SectionVariantRole = 'hero' | 'features' | 'proof' | 'offer' | 'media' | 'closing';

export interface SectionVariant {
  readonly id: string;
  readonly role: SectionVariantRole;
  /** The markup skeleton: `>` nests, `+` follows, `(…)` groups a column's children. */
  readonly recipe: string;
}

/**
 * Parts several recipes share, named once so the skill does not pay for the
 * same thirty classes five times. A recipe writes the part's NAME in capitals.
 */
export const SECTION_VARIANT_PARTS: Readonly<Record<string, string>> = {
  H1: 'h1 text-4xl md:text-6xl font-bold leading-snug text-balance',
  LEAD: 'p mt-6 max-w-2xl text-lg md:text-xl leading-relaxed text-pretty text-{muted}',
  ACTIONS: 'div mt-8 flex flex-wrap gap-3',
  CARD: 'rounded-3xl bg-{card} p-6 ring-1 ring-black/5',
  BACKDROP: 'img absolute inset-0 -z-10 h-full w-full object-cover',
  MONOGRAM:
    'span flex size-12 shrink-0 items-center justify-center rounded-full bg-{accent} font-bold text-{on-accent} holding the initials',
};

export const SECTION_VARIANTS: readonly SectionVariant[] = [
  // ── Hero ────────────────────────────────────────────────────────────────
  {
    id: 'split',
    role: 'hero',
    recipe:
      'section relative overflow-hidden py-16 md:py-24 > div mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-12 md:px-8 > div md:col-span-6 (H1 + LEAD + ACTIONS) + figure md:col-span-6 > img aspect-4/3 w-full rounded-3xl object-cover shadow-2xl',
  },
  {
    id: 'centered',
    role: 'hero',
    recipe:
      'section py-24 md:py-40 > div mx-auto max-w-4xl px-4 text-center > h1 text-5xl md:text-8xl font-black leading-tight text-balance + LEAD mx-auto + ACTIONS justify-center; no photo, the headline is the image',
  },
  {
    id: 'overlay',
    role: 'hero',
    recipe:
      'section relative isolate flex min-h-dvh items-end overflow-hidden > BACKDROP + div absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent + div mx-auto w-full max-w-6xl px-4 pb-16 text-white md:px-8 md:pb-24 > H1 max-w-3xl md:text-7xl + p mt-6 max-w-2xl text-lg text-white/90 + ACTIONS',
  },
  {
    id: 'frame',
    role: 'hero',
    recipe:
      'section py-16 md:py-24 > div mx-auto max-w-3xl px-4 text-center (H1 + LEAD + ACTIONS justify-center) + div mx-auto mt-12 max-w-6xl px-4 md:px-8 > div overflow-hidden rounded-3xl ring-1 ring-black/10 shadow-2xl > img aspect-video md:aspect-21/9 w-full object-cover',
  },
  {
    id: 'editorial',
    role: 'hero',
    recipe:
      'section py-16 md:py-24 > div mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-12 md:px-8 > H1 md:col-span-7 md:text-7xl + div self-end md:col-span-5 (LEAD mt-0 + ACTIONS) + img md:col-span-12 aspect-video md:aspect-21/9 w-full rounded-3xl object-cover, or a portrait img aspect-3/4 in md:col-span-5',
  },
  // ── Features ────────────────────────────────────────────────────────────
  {
    id: 'grid',
    role: 'features',
    recipe:
      'div grid gap-4 md:grid-cols-3 > the lead article rounded-3xl bg-{band} p-8 text-{band-text} md:col-span-2 md:row-span-2 md:p-12 (h3 text-2xl md:text-4xl font-bold text-balance + p mt-4 text-lg) + two to four article CARD (icon size 28 text-{accent-ink} + h3 mt-4 text-lg font-semibold + p mt-2 text-{muted})',
  },
  {
    id: 'list',
    role: 'features',
    recipe:
      'dl grid gap-x-12 gap-y-10 md:grid-cols-2 > div border-t border-black/10 pt-6 > dt flex items-center gap-3 text-lg font-semibold with icon size 22 text-{accent-ink} + dd mt-2 leading-relaxed text-{muted}',
  },
  {
    id: 'bento',
    role: 'features',
    recipe:
      'div grid gap-4 md:grid-cols-3 md:grid-rows-2 > div relative isolate min-h-80 overflow-hidden rounded-3xl md:col-span-2 md:row-span-2 (BACKDROP + div absolute inset-0 -z-10 bg-gradient-to-t from-black/70 to-transparent + h3 absolute bottom-0 start-0 p-8 text-2xl font-bold text-white) + two div CARD',
  },
  {
    id: 'sticky',
    role: 'features',
    recipe:
      'div grid gap-12 md:grid-cols-12 > div self-start md:col-span-5 md:sticky md:top-24 (h2 + p mt-4 text-{muted}) + ul md:col-span-7 divide-y divide-black/10 > li py-6 (h3 text-lg font-semibold + p mt-2 text-{muted})',
  },
  {
    id: 'zigzag',
    role: 'features',
    recipe:
      'div flex flex-col gap-16 md:gap-24 > div grid items-center gap-8 md:grid-cols-2 md:gap-16 > img aspect-4/3 w-full rounded-3xl object-cover + div (h3 text-2xl md:text-3xl font-semibold text-balance + p mt-4 leading-relaxed text-{muted}); every second row adds md:order-last to its img, so the photo stays first on phones',
  },
  {
    id: 'steps',
    role: 'features',
    recipe:
      'ol grid gap-8 md:grid-cols-3 > li border-s-2 border-{accent} ps-6 > span text-sm font-semibold tabular-nums text-{accent-ink} + h3 mt-2 text-lg font-semibold + p mt-2 text-{muted}; one column for a timeline',
  },
  // ── Proof ───────────────────────────────────────────────────────────────
  {
    id: 'cards',
    role: 'proof',
    recipe:
      'div grid gap-6 md:grid-cols-3 > figure flex flex-col CARD p-8 > blockquote text-lg leading-relaxed text-pretty + figcaption mt-auto flex items-center gap-3 pt-6 (MONOGRAM + div > p font-semibold + p text-sm text-{muted})',
  },
  {
    id: 'quote',
    role: 'proof',
    recipe:
      'figure mx-auto max-w-3xl text-center > icon quote size 40 mx-auto text-{accent-ink} + blockquote mt-6 text-2xl md:text-4xl font-medium leading-snug text-balance + figcaption mt-8 flex items-center justify-center gap-3 (MONOGRAM + name and role)',
  },
  {
    id: 'stats',
    role: 'proof',
    recipe:
      'dl grid grid-cols-2 gap-8 md:grid-cols-4 > div border-t border-black/10 pt-6 > dd text-4xl md:text-5xl font-bold tabular-nums text-{accent-ink} + dt mt-2 text-sm text-{muted}',
  },
  // ── Offer ───────────────────────────────────────────────────────────────
  {
    id: 'pricing',
    role: 'offer',
    recipe:
      'div grid items-stretch gap-6 md:grid-cols-3 > div flex flex-col CARD p-8 (h3 + p text-sm text-{muted} + p mt-6 text-5xl font-bold tabular-nums + ul mt-8 mb-8 space-y-3 > li flex gap-2 with icon check size 20 shrink-0 text-{accent-ink} + the action mt-auto); the one recommended tier: bg-{band} text-{band-text} shadow-2xl md:-mt-4',
  },
  {
    id: 'menu',
    role: 'offer',
    recipe:
      'div grid gap-x-16 gap-y-12 md:grid-cols-2, a category per column > h3 text-xl font-semibold + ul mt-6 space-y-5 > li > div flex items-baseline gap-3 (span font-semibold + span flex-1 border-b border-dotted border-black/20 + span whitespace-nowrap font-semibold tabular-nums) + p mt-1 text-sm text-{muted}',
  },
  {
    id: 'product',
    role: 'offer',
    recipe:
      'div grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 > article group > div relative overflow-hidden rounded-2xl bg-{card} (img aspect-square w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none + at most one span absolute top-3 start-3 rounded-full bg-{accent} px-2.5 py-1 text-xs font-semibold text-{on-accent}) + h3 mt-3 font-semibold + p tabular-nums text-{muted}',
  },
  {
    id: 'listing',
    role: 'offer',
    recipe:
      'div grid gap-6 md:grid-cols-3 > article overflow-hidden CARD p-0 > img aspect-4/3 w-full object-cover + div p-6 (p text-2xl font-bold tabular-nums + h3 mt-1 font-semibold + ul mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-{muted} > li flex items-center gap-1.5 with icons bed-double / bath / ruler / square-parking size 16)',
  },
  {
    id: 'team',
    role: 'offer',
    recipe:
      'div grid grid-cols-2 gap-8 md:grid-cols-4 > figure > img aspect-square w-full rounded-2xl object-cover object-top only for a photo the request gives, else div flex aspect-square items-center justify-center rounded-2xl bg-{card} text-4xl font-bold with the initials + figcaption mt-4 (p font-semibold + p text-sm text-{muted})',
  },
  // ── Media ───────────────────────────────────────────────────────────────
  {
    id: 'gallery',
    role: 'media',
    recipe:
      'div grid grid-cols-2 gap-4 md:grid-cols-4 > img aspect-square w-full rounded-2xl object-cover, the first col-span-2 row-span-2; six at most, none repeated',
  },
  {
    id: 'rail',
    role: 'media',
    recipe:
      'div flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 > figure w-4/5 shrink-0 snap-start md:w-96 > img aspect-4/3 w-full rounded-2xl object-cover + figcaption mt-3 font-semibold',
  },
  // ── Closing ─────────────────────────────────────────────────────────────
  {
    id: 'faq',
    role: 'closing',
    recipe:
      'div mx-auto max-w-3xl divide-y divide-black/10 > div py-6 > h3 text-lg font-semibold + p mt-2 leading-relaxed text-{muted}; four to six real objections',
  },
  {
    id: 'contact',
    role: 'closing',
    recipe:
      "div grid gap-10 md:grid-cols-2 > div (h2 + p mt-4 text-{muted} + ACTIONS: a href='https://wa.me/<digits only>?text=<encoded greeting>' inline-flex items-center gap-2 rounded-full bg-{accent} px-6 py-3 font-semibold text-{on-accent} with icon message-circle size 20 and «واتساب» / WhatsApp + a href='tel:+…' the same shape in ring-1 ring-black/10 with icon phone size 20) + div CARD p-8 (the hours as ul space-y-3 of li flex justify-between gap-4 tabular-nums + a href='https://maps.google.com/?q=<encoded address>' mt-6 inline-flex items-center gap-2 font-semibold underline with icon map-pin size 20)",
  },
  {
    id: 'band',
    role: 'closing',
    recipe:
      'div relative isolate overflow-hidden rounded-3xl bg-{band} px-6 py-16 text-center text-{band-text} md:px-16 md:py-24 > h2 mx-auto max-w-3xl text-3xl md:text-5xl font-bold text-balance + p mx-auto mt-4 max-w-xl + ACTIONS justify-center; on a photo, BACKDROP + div absolute inset-0 -z-10 bg-black/60 and text-white',
  },
  {
    id: 'cta-split',
    role: 'closing',
    recipe:
      'div grid items-center gap-8 border-t border-black/10 pt-12 md:grid-cols-12 > h2 md:col-span-8 text-3xl md:text-4xl font-semibold text-balance + div flex md:col-span-4 md:justify-end > the primary action',
  },
  {
    id: 'footer',
    role: 'closing',
    recipe:
      "footer border-t border-black/10 > div mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4 md:px-8 > div md:col-span-2 (span text-lg font-bold + p mt-3 max-w-sm text-sm text-{muted}) + nav aria-label='…' > ul space-y-2 text-sm of a href='#section-id' + ul of WhatsApp, tel: and the address; then small, the copyright, in div border-t border-black/10 py-6 text-xs",
  },
];

const ROLE_ORDER: readonly SectionVariantRole[] = [
  'hero',
  'features',
  'proof',
  'offer',
  'media',
  'closing',
];

function renderVariants(): string {
  return ROLE_ORDER.map((role) => {
    const lines = SECTION_VARIANTS.filter((variant) => variant.role === role).map(
      ({ id, recipe }) => `${id}: ${recipe}`,
    );
    return [role.toUpperCase(), ...lines].join('\n');
  }).join('\n');
}

export const SECTION_VARIANTS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.section-variants',
  name: 'Named section layouts',
  description:
    'Named section layouts with exact class recipes; the writer builds the one the direction names.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 92,
  activation: { mode: 'explicit' },
  tags: ['build', 'composition', 'layout', 'sections'],
  instructions: `Build the variant the direction names for this section. With none named, pick the one the content fits — not the first by habit, not the previous section's.
A recipe is the skeleton: keep its classes and write real content into it, inside the manual's region shell unless it opens with section or footer. A NAME in capitals is a part: ${Object.entries(
    SECTION_VARIANT_PARTS,
  )
    .map(([name, part]) => `${name} = ${part}`)
    .join(
      '; ',
    )}. Classes after a part add to it, replacing one of the same property (H1 md:text-7xl drops md:text-6xl).
SLOTS are the direction's palette as named classes: {ground} {card} {ink} {muted} {band} {band-text}, and {accent} {on-accent} as the manual says. {accent-ink} is accent text and icons (4.5:1 on ground and card; the fill when none is named); on {band}, {band-muted}. On a dark ground write white/10 where a recipe says black/10 or black/5.
HIERARCHY: one lead item outweighs the rest; never three identical cards as the second section.
${renderVariants()}`,
  references: {
    'checks/variants.md':
      'Named variant built; recipe classes kept; colours from slots; one lead item; initials, never a stranger’s photo; WhatsApp, tel: and maps linked.',
  },
};
