/**
 * The languages a site can be written in (2026-10-12), and how a request names them in English
 * or Arabic. A page's language is a BCP 47 tag on its root (`lang`) and its direction on the
 * document; a site in several languages is one page per language, linked as alternates.
 */

export interface SiteLanguage {
  /** BCP 47 primary tag. */
  readonly tag: string;
  readonly english: string;
  readonly arabic: string;
  /** The name in the language itself, for a language switcher. */
  readonly native: string;
  readonly dir: 'ltr' | 'rtl';
  /** Words a request may use for it, folded (lower case; Arabic without hamza or taa marbuta). */
  readonly words: readonly string[];
}

export const SITE_LANGUAGES: readonly SiteLanguage[] = [
  {
    tag: 'en',
    english: 'English',
    arabic: 'الإنجليزية',
    native: 'English',
    dir: 'ltr',
    words: [
      'english',
      'انجليزي',
      'انجليزيه',
      'الانجليزي',
      'الانجليزيه',
      'انكليزي',
      'الانكليزيه',
      'بالانجليزي',
      'بالانجليزيه',
    ],
  },
  {
    tag: 'ar',
    english: 'Arabic',
    arabic: 'العربية',
    native: 'العربية',
    dir: 'rtl',
    words: ['arabic', 'عربي', 'عربيه', 'العربي', 'العربيه', 'بالعربي', 'بالعربيه'],
  },
  {
    tag: 'fr',
    english: 'French',
    arabic: 'الفرنسية',
    native: 'Français',
    dir: 'ltr',
    words: [
      'french',
      'francais',
      'فرنسي',
      'فرنسيه',
      'الفرنسي',
      'الفرنسيه',
      'بالفرنسي',
      'بالفرنسيه',
    ],
  },
  {
    tag: 'es',
    english: 'Spanish',
    arabic: 'الإسبانية',
    native: 'Español',
    dir: 'ltr',
    words: [
      'spanish',
      'espanol',
      'اسباني',
      'اسبانيه',
      'الاسباني',
      'الاسبانيه',
      'بالاسباني',
      'بالاسبانيه',
    ],
  },
  {
    tag: 'de',
    english: 'German',
    arabic: 'الألمانية',
    native: 'Deutsch',
    dir: 'ltr',
    words: [
      'german',
      'deutsch',
      'الماني',
      'المانيه',
      'الالماني',
      'الالمانيه',
      'بالالماني',
      'بالالمانيه',
    ],
  },
  {
    tag: 'it',
    english: 'Italian',
    arabic: 'الإيطالية',
    native: 'Italiano',
    dir: 'ltr',
    words: ['italian', 'ايطالي', 'ايطاليه', 'الايطالي', 'الايطاليه', 'بالايطالي', 'بالايطاليه'],
  },
  {
    tag: 'pt',
    english: 'Portuguese',
    arabic: 'البرتغالية',
    native: 'Português',
    dir: 'ltr',
    words: [
      'portuguese',
      'برتغالي',
      'برتغاليه',
      'البرتغالي',
      'البرتغاليه',
      'بالبرتغالي',
      'بالبرتغاليه',
    ],
  },
  {
    tag: 'tr',
    english: 'Turkish',
    arabic: 'التركية',
    native: 'Türkçe',
    dir: 'ltr',
    words: ['turkish', 'تركي', 'تركيه', 'التركي', 'التركيه', 'بالتركي', 'بالتركيه'],
  },
  {
    tag: 'ru',
    english: 'Russian',
    arabic: 'الروسية',
    native: 'Русский',
    dir: 'ltr',
    words: ['russian', 'روسي', 'روسيه', 'الروسي', 'الروسيه', 'بالروسي', 'بالروسيه'],
  },
  {
    tag: 'zh',
    english: 'Chinese',
    arabic: 'الصينية',
    native: '中文',
    dir: 'ltr',
    words: ['chinese', 'صيني', 'صينيه', 'الصيني', 'الصينيه', 'بالصيني', 'بالصينيه'],
  },
  {
    tag: 'ja',
    english: 'Japanese',
    arabic: 'اليابانية',
    native: '日本語',
    dir: 'ltr',
    words: ['japanese', 'ياباني', 'يابانيه', 'الياباني', 'اليابانيه', 'بالياباني', 'باليابانيه'],
  },
  {
    tag: 'ko',
    english: 'Korean',
    arabic: 'الكورية',
    native: '한국어',
    dir: 'ltr',
    words: ['korean', 'كوري', 'كوريه', 'الكوري', 'الكوريه', 'بالكوري', 'بالكوريه'],
  },
  {
    tag: 'hi',
    english: 'Hindi',
    arabic: 'الهندية',
    native: 'हिन्दी',
    dir: 'ltr',
    words: ['hindi', 'هندي', 'هنديه', 'الهندي', 'الهنديه', 'بالهندي', 'بالهنديه'],
  },
  {
    tag: 'ur',
    english: 'Urdu',
    arabic: 'الأردية',
    native: 'اردو',
    dir: 'rtl',
    words: ['urdu', 'اردي', 'اردو', 'الاردي', 'الارديه', 'بالاردو', 'بالارديه'],
  },
  {
    tag: 'fa',
    english: 'Persian',
    arabic: 'الفارسية',
    native: 'فارسی',
    dir: 'rtl',
    words: ['persian', 'farsi', 'فارسي', 'فارسيه', 'الفارسي', 'الفارسيه', 'بالفارسي', 'بالفارسيه'],
  },
  {
    tag: 'he',
    english: 'Hebrew',
    arabic: 'العبرية',
    native: 'עברית',
    dir: 'rtl',
    words: ['hebrew', 'عبري', 'عبريه', 'العبري', 'العبريه', 'بالعبري', 'بالعبريه'],
  },
  {
    tag: 'id',
    english: 'Indonesian',
    arabic: 'الإندونيسية',
    native: 'Bahasa Indonesia',
    dir: 'ltr',
    words: [
      'indonesian',
      'اندونيسي',
      'اندونيسيه',
      'الاندونيسي',
      'الاندونيسيه',
      'بالاندونيسي',
      'بالاندونيسيه',
    ],
  },
  {
    tag: 'ms',
    english: 'Malay',
    arabic: 'الملايوية',
    native: 'Bahasa Melayu',
    dir: 'ltr',
    words: ['malay', 'ملايو', 'الملايويه', 'بالملايو'],
  },
  {
    tag: 'nl',
    english: 'Dutch',
    arabic: 'الهولندية',
    native: 'Nederlands',
    dir: 'ltr',
    words: ['dutch', 'هولندي', 'هولنديه', 'الهولندي', 'الهولنديه', 'بالهولندي', 'بالهولنديه'],
  },
];

