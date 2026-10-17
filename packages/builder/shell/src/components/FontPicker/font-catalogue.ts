/*
  ── The curated web-font list (LIBRARIES.md §D) ─────────────────────────────

  Data, not code: family names and the weights each family actually ships.
  The weights matter — a css2 request naming a weight a family lacks answers
  HTTP 400 and the font silently never loads — so these rows repeat the
  measured table in `ai/src/skills/verified-fonts.ts` (fetched from both
  allowed hosts on 2026-09-28; the shell cannot import the ai package).
  Every family is SIL OFL 1.1, which allows embedding and web use; nothing is
  bundled, the published page loads it from Google or Bunny.
*/

export type FontCategory = 'sans' | 'serif' | 'display' | 'mono';

export interface CatalogueFont {
  readonly family: string;
  readonly weights: readonly number[];
  /** Carries Arabic glyphs (every Arabic face here also carries Latin). */
  readonly arabic: boolean;
  readonly category: FontCategory;
}

const ALL = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export const CURATED_FONTS: readonly CatalogueFont[] = [
  // Arabic-capable (LIBRARIES.md §D + the verified table).
  { family: 'Cairo', arabic: true, category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800, 900, 1000] },
  { family: 'Tajawal', arabic: true, category: 'sans', weights: [200, 300, 400, 500, 700, 800, 900] },
  { family: 'IBM Plex Sans Arabic', arabic: true, category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700] },
  { family: 'Noto Kufi Arabic', arabic: true, category: 'sans', weights: ALL },
  { family: 'Noto Sans Arabic', arabic: true, category: 'sans', weights: ALL },
  { family: 'Noto Naskh Arabic', arabic: true, category: 'serif', weights: [400, 500, 600, 700] },
  { family: 'Almarai', arabic: true, category: 'sans', weights: [300, 400, 700, 800] },
  { family: 'Readex Pro', arabic: true, category: 'sans', weights: [200, 300, 400, 500, 600, 700] },
  { family: 'Rubik', arabic: true, category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Alexandria', arabic: true, category: 'sans', weights: ALL },
  { family: 'Vazirmatn', arabic: true, category: 'sans', weights: ALL },
  { family: 'Beiruti', arabic: true, category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Fustat', arabic: true, category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Amiri', arabic: true, category: 'serif', weights: [400, 700] },
  { family: 'Markazi Text', arabic: true, category: 'serif', weights: [400, 500, 600, 700] },
  { family: 'Aref Ruqaa', arabic: true, category: 'display', weights: [400, 700] },
  { family: 'El Messiri', arabic: true, category: 'display', weights: [400, 500, 600, 700] },
  { family: 'Changa', arabic: true, category: 'display', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Reem Kufi', arabic: true, category: 'display', weights: [400, 500, 600, 700] },
  { family: 'Lemonada', arabic: true, category: 'display', weights: [300, 400, 500, 600, 700] },
  { family: 'Lalezar', arabic: true, category: 'display', weights: [400] },
  { family: 'Baloo Bhaijaan 2', arabic: true, category: 'display', weights: [400, 500, 600, 700, 800] },
  // Latin.
  { family: 'Inter', arabic: false, category: 'sans', weights: ALL },
  { family: 'Geist', arabic: false, category: 'sans', weights: ALL },
  { family: 'DM Sans', arabic: false, category: 'sans', weights: ALL },
  { family: 'Manrope', arabic: false, category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Figtree', arabic: false, category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Outfit', arabic: false, category: 'sans', weights: ALL },
  { family: 'Sora', arabic: false, category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: 'Space Grotesk', arabic: false, category: 'sans', weights: [300, 400, 500, 600, 700] },
  { family: 'Instrument Sans', arabic: false, category: 'sans', weights: [400, 500, 600, 700] },
  { family: 'IBM Plex Sans', arabic: false, category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700] },
  { family: 'Nunito Sans', arabic: false, category: 'sans', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Barlow', arabic: false, category: 'sans', weights: ALL },
  { family: 'Archivo', arabic: false, category: 'sans', weights: ALL },
  { family: 'Bricolage Grotesque', arabic: false, category: 'display', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Syne', arabic: false, category: 'display', weights: [400, 500, 600, 700, 800] },
  { family: 'Archivo Black', arabic: false, category: 'display', weights: [400] },
  { family: 'Big Shoulders Display', arabic: false, category: 'display', weights: ALL },
  { family: 'Fraunces', arabic: false, category: 'serif', weights: ALL },
  { family: 'Cormorant Garamond', arabic: false, category: 'serif', weights: [300, 400, 500, 600, 700] },
  { family: 'DM Serif Display', arabic: false, category: 'serif', weights: [400] },
  { family: 'Young Serif', arabic: false, category: 'serif', weights: [400] },
  { family: 'Gloock', arabic: false, category: 'serif', weights: [400] },
  { family: 'IBM Plex Mono', arabic: false, category: 'mono', weights: [100, 200, 300, 400, 500, 600, 700] },
  { family: 'JetBrains Mono', arabic: false, category: 'mono', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
];

export interface FontFilter {
  readonly query?: string | undefined;
  readonly arabicOnly?: boolean | undefined;
  readonly category?: FontCategory | 'all' | undefined;
}

/** The catalogue narrowed by a search, the Arabic filter and a category. */
export function filterFonts(
  fonts: readonly CatalogueFont[],
  filter: FontFilter,
): readonly CatalogueFont[] {
  const needle = (filter.query ?? '').trim().toLowerCase();
  return fonts.filter(
    (font) =>
      (needle === '' || font.family.toLowerCase().includes(needle)) &&
      (filter.arabicOnly !== true || font.arabic) &&
      (filter.category === undefined || filter.category === 'all' || font.category === filter.category),
  );
}

/** The weights a body + heading role needs, among those the family ships. */
export function weightsToLoad(font: Pick<CatalogueFont, 'weights'>): number[] {
  const wanted = [400, 500, 600, 700];
  const picked = font.weights.filter((weight) => wanted.includes(weight));
  return picked.length > 0 ? picked : [font.weights[0] ?? 400];
}

/** The Google css2 URL that loads a family for the picker's preview (regular weight only). */
export function previewStylesheetUrl(font: Pick<CatalogueFont, 'family' | 'weights'>): string {
  const weight = font.weights.includes(400) ? 400 : (font.weights[0] ?? 400);
  return `https://fonts.googleapis.com/css2?family=${font.family.trim().replace(/\s+/gu, '+')}:wght@${String(weight)}&display=swap`;
}

export type FontRole = 'sans' | 'serif' | 'mono';

const GENERIC: Readonly<Record<FontRole, string>> = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
};

/** The token value for a role: the family first, then a generic fallback stack. */
export function fontStack(family: string, role: FontRole): string {
  return `"${family}", ${GENERIC[role]}`;
}

/** The family a token value names first ('"Cairo", system-ui' → 'Cairo'). */
export function firstFamily(stack: string): string {
  const first = stack.split(',')[0] ?? '';
  return first.trim().replace(/^["']|["']$/gu, '');
}
