import { STUDIO_TAG_LABELS } from './labels';
import type { Bilingual, ScriptKind, ScriptTier } from './types';

/**
 * Bilingual library search (pixi-studio DESIGN.md §A.1, §A.5).
 *
 * Arabic is searched the way people type it: without vowel marks, with any
 * alef, with ه for ة and ي for ى — so «مكتبه» finds «مكتبة» and «اضاءة» finds
 * «إضاءة».
 */

const TASHKEEL = /[ً-ٰٟۖ-ۭ]/gu;
const TATWEEL = /ـ/gu;
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/gu;

/**
 * Lower-cases Latin, strips Arabic tashkeel and tatweel, unifies أإآٱ→ا, ى→ي,
 * ة→ه, ؤ→و, ئ→ي, maps Arabic-Indic digits to 0–9, and collapses whitespace.
 */
export function normaliseSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(ARABIC_INDIC_DIGITS, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/[\s_-]+/gu, ' ')
    .trim();
}

/** What `searchScripts` needs of an entry: a script or a sound, from any tier. */
export interface SearchableScript {
  id: string;
  name: Bilingual | string;
  tags: readonly string[];
  description?: Bilingual | string | undefined;
  kind?: ScriptKind | undefined;
  tier?: ScriptTier | undefined;
}

export interface ScriptSearchOptions {
  /** Every listed tag must be on the entry. */
  tags?: readonly string[] | undefined;
  kind?: ScriptKind | undefined;
  tier?: ScriptTier | undefined;
}

function texts(value: Bilingual | string | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [value.en, value.ar];
}

const NAME_EXACT = 100;
const NAME_PREFIX = 60;
const NAME_CONTAINS = 40;
const TAG_MATCH = 20;
const DESCRIPTION_MATCH = 5;

/** The best score one query token earns on one entry, 0 when it is nowhere. */
function tokenScore(
  token: string,
  names: readonly string[],
  tags: readonly string[],
  descriptions: readonly string[],
): number {
  let best = 0;
  for (const name of names) {
    if (name === token) best = Math.max(best, NAME_EXACT);
    else if (name.split(' ').some((word) => word.startsWith(token))) best = Math.max(best, NAME_PREFIX);
    else if (name.includes(token)) best = Math.max(best, NAME_CONTAINS);
  }
  if (best > 0) return best;
  if (tags.some((tag) => tag.includes(token))) return TAG_MATCH;
  if (descriptions.some((text) => text.includes(token))) return DESCRIPTION_MATCH;
  return 0;
}

/**
 * Entries matching `query`, best first: name matches, then tags (key or either
 * label), then description. Every query word must match somewhere. Ties keep
 * the input order, so a caller's "recently updated first" survives.
 */
export function searchScripts<T extends SearchableScript>(
  entries: readonly T[],
  query: string,
  options: ScriptSearchOptions = {},
): T[] {
  const tokens = normaliseSearch(query)
    .split(' ')
    .filter((token) => token !== '');
  const wanted = options.tags ?? [];
  const scored: { entry: T; score: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    if (options.kind !== undefined && entry.kind !== options.kind) return;
    if (options.tier !== undefined && entry.tier !== options.tier) return;
    if (!wanted.every((tag) => entry.tags.includes(tag))) return;
    if (tokens.length === 0) {
      scored.push({ entry, score: 0, order });
      return;
    }
    const names = [entry.id.replace(/-/gu, ' '), ...texts(entry.name)].map(normaliseSearch);
    const tags = entry.tags.flatMap((tag) => {
      const label = Object.hasOwn(STUDIO_TAG_LABELS, tag) ? STUDIO_TAG_LABELS[tag] : undefined;
      return [tag, ...(label === undefined ? [] : [label.en, label.ar])].map(normaliseSearch);
    });
    const descriptions = texts(entry.description).map(normaliseSearch);
    let score = 0;
    for (const token of tokens) {
      const earned = tokenScore(token, names, tags, descriptions);
      if (earned === 0) return;
      score += earned;
    }
    scored.push({ entry, score, order });
  });
  return scored
    .sort((a, b) => (b.score === a.score ? a.order - b.order : b.score - a.score))
    .map((hit) => hit.entry);
}
