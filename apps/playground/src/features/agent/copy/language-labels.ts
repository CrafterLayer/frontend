/**
 * The words of a site in several languages (2026-10-12), in both languages. Kept beside the
 * catalog rather than in it: the catalog files are at their size limit. Digits stay Latin
 * (the editor's rule). `build` is what the ENGINE reads before a build, never shown.
 */
import { siteLanguage } from '@craftkit/builder';

import { arabicCount } from '../../preview/arabic-count';
import type { Locale } from '../model/view-types';

export interface LanguageLabels {
  /** A language's name in the panel's language («الإنجليزية», "English"). */
  readonly name: (tag: string) => string;
  /** The request each version's translation is sent as (the person's turn). */
  readonly translate: (language: string, address: string) => string;
  /** After versions were added: which, where, and what happens next. */
  readonly added: (languages: readonly string[], addresses: readonly string[]) => string;
  /** Every version asked for was already there. */
  readonly already: (languages: readonly string[]) => string;
  /** A whole-site translation is starting. */
  readonly translatingSite: (language: string, pages: number) => string;
  /** The editor holds one page, not a site: versions need pages. */
  readonly noSite: string;
}

function list(names: readonly string[], comma: string, and: string): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(comma)}${and}${names.at(-1) ?? ''}`;
}

const EN: LanguageLabels = {
  name: (tag) => siteLanguage(tag)?.english ?? tag,
  translate: (language, address) => `Translate this page to ${language} (${address}).`,
  added: (languages, addresses) =>
    `Added the ${list(languages, ', ', ' and ')} ${languages.length === 1 ? 'version' : 'versions'}: ${addresses.join(', ')}. Every version is linked to the others for search and has a language switcher. Translating ${addresses.length === 1 ? 'it' : 'them'} now, one page at a time.`,
  already: (languages) =>
    `The ${list(languages, ', ', ' and ')} ${languages.length === 1 ? 'version already exists' : 'versions already exist'}. Ask me to translate or change ${languages.length === 1 ? 'it' : 'them'}.`,
  translatingSite: (language, pages) =>
    `Translating ${String(pages)} ${pages === 1 ? 'page' : 'pages'} to ${language}, one page at a time.`,
  noSite:
    'Language versions are pages of a site, and this editor holds one page. Ask me to translate this page instead.',
};

const AR: LanguageLabels = {
  name: (tag) => siteLanguage(tag)?.arabic ?? tag,
  translate: (language, address) => `ترجم هذه الصفحة إلى ${language} (${address}).`,
  added: (languages, addresses) =>
    `أضفت ${languages.length === 1 ? 'النسخة' : 'النسخ'} ${list(languages, '، ', ' و')}: ${addresses.join('، ')}. كل نسخة مرتبطة بالأخرى لمحركات البحث وفيها مبدّل للغة. أترجمها الآن، صفحة بعد صفحة.`,
  already: (languages) =>
    `${languages.length === 1 ? 'النسخة' : 'النسخ'} ${list(languages, '، ', ' و')} موجودة من قبل. اطلب مني ترجمتها أو تعديلها.`,
  translatingSite: (language, pages) =>
    // The pages are the verb's object: the dual is «صفحتين».
    `أترجم ${arabicCount(pages, { one: 'صفحة واحدة', two: 'صفحتين', few: 'صفحات', many: 'صفحة' })} إلى ${language}، صفحة بعد صفحة.`,
  noSite:
    'نسخ اللغات صفحات في موقع، وهذا المحرر فيه صفحة واحدة. اطلب مني ترجمة هذه الصفحة بدلًا من ذلك.',
};

export function languageLabels(locale: Locale): LanguageLabels {
  return locale === 'ar' ? AR : EN;
}
