/*
  A site plan read from the words (T230, 2026-10-12): the pages a request names or counts,
  with no model. It is the whole plan when the provider cannot plan a site, and the
  fallback when it tries and fails, so a multi-page request always gets its pages.

  What it reads, in English and Arabic:
  - the page names after a colon or a word that introduces them ("pages: home, about",
    "with about, services and contact pages", «من 4 صفحات: الرئيسية، من نحن»), split on
    commas («،» too), "and" and «و»;
  - else the page names it finds anywhere (the router's own lexicon: home, about, من نحن…);
  - a stated count ("4-page", "five pages", «من 4 صفحات», «ثلاث صفحات», «صفحتين»), filled
    with the owner's four (Home, About, Services, Contact) and then a few more when the
    names are fewer than the count. "Several pages" is a site of four.

  A list counts only when it reads as page names: at least half of it names a page the
  lexicon knows, so "a 4-page website: modern, clean and fast" is four default pages, not
  three pages called Modern, Clean and Fast. The home page is always first. One page, or
  none named and none counted, is not a site: `null`.
*/
import { foldWord, SITE_LANGUAGES } from '../../i18n-tools/languages';
import { PAGE_NAME_PAIRS_AR, PAGE_NAMES_AR, PAGE_NAMES_EN } from '../../intent/intent-lexicon';
import { normalizeIntentText } from '../../intent/normalize-arabic';
import { detectPromptLanguage } from '../../prompt-enhance/language';

import {
  AI_SITE_MAX_PAGES,
  AI_SITE_MAX_TITLE_LENGTH,
  AI_SITE_MIN_PAGES,
  type AiSitePage,
  type AiSitePlan,
} from './types';

type Lang = AiSitePlan['locale'];

/** Each page kind the lexicons name, titled in both languages. */
const TITLES: Readonly<Record<string, Readonly<Record<Lang, string>>>> = {
  home: { en: 'Home', ar: 'الرئيسية' },
  about: { en: 'About', ar: 'من نحن' },
  services: { en: 'Services', ar: 'الخدمات' },
  contact: { en: 'Contact', ar: 'تواصل معنا' },
  portfolio: { en: 'Portfolio', ar: 'أعمالنا' },
  blog: { en: 'Blog', ar: 'المدونة' },
  faq: { en: 'FAQ', ar: 'الأسئلة الشائعة' },
  pricing: { en: 'Pricing', ar: 'الأسعار' },
  team: { en: 'Team', ar: 'الفريق' },
  gallery: { en: 'Gallery', ar: 'المعرض' },
  careers: { en: 'Careers', ar: 'الوظائف' },
  shop: { en: 'Shop', ar: 'المتجر' },
  menu: { en: 'Menu', ar: 'قائمة الطعام' },
  testimonials: { en: 'Testimonials', ar: 'آراء العملاء' },
  news: { en: 'News', ar: 'الأخبار' },
  events: { en: 'Events', ar: 'الفعاليات' },
  booking: { en: 'Booking', ar: 'الحجز' },
};

/** A counted site with fewer names than its count is filled in this order. */
const DEFAULT_KINDS = [
  'home',
  'about',
  'services',
  'contact',
  'portfolio',
  'blog',
  'faq',
  'pricing',
];

/* ── How many pages ──────────────────────────────────────────────────────── */

