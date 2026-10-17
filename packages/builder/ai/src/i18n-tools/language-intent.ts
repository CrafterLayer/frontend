import { foldWord, SITE_LANGUAGES, type SiteLanguage } from './languages';

/**
 * What a request asks of a page's language (2026-10-12), in English or Arabic:
 *
 * - `translate`: this page (or every page) in ONE other language, in place:
 *   "Translate the page to French", «ترجم الصفحة للإنجليزي», «خلي الموقع بالعربي».
 * - `versions`: the site in SEVERAL languages, one page per language linked as alternates:
 *   "Make the site in English and Arabic", "Add a French version", «أضف نسخة إنجليزية»,
 *   «بدي الموقع عربي وإنجليزي».
 *
 * A language word alone is not a request about language ("Add a section about Arabic coffee"):
 * it must be the page's medium (after in, into, to, «بال», «لل», «إلى», next to version or
 * language words, or in a list with one that is). A request naming one element ("translate the
 * hero") is left to the ordinary edit, which changes only that element.
 */

export type LanguageIntentAction = 'translate' | 'versions';

export interface LanguageIntent {
  readonly action: LanguageIntentAction;
  /** The languages asked for, in the request's order; a "from" language is left out. */
  readonly languages: readonly SiteLanguage[];
  readonly scope: 'page' | 'site';
}

const EN_BEFORE = new Set(['in', 'into', 'to', 'both']);
const EN_AFTER = new Set(['version', 'versions', 'language', 'translation', 'copy', 'edition']);
const AR_BEFORE = new Set([
  'الي',
  'لغه',
  'اللغه',
  'باللغه',
  'بلغه',
  'نسخه',
  'موقع',
  'الموقع',
  'صفحه',
  'الصفحه',
]);
const SOURCE = new Set(['from', 'من']);
const CONNECTORS = new Set(['and', 'or', 'و', 'او']);

const VERSION_WORDS =
  /^(?:versions?|bilingual|multilingual|multi|languages|نسخ|نسخه|نسختين|لغتين|بلغتين|لغات|اللغات|متعدد|متعدده|ثنائي|ثنائيه)$/u;
const TRANSLATE_WORDS = /^(?:translat\w*|ت?ترجم\S*)$/u;
const SITE_WORDS = /^(?:site|website|pages|موقع\S*|الموقع|الصفحات|صفحات)$/u;
const PAGE_WORDS = /^(?:page|الصفحه|صفحه|صفحتي|هالصفحه)$/u;
const ELEMENT_WORDS =
  /^(?:hero|header|footer|section|button|buttons|heading|headline|title|menu|nav|navigation|form|card|cards|paragraph|هيرو|الهيرو|قسم|القسم|زر|الزر|عنوان|العنوان|الفوتر|الهيدر|القائمه|النموذج|البطاقه|الفقره)$/u;

/** A token with its Arabic proclitics (و، ب، ل، ال، بال، لل) peeled, longest first. */
function stems(token: string): readonly string[] {
  const out = [token];
  const bare = token.replace(/^و(?=\S{3,})/u, '');
  if (bare !== token) out.push(bare);
  for (const prefix of ['بال', 'لل', 'ال', 'ب', 'ل']) {
    if (bare.startsWith(prefix) && bare.length - prefix.length >= 3)
      out.push(bare.slice(prefix.length));
  }
  return out;
}

function languageOf(token: string): SiteLanguage | undefined {
  for (const stem of stems(token)) {
    const found = SITE_LANGUAGES.find((language) => language.words.includes(stem));
    if (found !== undefined) return found;
  }
  return undefined;
}

/** A medium prefix on an Arabic language word: «بالعربي», «للإنجليزي», «بفرنسي» (not «برتغالي»). */
function arabicMedium(token: string): boolean {
  const bare = token.replace(/^و/u, '');
  if (/^(?:بال|لل)/u.test(bare)) return true;
  return (
    /^[بل]/u.test(bare) && SITE_LANGUAGES.some((language) => language.words.includes(bare.slice(1)))
  );
}

interface Mention {
  readonly language: SiteLanguage;
  readonly marked: boolean;
  readonly source: boolean;
}

function mentions(tokens: readonly string[]): readonly Mention[] {
  const out: Mention[] = [];
  let last: { at: number; marked: boolean } | undefined;
  for (const [at, token] of tokens.entries()) {
    const language = languageOf(token);
    if (language === undefined) continue;
    const before = tokens[at - 1] ?? '';
    const after = tokens[at + 1] ?? '';
    const between = last === undefined ? [] : tokens.slice(last.at + 1, at);
    const listed =
      last?.marked === true &&
      (between.every((word) => CONNECTORS.has(word)) || token.startsWith('و'));
    const source = SOURCE.has(before);
    const marked =
      source ||
      EN_BEFORE.has(before) ||
      EN_AFTER.has(after) ||
      AR_BEFORE.has(before) ||
      after === 'نسخه' ||
      arabicMedium(token) ||
      listed;
    out.push({ language, marked, source });
    last = { at, marked };
  }
  return out;
}

function unique(languages: readonly SiteLanguage[]): readonly SiteLanguage[] {
  return languages.filter((language, at) => languages.indexOf(language) === at);
}

/** The request's language intent, or undefined when it is not about the page's language. */
export function languageIntent(request: string): LanguageIntent | undefined {
  const tokens = foldWord(request)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== '');
  const found = mentions(tokens);
  if (found.length === 0) return undefined;
  const has = (pattern: RegExp) =>
    tokens.some((token) => stems(token).some((stem) => pattern.test(stem)));
  const versionWord = has(VERSION_WORDS);
  const translateWord = has(TRANSLATE_WORDS);
  const site = has(SITE_WORDS);
  const page = has(PAGE_WORDS);
  const scoped = site || page;
  const scope = site ? 'site' : 'page';
  // Versions are of the whole site unless only a page is named ("a French version of this page").
  const versionScope = page && !site ? 'page' : 'site';
  const targets = unique(found.filter((entry) => !entry.source).map((entry) => entry.language));
  const marked = unique(
    found.filter((entry) => entry.marked && !entry.source).map((entry) => entry.language),
  );
  if (versionWord && targets.length > 0)
    return { action: 'versions', languages: targets, scope: versionScope };
  if (marked.length >= 2) return { action: 'versions', languages: marked, scope: versionScope };
  // One element named and no page or site: the ordinary edit changes just that element.
  if (has(ELEMENT_WORDS) && !scoped) return undefined;
  if (translateWord && targets.length >= 2)
    return { action: 'versions', languages: targets, scope: versionScope };
  if (translateWord && targets.length === 1)
    return { action: 'translate', languages: targets, scope };
  if (marked.length === 1 && scoped) return { action: 'translate', languages: marked, scope };
  return undefined;
}
