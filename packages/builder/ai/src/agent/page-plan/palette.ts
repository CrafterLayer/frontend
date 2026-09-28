/**
 * Tailwind palette shades a page plan may NAME instead of writing hex, and the
 * hex each one resolves to.
 *
 * ## Why names are accepted at all
 *
 * The direction deck (skills/direction-deck.ts) is written in palette names —
 * `lime-50 white emerald-950 emerald-800` — and a model planning from a deck
 * row copies them. Refusing them would spend a repair round (a whole model
 * call) to translate a name code can translate for free.
 *
 * ## Why these values
 *
 * Tailwind v3 hex, copied from the table page-power.test.ts computes the deck's
 * contrast on. The plan stores the HEX and the skeleton writes it into `--ck-*`
 * properties, so the page renders exactly the colour whose contrast was
 * measured — v4's OKLCH palette classes are never the colour of record.
 *
 * ## Which names (counted 2026-09-28)
 *
 * 75 entries: all 73 shades the 21 DIRECTION_DECK_ROWS name across their ten
 * palette roles, plus stone-100 and stone-200, which no row names but the
 * page-power table holds — they are the ai-server's fallback surface and
 * border (plan-shape.ts PAGE_PLAN_FALLBACK_BASE, written there as hex), and a
 * model that names them instead costs nothing. palette.test.ts pins both
 * halves: every deck shade resolves, and every entry is the table's value.
 *
 * yellow-800 and red-400 arrived last: the deck re-inked wedding and auto's
 * accentInk to them at 07:58 and this table (07:44) named 71 of the 73, so
 * validatePagePlan refused those two rows' own names and each such page cost
 * a repair round (~80 s live) until the server wrote them as hex instead.
 *
 * A shade missing here is refused with the hex form offered instead; add one
 * only with its v3 value.
 */
export const PAGE_PLAN_PALETTE_HEX: Readonly<Record<string, string>> = Object.freeze({
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
});
