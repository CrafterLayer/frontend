/*
  The catalog of `s.lib.stickers` (sticker art, 2026-11-05): 496 of Microsoft's Fluent Emoji Flat
  (MIT) picked for children's stories and drawings, bundled whole as SVG bodies so nothing is
  fetched at run time. Every sticker answers to its English name ('teddy-bear', 'teddy bear') and to
  its Arabic and English aliases; a word two stickers could claim was given to one of them when the
  data was built, so `find` is never a coin toss. Pure and synchronous.
*/

import { FLUENT_EMOJI_FLAT_VERSION, STICKER_GRID, STICKER_ROWS } from './stickers.generated';

export interface StickerInfo {
  readonly name: string;
  readonly group: string;
  /** The aliases it answers to besides its name, Arabic first. */
  readonly words: readonly string[];
  readonly viewBox: string;
}

interface Entry extends StickerInfo {
  readonly body: string;
  /** The folded name and words: what a query is compared with. */
  readonly keys: readonly string[];
}

/** Lower case, no tashkeel or tatweel, one alef, ة → ه, ى → ي, Arabic digits → ASCII, one space
 *  between words, and a leading ال dropped from each word (the build script folds the same way). */
export function foldWord(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯؐ-ًؚ-ٰٟـ]/gu, '')
    .toLowerCase()
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/ى/gu, 'ي')
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .map((word) => (word.length > 3 && word.startsWith('ال') ? word.slice(2) : word))
    .join(' ');
}

const ENTRIES = new Map<string, Entry>();
const INDEX = new Map<string, string>();
for (const [name, group, words, height, body] of STICKER_ROWS) {
  const aliases = words === '' ? [] : words.split('|');
  ENTRIES.set(name, {
    name,
    group,
    words: Object.freeze(aliases),
    viewBox: `0 0 ${String(STICKER_GRID)} ${String(height)}`,
    body,
    keys: Object.freeze([name, ...aliases].map(foldWord)),
  });
}
// Names first, so an alias never shadows another sticker's own name; then the aliases in order.
for (const entry of ENTRIES.values()) INDEX.set(foldWord(entry.name), entry.name);
for (const entry of ENTRIES.values()) {
  for (const key of entry.keys) if (!INDEX.has(key)) INDEX.set(key, entry.name);
}

export const STICKER_NAMES: readonly string[] = Object.freeze([...ENTRIES.keys()]);

export const STICKER_GROUPS: Readonly<Record<string, readonly string[]>> = (() => {
  const groups: Record<string, string[]> = {};
  for (const entry of ENTRIES.values()) (groups[entry.group] ??= []).push(entry.name);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(groups).map(([group, names]) => [group, Object.freeze(names)]),
    ),
  );
})();

/* The words a script uses for a whole group (search('حيوانات') lists the animals). */
const GROUP_WORDS: Readonly<Record<string, string>> = Object.freeze({
  animals: 'animals animal حيوانات حيوان',
  nature: 'nature plants flowers طبيعة نباتات زهور',
  sky: 'sky weather space سماء طقس فضاء',
  food: 'food fruit fruits vegetables أكل طعام فواكه فاكهة خضار خضراوات',
  vehicles: 'vehicles transport مواصلات مركبات سيارات',
  home: 'home house things أغراض البيت أدوات',
  clothes: 'clothes clothing ملابس تياب',
  toys: 'toys toy party ألعاب لعب حفلة',
  school: 'school study مدرسة دراسة',
  music: 'music instruments موسيقى آلات',
  sports: 'sports sport رياضة',
  fantasy: 'fantasy magic fairy tale خيال سحر حكايات',
  faces: 'faces feelings emotions وجوه مشاعر',
  gestures: 'gestures hands body إشارات أيدي جسم',
  people: 'people jobs ناس أشخاص مهن',
  arab: 'arab arabic muslim عربي إسلامي تراث',
  symbols: 'symbols numbers shapes رموز أرقام أشكال',
});
const GROUP_INDEX = new Map<string, string>();
for (const [group, words] of Object.entries(GROUP_WORDS)) {
  for (const word of words.split(' ')) GROUP_INDEX.set(foldWord(word), group);
}

export const STICKERS_CREDIT = Object.freeze({
  art: 'Fluent Emoji (Flat) by Microsoft Corporation, MIT',
  source: 'https://github.com/microsoft/fluentui-emoji',
  data: `@iconify-json/fluent-emoji-flat ${FLUENT_EMOJI_FLAT_VERSION} (Iconify JSON)`,
});

