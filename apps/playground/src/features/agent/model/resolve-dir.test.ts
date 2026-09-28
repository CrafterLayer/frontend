/**
 * `resolveDir` decides the `dir` of every piece of person- or model-written text in the
 * panel (SPEC §4.5, §4.10, §4.17, §6.6). Two tables: the SPEC's own cases, and every case
 * the upstream Streamdown suite asserts (vendor/streamdown-detect-direction/
 * detect-direction.test.upstream.ts), so the adaptation provably keeps upstream's
 * behaviour everywhere except the two places VENDOR.md says it changed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveDir, resolveLang, type TextDirection } from './resolve-dir';

const BOTH_UI_DIRS: readonly TextDirection[] = ['rtl', 'ltr'];

describe('resolveDir — SPEC §8 WP-03 table', () => {
  // Majority of letters wins, whatever the UI direction is.
  it.each(BOTH_UI_DIRS)('an Arabic request with a leading English word is rtl (ui %s)', (ui) => {
    // 4 Latin letters against 10 Arabic: `dir="auto"` would say ltr here, which is the
    // reason the panel never uses it.
    expect(resolveDir('Hero قسم الخدمات', ui)).toBe('rtl');
  });

  it.each(BOTH_UI_DIRS)('an English request ending in Arabic is ltr (ui %s)', (ui) => {
    expect(resolveDir('Build a site لمطعم', ui)).toBe('ltr');
  });

  // No letters at all: nothing in the text can decide, so it reads like the panel around it.
  it.each([
    ['', 'rtl'],
    ['', 'ltr'],
    ['   \n\t', 'rtl'],
    ['   \n\t', 'ltr'],
  ] as const)('empty or blank text takes the UI direction (%j, ui %s)', (text, ui) => {
    expect(resolveDir(text, ui)).toBe(ui);
  });

  it.each([
    ['12345', 'rtl'],
    ['12345', 'ltr'],
    ['5/8 — 1:24!', 'rtl'],
    ['5/8 — 1:24!', 'ltr'],
    ['…?!', 'rtl'],
    ['…?!', 'ltr'],
    ['٣/٨', 'ltr'],
    ['٣/٨', 'rtl'],
    ['؟،', 'ltr'],
    ['؟،', 'rtl'],
  ] as const)('digits and punctuation alone take the UI direction (%j, ui %s)', (text, ui) => {
    expect(resolveDir(text, ui)).toBe(ui);
  });

  it('an Arabic-Indic digit or Arabic punctuation is not an Arabic letter', () => {
    // Upstream counts every code point in U+0590–U+08FF as a strong RTL character, so
    // `٣/٨` and `؟` would read rtl in an English UI. They are a number and a mark.
    expect(resolveDir('٣/٨ ؟', 'ltr')).toBe('ltr');
    expect(resolveDir('Page ٣', 'rtl')).toBe('ltr');
  });

  it('Arabic diacritics do not outvote Latin letters', () => {
    // «مَرْ» is two letters and two marks. Counted as upstream counts them it would be
    // 4 rtl against 2 ltr; letters alone make it a tie, which the first letter breaks.
    expect(resolveDir('Hi مَرْ', 'rtl')).toBe('ltr');
    expect(resolveDir('مَرْ Hi', 'ltr')).toBe('rtl');
  });

  it('a tie goes to the first letter, not to the UI direction', () => {
    expect(resolveDir('ab سب', 'rtl')).toBe('ltr');
    expect(resolveDir('سب ab', 'ltr')).toBe('rtl');
  });
});

describe('resolveDir — upstream Streamdown cases', () => {
  it.each([
    ['Hello world', 'ltr'],
    ['مرحبا بالعالم', 'rtl'],
    ['שלום עולם', 'rtl'],
    ['## مرحبا', 'rtl'],
    ['123. مرحبا', 'rtl'],
    ['**שלום**', 'rtl'],
    ['Hello مرحبا', 'ltr'],
    ['مرحبا Hello', 'rtl'],
    ['React یک کتابخانه جاوااسکریپت بسیار محبوب است.', 'rtl'],
    ['این یک نمونه است.\n\n```js\nconst example = true;\n```', 'rtl'],
    ['ދިވެހި', 'rtl'],
    ['`code` مرحبا', 'rtl'],
  ] as const)('%j → %s under either UI direction', (text, expected) => {
    for (const ui of BOTH_UI_DIRS) expect(resolveDir(text, ui)).toBe(expected);
  });

  it('keeps link text and drops the URL', () => {
    // The URL is 23 Latin letters; left in, it would outvote the Arabic link text.
    expect(resolveDir('[صفحة المطعم الرئيسية](https://example.com/restaurant)', 'ltr')).toBe('rtl');
  });

  // Upstream returns "ltr" for these two; the panel returns the UI direction instead.
  it.each([
    ['', 'rtl'],
    ['12345', 'rtl'],
  ] as const)('no letters: upstream says ltr, the panel says the UI direction (%j)', (text, ui) => {
    expect(resolveDir(text, ui)).toBe('rtl');
  });
});

describe('resolveDir — the RTL ranges end where upstream says they end', () => {
  // One letter each side of every range boundary in upstream's RTL_PATTERN
  // (U+0590–U+08FF, U+FB1D–U+FDFF, U+FE70–U+FEFF). Only letters count, so every sample is
  // a letter (\p{L}); a lone letter decides the direction on its own.
  it.each([
    ['0587', 'ltr'], // ARMENIAN SMALL LIGATURE ECH YIWN, just below U+0590
    ['05D0', 'rtl'], // HEBREW LETTER ALEF, first letter inside the first range
    ['08A0', 'rtl'], // ARABIC LETTER BEH WITH SMALL V BELOW, Arabic Extended-A
    ['0904', 'ltr'], // DEVANAGARI LETTER SHORT A, just above U+08FF
    ['FB17', 'ltr'], // ARMENIAN SMALL LIGATURE MEN XEH, just below U+FB1D
    ['FB1D', 'rtl'], // HEBREW LETTER YOD WITH HIRIQ, the second range's first code point
    ['FDFB', 'rtl'], // ARABIC LIGATURE JALLAJALALOUHOU, near U+FDFF
    ['FE70', 'rtl'], // ARABIC FATHATAN ISOLATED FORM, the third range's first code point
    ['FEFC', 'rtl'], // ARABIC LIGATURE LAM WITH ALEF FINAL FORM, near U+FEFF
    ['FF21', 'ltr'], // FULLWIDTH LATIN CAPITAL LETTER A, just above U+FEFF
  ] as const)('U+%s is %s', (hex, expected) => {
    const letter = String.fromCodePoint(Number.parseInt(hex, 16));
    for (const ui of BOTH_UI_DIRS) expect(resolveDir(letter, ui)).toBe(expected);
  });

  it('spells the ranges with \\u escapes, as upstream does, never as literal code points', () => {
    // A literal U+FEFF (an invisible BOM) and a literal U+08FF (a combining mark that
    // fuses with the `-` before it) inside a character class made the pattern unreadable
    // and unreviewable. Vitest runs from apps/playground (see vitest.config.ts).
    const source = readFileSync(
      join(process.cwd(), 'src', 'features', 'agent', 'model', 'resolve-dir.ts'),
      'utf8',
    );
    const declaration = source.split('\n').find((line) => line.startsWith('const RTL_PATTERN'));
    expect(declaration).toBe(
      String.raw`const RTL_PATTERN = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;`,
    );
    // No format characters (BOM, bidi controls, zero-width joiners) anywhere in the file.
    expect(source.match(/\p{Cf}/gu) ?? []).toEqual([]);
  });

  it('keeps the same class as the vendored upstream file', () => {
    const upstream = readFileSync(
      join(
        process.cwd(),
        '..',
        '..',
        'vendor',
        'streamdown-detect-direction',
        'detect-direction.upstream.ts',
      ),
      'utf8',
    );
    expect(upstream).toContain(String.raw`/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/`);
  });
});

describe('resolveLang', () => {
  it('names the script the letters are written in', () => {
    expect(resolveLang('Hero قسم الخدمات', 'en')).toBe('ar');
    expect(resolveLang('Build a site لمطعم', 'ar')).toBe('en');
  });

  it('falls back to the UI locale when there are no letters', () => {
    expect(resolveLang('', 'ar')).toBe('ar');
    expect(resolveLang('', 'en')).toBe('en');
    expect(resolveLang('5/8', 'ar')).toBe('ar');
  });
});
