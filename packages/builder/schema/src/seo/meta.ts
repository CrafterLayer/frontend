import { ARABIC_MARKS, collapseSpace, isArabicChar, isCjkChar, isRtlLang, primaryLang } from './text';

/*
  Title and description by RENDERED WIDTH, not character count (DESIGN D.2).
  Search results truncate by pixels: an Arabic title of 56 characters fits
  where a Latin one of 56 does not. The advance per glyph is an estimate per
  script (Latin 0.55em, Arabic 0.5em, CJK 1em) at the result page's type size:
  20px for a title, 14px for a description.
*/

export const SEO_TITLE_FONT_PX = 20;
export const SEO_DESCRIPTION_FONT_PX = 14;
export const SEO_TITLE_MAX_PX = 580;
export const SEO_DESCRIPTION_MAX_PX = 920;
/** Under these a title or description reads as thin (≈25 Arabic / 23 Latin chars; ≈60 / 55). */
export const SEO_TITLE_MIN_PX = 250;
export const SEO_DESCRIPTION_MIN_PX = 420;

export type SeoTextKind = 'title' | 'description';
export type SeoScript = 'arabic' | 'latin' | 'other';

const ZERO_WIDTH = /[\p{M}​-‏⁠﻿]/u;

/** Estimated rendered width in CSS pixels of `text` as a result title or description. */
export function seoTextWidth(text: string, kind: SeoTextKind = 'title'): number {
  const font = kind === 'title' ? SEO_TITLE_FONT_PX : SEO_DESCRIPTION_FONT_PX;
  let em = 0;
  for (const char of text) {
    if (ZERO_WIDTH.test(char)) continue;
    if (isArabicChar(char)) em += 0.5;
    else if (isCjkChar(char)) em += 1;
    else em += 0.55;
  }
  return Math.round(em * font * 100) / 100;
}

/** The dominant script of a text's letters; 'other' when it has none of either. */
export function scriptOf(text: string): SeoScript {
  let arabic = 0;
  let latin = 0;
  let other = 0;
  for (const char of text.replace(ARABIC_MARKS, '')) {
    if (!/\p{L}/u.test(char)) continue;
    if (isArabicChar(char)) arabic += 1;
    else if (/\p{Script=Latin}/u.test(char)) latin += 1;
    else other += 1;
  }
  if (arabic === 0 && latin === 0) return 'other';
  if (other > arabic && other > latin) return 'other';
  return arabic >= latin ? 'arabic' : 'latin';
}

export type SeoMetaIssueCode =
  | 'title-missing'
  | 'title-filled'
  | 'title-suffix-dropped'
  | 'title-truncated'
  | 'title-short'
  | 'title-script'
  | 'description-missing'
  | 'description-filled'
  | 'description-truncated'
  | 'description-short'
  | 'description-script';

export interface SeoMetaIssue {
  code: SeoMetaIssueCode;
  field: 'title' | 'description';
  message: string;
}

export interface SeoMetaInput {
  title?: string | undefined;
  description?: string | undefined;
  /** The page's h1: the title when none is given. */
  h1?: string | undefined;
  /** The page's lead paragraph: the description when none is given. */
  lead?: string | undefined;
  lang: string;
  siteName?: string | undefined;
  /** e.g. '%s | Site'; `%s` is the page title. Wins over `siteName`. */
  template?: string | undefined;
}

export interface SeoMetaResult {
  title: string;
  description: string;
  issues: SeoMetaIssue[];
}

const RTL_SEPARATOR_FLIPS: Readonly<Record<string, string>> = {
  '›': '‹',
  '‹': '›',
  '»': '«',
  '«': '»',
  '>': '<',
  '<': '>',
  '→': '←',
  '←': '→',
};

/** Mirrors directional separators for an RTL page: `%s › Site` reads `%s ‹ Site`. */
export function flipSeparatorForRtl(text: string): string {
  return text.replace(/[›‹»«<>→←]/gu, (char) => RTL_SEPARATOR_FLIPS[char] ?? char);
}