export const STICKER_LIMITS = Object.freeze({
  minSize: 16,
  maxSize: 1024,
  defaultSize: 128,
  maxResults: 100,
});

export function sizeOf(value: unknown): number {
  const size = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN;
  if (Number.isNaN(size)) return STICKER_LIMITS.defaultSize;
  return Math.min(STICKER_LIMITS.maxSize, Math.max(STICKER_LIMITS.minSize, size));
}

/* How well one folded key answers a folded query; 0 when it does not. */
function keyScore(key: string, query: string): number {
  if (key === query) return 100;
  if (query.length >= 2 && key.startsWith(`${query} `)) return 70;
  const tokens = key.split(' ');
  if (tokens.includes(query)) return 60;
  if (query.length >= 2 && key.startsWith(query)) return 40;
  if (query.length >= 3 && tokens.some((token) => token.startsWith(query))) return 30;
  if (query.length >= 4 && key.includes(query)) return 10;
  return 0;
}

function scored(query: string): [string, number][] {
  const scores = new Map<string, number>();
  const group = GROUP_INDEX.get(query);
  if (group !== undefined) for (const name of STICKER_GROUPS[group] ?? []) scores.set(name, 20);
  for (const entry of ENTRIES.values()) {
    let best = 0;
    for (const [rank, key] of entry.keys.entries()) {
      // The name and the first words outrank later aliases a little.
      const score = keyScore(key, query);
      if (score > 0) best = Math.max(best, score - Math.min(rank, 5));
    }
    if (best > 0) scores.set(entry.name, Math.max(best, scores.get(entry.name) ?? 0));
  }
  // A Map keeps insertion order, and a stable sort keeps the catalog order among equals.
  return [...scores].sort((a, b) => b[1] - a[1]);
}

/* English plurals a child or a script may type: 'cats', 'foxes', 'butterflies'. */
function singulars(query: string): string[] {
  if (!/^[a-z0-9 ]+$/u.test(query) || query.length < 4) return [];
  const forms: string[] = [];
  if (query.endsWith('ies')) forms.push(`${query.slice(0, -3)}y`);
  if (query.endsWith('es')) forms.push(query.slice(0, -2));
  if (query.endsWith('s')) forms.push(query.slice(0, -1));
  return forms;
}

/** The best sticker for a word (English or Arabic, any case or diacritics), or undefined. */
export function findSticker(word: unknown): string | undefined {
  if (typeof word !== 'string') return undefined;
  const query = foldWord(word);
  if (query === '') return undefined;
  const exact = INDEX.get(query);
  if (exact !== undefined) return exact;
  for (const form of singulars(query)) {
    const plural = INDEX.get(form);
    if (plural !== undefined) return plural;
  }
  // A whole word or the start of a phrase: 'red' alone is too loose to pick a sticker.
  const [best] = scored(query);
  return best !== undefined && best[1] >= 30 ? best[0] : undefined;
}

/** Stickers that answer a word, best first (at most `limit`, default 12, 100 at most). */
export function searchStickers(word: unknown, limit?: unknown): readonly string[] {
  if (typeof word !== 'string') return Object.freeze([]);
  const query = foldWord(word);
  if (query === '') return Object.freeze([]);
  const count =
    typeof limit === 'number' && Number.isFinite(limit)
      ? Math.min(STICKER_LIMITS.maxResults, Math.max(1, Math.floor(limit)))
      : 12;
  const names: string[] = [];
  const exact =
    INDEX.get(query) ??
    singulars(query)
      .map((form) => INDEX.get(form))
      .find(Boolean);
  if (exact !== undefined) names.push(exact);
  for (const [name] of scored(query)) {
    if (names.length >= count) break;
    if (!names.includes(name)) names.push(name);
  }
  return Object.freeze(names.slice(0, count));
}

/** A sticker by its exact name, or the best match for a word (so svg('قطة') draws the cat). */
export function stickerEntry(nameOrWord: unknown): Entry | undefined {
  if (typeof nameOrWord !== 'string') return undefined;
  const direct = ENTRIES.get(nameOrWord);
  if (direct !== undefined) return direct;
  const found = findSticker(nameOrWord);
  return found === undefined ? undefined : ENTRIES.get(found);
}

export function stickerInfo(nameOrWord: unknown): StickerInfo | undefined {
  const entry = stickerEntry(nameOrWord);
  if (entry === undefined) return undefined;
  const { name, group, words, viewBox } = entry;
  return Object.freeze({ name, group, words, viewBox });
}
