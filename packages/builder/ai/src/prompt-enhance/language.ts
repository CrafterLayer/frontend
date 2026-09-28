import type { AiPromptLocale } from '../types';

/*
  Arabic letters in the blocks a draft is typed in: Arabic, Arabic Supplement,
  Arabic Extended-A, and the two presentation-form blocks a pasted PDF or an
  old keyboard layout produces.
*/
const ARABIC_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;
const LATIN_LETTER = /[a-z]/iu;
/** Quoted copy — «…», "…", “…” — is the page's content, not the language of the request. */
const QUOTED = /«[^»]*»|"[^"]*"|“[^”]*”/gu;

function countWords(text: string): { readonly arabic: number; readonly latin: number } {
  let arabic = 0;
  let latin = 0;
  for (const word of text.split(/\s+/u)) {
    if (ARABIC_LETTER.test(word)) arabic += 1;
    else if (LATIN_LETTER.test(word)) latin += 1;
  }
  return { arabic, latin };
}

/**
 * The language a draft is written in, by WORDS in its own framing: Arabic
 * when it has at least as many Arabic words as Latin ones, English when Latin
 * words outnumber them, undefined when it has no words in either script (a
 * phone number, an emoji).
 *
 * Words, not letters, and quotes set aside, because a Latin brand is the
 * person's own name for their business: «صفحة لمطعم Burger House» has more
 * Latin letters (11) than Arabic (9) and is an Arabic request; so is «أضف قسم
 * بعنوان "Fresh coffee roasted every morning"». Only when the quotes hold
 * every word is the quoted text counted.
 */
export function detectPromptLanguage(text: string): AiPromptLocale | undefined {
  let counted = countWords(text.replace(QUOTED, ' '));
  if (counted.arabic === 0 && counted.latin === 0) counted = countWords(text);
  if (counted.arabic === 0 && counted.latin === 0) return undefined;
  return counted.arabic >= counted.latin ? 'ar' : 'en';
}