const BY_TAG = new Map(SITE_LANGUAGES.map((language) => [language.tag, language]));
/** A BCP 47 tag the export accepts: a primary subtag and optional region/script. */
const LANG_TAG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;

/** Case, hamza, taa marbuta and alef maqsura folded, harakat dropped (as the intent matcher reads). */
export function foldWord(text: string): string {
  return (
    text
      .toLocaleLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/gu, '')
      // NFD splits «أ» «إ» «آ» into alef and a combining hamza or madda (U+0653-U+0655).
      .replace(/[\u064B-\u065F\u0670\u0640]/gu, '')
      .replace(/[أإآ]/gu, 'ا')
      .replace(/ة/gu, 'ه')
      .replace(/ى/gu, 'ي')
  );
}

/** The language a tag names (by its primary subtag), or undefined. */
export function siteLanguage(tag: string): SiteLanguage | undefined {
  return BY_TAG.get(tag.toLowerCase().split('-')[0] ?? '');
}

/** Whether a string is a language tag a page may carry. */
export function isLanguageTag(tag: string): boolean {
  return LANG_TAG.test(tag);
}

/** A tag's direction: right to left for Arabic, Hebrew, Persian, Urdu; left to right otherwise. */
export function languageDirection(tag: string): 'ltr' | 'rtl' {
  return siteLanguage(tag)?.dir ?? 'ltr';
}