const DANGLING_END = /[\s,;:\-–—|·•/\\،؛(«"'“‘[{]+$/u;
const DANGLING_WORDS = new Set([
  'و',
  'في',
  'من',
  'على',
  'مع',
  'عن',
  'إلى',
  'الى',
  'أو',
  'او',
  'and',
  'or',
  'the',
  'a',
  'an',
  'of',
  'for',
  'with',
  'to',
  'in',
  '&',
]);

function stripDangling(text: string): string {
  let out = text.replace(DANGLING_END, '');
  for (let guard = 0; guard < 3; guard += 1) {
    const space = out.lastIndexOf(' ');
    if (space <= 0) break;
    const last = out.slice(space + 1).toLowerCase();
    if (!DANGLING_WORDS.has(last)) break;
    out = out.slice(0, space).replace(DANGLING_END, '');
  }
  return out;
}

/** The longest word-boundary prefix of `text` within `budget` px; never a split word unless one word overflows alone. */
function cutToWidth(text: string, budget: number, kind: SeoTextKind): string {
  const words = text.split(' ');
  let out = '';
  for (const word of words) {
    const candidate = out === '' ? word : `${out} ${word}`;
    if (seoTextWidth(candidate, kind) > budget) break;
    out = candidate;
  }
  if (out === '') {
    for (const char of text) {
      if (seoTextWidth(out + char, kind) > budget) break;
      out += char;
    }
  }
  return stripDangling(out);
}

const SENTENCE_END = /[.!?؟。](?=\s|$)/gu;

function cutDescription(text: string, budget: number): string {
  const ellipsis = '…';
  const cut = cutToWidth(text, budget - seoTextWidth(ellipsis, 'description'), 'description');
  // A whole sentence that fills most of the budget reads better than a clipped one.
  let lastSentence = -1;
  for (const match of text.slice(0, cut.length + 1).matchAll(SENTENCE_END)) {
    lastSentence = match.index + 1;
  }
  if (lastSentence > 0 && seoTextWidth(text.slice(0, lastSentence), 'description') >= budget * 0.5) {
    return text.slice(0, lastSentence).trim();
  }
  return `${cut}${ellipsis}`;
}

function scriptMatches(text: string, lang: string): boolean {
  const script = scriptOf(text);
  const primary = primaryLang(lang);
  if (script === 'other' || primary === '') return true;
  if (primary === 'ar' || primary === 'fa' || primary === 'ur') return script === 'arabic';
  if (isRtlLang(lang)) return true;
  return script !== 'arabic';
}

function composeTitle(base: string, input: SeoMetaInput, rtl: boolean): string {
  const siteName = collapseSpace(input.siteName ?? '');
  const template = collapseSpace(input.template ?? '');
  if (base === '') return siteName;
  if (template.includes('%s')) {
    // A title that already names the site is not templated a second time.
    if (siteName !== '' && base.includes(siteName) && template.includes(siteName)) return base;
    return (rtl ? flipSeparatorForRtl(template) : template).replace('%s', () => base);
  }
  if (siteName === '' || base.includes(siteName)) return base;
  return `${base} | ${siteName}`;
}

/**
 * Title and description for a page, fitted to the result page's width
 * budgets. Missing fields fill from the h1 and lead; a template's site-name
 * part is dropped before the page's own words are cut; cuts land on word
 * boundaries with no dangling punctuation; directional separators mirror on
 * RTL pages. Every adjustment is reported in `issues`.
 */
export function seoMeta(input: SeoMetaInput): SeoMetaResult {
  const issues: SeoMetaIssue[] = [];
  const rtl = isRtlLang(input.lang);

  // --- title
  let base = collapseSpace(input.title ?? '');
  if (base === '') {
    const h1 = collapseSpace(input.h1 ?? '');
    if (h1 !== '') {
      base = h1;
      issues.push({ code: 'title-filled', field: 'title', message: 'Title was empty; filled from the h1.' });
    } else {
      issues.push({ code: 'title-missing', field: 'title', message: 'The page has no title and no h1.' });
    }
  }
  let title = composeTitle(base, input, rtl);
  if (seoTextWidth(title, 'title') > SEO_TITLE_MAX_PX && title !== base && base !== '') {
    title = base;
    issues.push({
      code: 'title-suffix-dropped',
      field: 'title',
      message: 'The site name did not fit the title width; kept the page title alone.',
    });
  }
  if (seoTextWidth(title, 'title') > SEO_TITLE_MAX_PX) {
    title = cutToWidth(title, SEO_TITLE_MAX_PX, 'title');
    issues.push({
      code: 'title-truncated',
      field: 'title',
      message: `The title is wider than ${String(SEO_TITLE_MAX_PX)}px in results; cut at a word boundary.`,
    });
  }
  if (title !== '' && seoTextWidth(title, 'title') < SEO_TITLE_MIN_PX) {
    issues.push({ code: 'title-short', field: 'title', message: 'The title is short; name the offer and the place.' });
  }
  if (base !== '' && !scriptMatches(base, input.lang)) {
    issues.push({
      code: 'title-script',
      field: 'title',
      message: `The title is not written in the page's language (${input.lang}).`,
    });
  }

  // --- description
  let description = collapseSpace(input.description ?? '');
  if (description === '') {
    const lead = collapseSpace(input.lead ?? '');
    if (lead !== '') {
      description = lead;
      issues.push({
        code: 'description-filled',
        field: 'description',
        message: 'Description was empty; filled from the lead paragraph.',
      });
    } else {
      issues.push({
        code: 'description-missing',
        field: 'description',
        message: 'The page has no description and no lead paragraph.',
      });
    }
  }
  if (seoTextWidth(description, 'description') > SEO_DESCRIPTION_MAX_PX) {
    description = cutDescription(description, SEO_DESCRIPTION_MAX_PX);
    issues.push({
      code: 'description-truncated',
      field: 'description',
      message: `The description is wider than ${String(SEO_DESCRIPTION_MAX_PX)}px in results; cut at a boundary.`,
    });
  }
  if (description !== '' && seoTextWidth(description, 'description') < SEO_DESCRIPTION_MIN_PX) {
    issues.push({
      code: 'description-short',
      field: 'description',
      message: 'The description is short; add concrete facts (what, where, hours, price).',
    });
  }
  if (description !== '' && !scriptMatches(description, input.lang)) {
    issues.push({
      code: 'description-script',
      field: 'description',
      message: `The description is not written in the page's language (${input.lang}).`,
    });
  }

  return { title, description, issues };
}