const EN_NUMBERS: Readonly<Record<string, number>> = {
  one: 1,
  single: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
/** Folded spellings (`normalizeIntentText`): «أربعة» reads «اربعه». */
const AR_NUMBERS: Readonly<Record<string, number>> = {
  ثلاث: 3,
  ثلاثه: 3,
  اربع: 4,
  اربعه: 4,
  خمس: 5,
  خمسه: 5,
  ست: 6,
  سته: 6,
  سبع: 7,
  سبعه: 7,
  ثمان: 8,
  ثماني: 8,
  ثمانيه: 8,
  تسع: 9,
  تسعه: 9,
  عشر: 10,
  عشره: 10,
};
/** "Several pages" names no number: the owner's four. */
const SEVERAL = 4;

const NUMBER_EN = `\\d{1,2}|${Object.keys(EN_NUMBERS).join('|')}`;
const COUNT_EN = new RegExp(`(?<![\\p{L}\\p{N}])(${NUMBER_EN})[\\s-]*pages?(?!\\p{L})`, 'u');
const SEVERAL_EN = /(?<!\p{L})(?:multi|multiple|several|many|few)[\s-]*pages?(?!\p{L})/u;
const COUNT_AR_DIGITS = /(?<![\p{L}\p{N}])(\d{1,2})\s*(?:صفحات|صفحه)(?!\p{L})/u;
const COUNT_AR_WORDS = new RegExp(
  `(?<!\\p{L})(${Object.keys(AR_NUMBERS).join('|')})\\s+صفحات(?!\\p{L})`,
  'u',
);
const TWO_AR = /(?<!\p{L})[وبل]?صفحت(?:ين|ان)(?!\p{L})/u;
const ONE_AR = /(?<!\p{L})صفحه\s+(?:واحده|وحده)(?!\p{L})/u;
const SEVERAL_AR =
  /(?<!\p{L})(?:(?:عده|كذا|متعدده|متعدد)\s+(?:ال)?صفح(?:ات|ه)|صفحات\s+متعدده|متعدد\s+الصفحات)(?!\p{L})/u;

/** How many pages the folded words ask for, when they say (the router's `pageCount`). */
function pageCount(folded: string): number | undefined {
  if (ONE_AR.test(folded)) return 1;
  const english = COUNT_EN.exec(folded)?.[1];
  if (english !== undefined) return EN_NUMBERS[english] ?? Number(english);
  const digits = COUNT_AR_DIGITS.exec(folded)?.[1];
  if (digits !== undefined) return Number(digits);
  const word = COUNT_AR_WORDS.exec(folded)?.[1];
  if (word !== undefined) return AR_NUMBERS[word];
  if (TWO_AR.test(folded)) return 2;
  if (SEVERAL_EN.test(folded) || SEVERAL_AR.test(folded)) return SEVERAL;
  return undefined;
}

/* ── Which pages ─────────────────────────────────────────────────────────── */

/** Arabic prefixes a page word carries: «والخدمات», «للتواصل», «بالأسعار». */
const AR_PREFIXES = ['وال', 'بال', 'لل', 'ال', 'و', 'ب', 'ل'];

function arabicKind(word: string): string | undefined {
  const direct = PAGE_NAMES_AR.get(word);
  if (direct !== undefined) return direct;
  for (const prefix of AR_PREFIXES) {
    const rest = word.startsWith(prefix) ? word.slice(prefix.length) : '';
    const kind = rest.length >= 2 ? PAGE_NAMES_AR.get(rest) : undefined;
    if (kind !== undefined) return kind;
  }
  return undefined;
}

/** The page kinds folded words name, in order, once each: "about us" is `about`. */
function kindsIn(folded: string): string[] {
  const words = folded.split(/[^\p{L}\p{N}]+/u).filter((word) => word !== '');
  const kinds: string[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? '';
    // «من نحن», «ومن نحن»: two words that name one page, and neither alone does.
    const pair = PAGE_NAME_PAIRS_AR.find(
      ([first, second]) => word.replace(/^و/u, '') === first && words[index + 1] === second,
    );
    if (pair !== undefined) index += 1;
    const kind = pair?.[2] ?? PAGE_NAMES_EN.get(word) ?? arabicKind(word);
    if (kind !== undefined && !kinds.includes(kind)) kinds.push(kind);
  }
  return kinds;
}

/** One named page as the person wrote it, and the kind it is when the lexicon knows it. */
interface Named {
  readonly title: string;
  readonly kind: string | undefined;
}

/** Where a sentence ends: the list runs to here and no further. */
const SENTENCE_END = /[.!?؟\n]/u;
/** Words that introduce a list of pages, in either language, before its first name. */
const LIST_LEADS =
  /(?<![\p{L}\p{N}])(?:pages?|with|including|includes|containing|named|called|such as|like|صفحات|صفحه|صفحة|فيه|فيها|يضم|تضم|يشمل|تشمل|يتضمن|تتضمن|وهي|هي|مثل)(?![\p{L}\p{N}])\s*[:–—-]?\s*/gu;
const LIST_SPLIT = /\s*(?:[,،;؛/|]+|\s(?:and|or|&)\s)\s*/iu;
/** Words that are no part of a page's name: articles, "page" itself, «صفحة». */
const EN_FILLER = /^(?:and|or|a|an|the|new|pages?|for|of)\s+|\s+(?:pages?|section)$/iu;
const AR_FILLER = /^(?:و\s*)?(?:صفحة|صفحه|صفحات)\s+|\s+(?:صفحة|صفحه)$/u;

function cleanPiece(piece: string): string {
  let text = piece.replace(/["“”«»']/gu, '').trim();
  for (let pass = 0; pass < 3; pass += 1) text = text.replace(EN_FILLER, '').replace(AR_FILLER, '');
  return text.replace(/^[-–—:\s]+|[-–—:.\s]+$/gu, '').trim();
}

/**
 * «من نحن وخدماتنا»: a word opening on «و» starts the next name, unless that word is a
 * page name whole («وظائف», careers) or it begins the piece («وتواصل» after a comma).
 */
function splitArabicAnd(piece: string): string[] {
  const words = piece.split(/\s+/u).filter((word) => word !== '');
  const names: string[][] = [];
  for (const word of words) {
    const whole = PAGE_NAMES_AR.get(normalizeIntentText(word)) !== undefined;
    const opens = word.length > 2 && word.startsWith('و') && !whole;
    const bare = opens ? word.slice(1) : word;
    if (opens || names.length === 0) names.push([bare]);
    else names.at(-1)?.push(word);
  }
  return names.map((name) => name.join(' '));
}

/** Every word a request names a language by (folded): "english", «بالعربي». */
const LANGUAGE_WORDS: ReadonlySet<string> = new Set(SITE_LANGUAGES.flatMap(({ words }) => words));
/** Words that only lead into a language: "contact in Arabic", «تواصل باللغة العربية». */
const INTO_LANGUAGE: ReadonlySet<string> = new Set(['in', 'into', 'باللغه', 'بلغه', 'اللغه']);

/**
 * A piece without the languages it ends on (T230c, 2026-10-12): a site "in Arabic and
 * English" lists its languages after its pages ("home, about, contact in Arabic and
 * English"), and neither "Contact in Arabic" nor "English" is a page.
 */
function withoutLanguages(piece: string): string {
  const words = piece.split(/\s+/u).filter((word) => word !== '');
  let end = words.length;
  let named = false;
  while (end > 0) {
    const word = foldWord(words[end - 1] ?? '');
    if (LANGUAGE_WORDS.has(word)) named = true;
    else if (!named || !INTO_LANGUAGE.has(word)) break;
    end -= 1;
  }
  return words.slice(0, end).join(' ');
}

function wordCount(text: string): number {
  return text.split(/\s+/u).filter((word) => word !== '').length;
}

/** A name as a title: the person's words, an English one capitalised ("about us" → "About us"). */
function titleOf(text: string, kind: string | undefined, lang: Lang): string {
  if (kind === 'faq' && /^faqs?$/iu.test(text)) return 'FAQ';
  const title = lang === 'en' ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  return title.slice(0, AI_SITE_MAX_TITLE_LENGTH).trim();
}

/** The names a list segment holds, when it reads as page names (see the header). */
function namesInList(segment: string, lang: Lang): Named[] | undefined {
  const pieces = segment
    .split(LIST_SPLIT)
    .flatMap((piece) => (lang === 'ar' ? splitArabicAnd(piece) : [piece]))
    .map((piece) => cleanPiece(withoutLanguages(piece)))
    .filter((piece) => piece !== '');
  const named = pieces.flatMap((piece): Named[] => {
    const kind = kindsIn(normalizeIntentText(piece))[0];
    const nameLike = wordCount(piece) <= (kind === undefined ? 2 : 4) && piece.length <= 40;
    return nameLike ? [{ title: titleOf(piece, kind, lang), kind }] : [];
  });
  const known = named.filter((name) => name.kind !== undefined).length;
  // A lone name is a page only when it is nothing else: "pricing", not "pages for my shop".
  const lone = named.length === 1 && !bare(named[0]?.title ?? '');
  return known > 0 && known * 2 >= named.length && !lone ? named : undefined;
}

/** One word, or one of the two-word Arabic names («من نحن»). */
function bare(name: string): boolean {
  const words = normalizeIntentText(name).split(' ');
  const [first = '', second] = words;
  return (
    words.length === 1 ||
    (words.length === 2 &&
      PAGE_NAME_PAIRS_AR.some(([one, two]) => first.replace(/^و/u, '') === one && second === two))
  );
}

/** Where a written-out list sits: `cut` is where the words about it begin, `to` its end. */
interface ListAt {
  readonly names: Named[];
  readonly cut: number;
  readonly to: number;
}

/**
 * The list the request writes out, or undefined when it writes none: after its last colon
 * first, then after each word that introduces one, the nearest to the names first.
 */
function listOf(request: string, lang: Lang): ListAt | undefined {
  const colon = Math.max(request.lastIndexOf(':'), request.lastIndexOf('：'));
  const leads = [...request.matchAll(LIST_LEADS)].map((lead) => ({
    cut: lead.index,
    from: lead.index + lead[0].length,
  }));
  const starts = [...(colon === -1 ? [] : [{ cut: colon, from: colon + 1 }]), ...leads.reverse()];
  for (const { cut, from } of starts) {
    const rest = request.slice(from);
    const end = SENTENCE_END.exec(rest)?.index ?? rest.length;
    const names = namesInList(rest.slice(0, end), lang);
    if (names !== undefined) return { names, cut, to: from + end };
  }
  return undefined;
}

/** One name per page: a second "About" (or a second `about`) is the same page. */
function distinct(names: readonly Named[]): Named[] {
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.kind ?? name.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The names, filled to `count` from the defaults, home first, at most eight. */
function pagesFor(names: readonly Named[], count: number | undefined, lang: Lang): Named[] {
  const pages = distinct(names);
  const wanted = Math.min(AI_SITE_MAX_PAGES, Math.max(count ?? pages.length, pages.length));
  const byKind = (kind: string): Named => ({ title: TITLES[kind]?.[lang] ?? kind, kind });
  // A home page is added unless the person counted exactly the pages they named.
  if (
    !pages.some((page) => page.kind === 'home') &&
    (count === undefined || count > pages.length)
  ) {
    pages.unshift(byKind('home'));
  }
  for (const kind of DEFAULT_KINDS) {
    if (pages.length >= wanted) break;
    if (!pages.some((page) => page.kind === kind)) pages.push(byKind(kind));
  }
  const home = pages.findIndex((page) => page.kind === 'home');
  if (home > 0) pages.unshift(...pages.splice(home, 1));
  return pages.slice(0, AI_SITE_MAX_PAGES);
}

/* ── Each page's brief ───────────────────────────────────────────────────── */

const COUNT_PHRASE_EN = new RegExp(
  `(?:(?:with|of|in)\\s+)?(?<![\\p{L}\\p{N}])(?:${NUMBER_EN}|multi|multiple|several)[\\s-]*pages?(?!\\p{L})`,
  'giu',
);
/** «من 4 صفحات», «بأربع صفحات», «صفحتين», as written (the count reader reads them folded). */
const COUNT_PHRASE_AR =
  /(?:(?:من|ب|فيه|فيها)\s*)?(?:[0-9٠-٩]{1,2}\s*(?:صفحات|صفحة|صفحه)|(?:ثلاث|[أاإ]ربع|خمس|ست|سبع|ثماني?|تسع|عشر)[ةه]?\s+صفحات|[وبل]?صفحت(?:ين|ان))(?!\p{L})/gu;
/** What a cut list leaves behind it: the words that introduced it, and punctuation. */
const TRAILING =
  /(?:\s+(?:with|including|containing|pages?|of|for|صفحات|فيه|فيها|من))*[\s.!?؟:،,;؛–—-]*$/iu;

/** The site itself, as the person put it: the words without the page list and the count. */
function subjectOf(request: string, list: ListAt | undefined): string {
  const without =
    list === undefined ? request : `${request.slice(0, list.cut)} ${request.slice(list.to)}`;
  const subject = without
    .replace(COUNT_PHRASE_EN, ' ')
    .replace(COUNT_PHRASE_AR, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(TRAILING, '')
    .trim();
  return subject === '' ? request.replace(/\s+/gu, ' ').trim() : subject;
}

function briefFor(
  page: Named,
  first: boolean,
  titles: readonly string[],
  subject: string,
  lang: Lang,
): string {
  const count = titles.length;
  // The first page is the home page; said only when its name does not say so.
  const role = first && page.kind !== 'home';
  if (lang === 'ar') {
    const size = count === 2 ? 'صفحتين' : `${String(count)} صفحات`;
    return `صفحة «${page.title}»${role ? '، الصفحة الرئيسية،' : ''} من موقع من ${size}. الموقع: ${subject}. صفحاته: ${titles.join('، ')}. ابنِ هذه الصفحة وحدها، بهوية الموقع وأسلوبه.`;
  }
  return `The ${page.title} page${role ? ' (the home page)' : ''} of a ${String(count)}-page website. The site: ${subject}. Its pages: ${titles.join(', ')}. Build only this page, in the site's own brand and style.`;
}

export interface SiteFromWordsOptions {
  /**
   * The request is already known to ask for a site (the router read it `build-site`), so
   * words that name and count fewer than two pages ("a website with pages for my shop")
   * plan the owner's four. A stated count of one is still one page: `null`.
   */
  readonly assumeSite?: boolean | undefined;
}

/**
 * The site a request asks for, read from its words, or `null` when it asks for one page
 * (or names and counts none, unless `assumeSite`). Pure: the same words, the same site.
 */
export function sitePlanFromRequest(
  request: string,
  options: SiteFromWordsOptions = {},
): AiSitePlan | null {
  const lang: Lang = detectPromptLanguage(request) ?? 'en';
  const folded = normalizeIntentText(request);
  const stated = pageCount(folded);
  if (stated !== undefined && stated < AI_SITE_MIN_PAGES) return null;
  const list = listOf(request, lang);
  const names =
    list?.names ??
    kindsIn(folded).map((kind): Named => ({ title: TITLES[kind]?.[lang] ?? kind, kind }));
  const assumed = options.assumeSite === true && names.length < AI_SITE_MIN_PAGES;
  const count = stated ?? (assumed ? SEVERAL : undefined);
  if (count === undefined && names.length < AI_SITE_MIN_PAGES) return null;
  const named = pagesFor(names, count, lang);
  if (named.length < AI_SITE_MIN_PAGES) return null;
  const titles = named.map((page) => page.title);
  const subject = subjectOf(request, list);
  const pages = named.map((page, index): AiSitePage => ({
    title: page.title,
    request: briefFor(page, index === 0, titles, subject, lang),
  }));
  return { pages, source: 'words', locale: lang };
}
