/**
 * The house rules of the copy (SPEC §4.0, §4.3, §6.1), run over every authored value.
 * Each rule names the defect it keeps out; several are regressions from the v1 panel
 * («صِف», the "AI: …" prefix glued onto Arabic, "~4 min left", ALL-CAPS labels, `·`
 * joining facts). A rule over prose is only as good as its reach, so the counted-noun
 * rule also scans every source file of the feature, not only the catalogs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ar } from './ar';
import { en } from './en';
import { entryForms as formsOf, KEYS, STATUS_KEYS, type Key } from './keys';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

interface Value {
  readonly key: Key;
  readonly text: string;
}

// The starters are catalog keys too (`starter.*`), so every rule below reads them.
const AR_VALUES: readonly Value[] = KEYS.flatMap((key) =>
  formsOf(ar[key]).map((text) => ({ key, text })),
);
const EN_VALUES: readonly Value[] = KEYS.flatMap((key) =>
  formsOf(en[key]).map((text) => ({ key, text })),
);
const ALL_VALUES: readonly Value[] = [...AR_VALUES, ...EN_VALUES];

/** Every nominative form `nouns.ts` writes after a number, and the «ـًا / ـاً» spellings. */
const ARABIC_COUNTED_NOUN = String.raw`(?:أقسام|قسمًا|قسماً|قسمان|قسم|دقائق|دقيقةً|دقيقتان|دقيقة|عناصر|عنصرًا|عنصراً|عنصران|عنصر)`;

/**
 * A count written next to a counted Arabic noun: a JSX or template expression
 * (`{row.total}`, `{n + 1}`, `{formatNumber(locale, n)}`, `${n}`) or a digit, then spaces
 * or a no-break space (`\s` covers U+00A0 and U+202F; `&nbsp;`, `&#160;`, `&#xa0;` and the
 * narrow `&#8239;` are their JSX and HTML spellings); or a string concatenated onto a count
 * (`String(n) + " أقسام"`). `nouns.ts` is the one place that may.
 */
const LITERAL_COUNTED = new RegExp(
  String.raw`(?:(?:\{[^{}\n]+\}|\$\{[^}]+\}|\d)(?:\s|&(?:nbsp|#160|#x0*a0|#8239|#x202f);)*|\+\s*['"\x60]\s*)` +
    ARABIC_COUNTED_NOUN,
  'iu',
);

/** A line that is only a comment: prose about the copy, which never reaches a screen. */
function isCommentLine(line: string): boolean {
  return /^\s*(?:\/\/|\/\*|\*)/u.test(line);
}

function offenders(values: readonly Value[], test: (text: string) => boolean): readonly string[] {
  return values.filter(({ text }) => test(text)).map(({ key, text }) => `${key}: ${text}`);
}

/** The template without its slots: what the length budget measures ("before interpolation"). */
function withoutSlots(text: string): string {
  return text.replace(/\{[A-Za-z]+\}/gu, '');
}

/** User-perceived characters: a shadda or tanween does not widen a line. */
function graphemes(text: string, locale: string): number {
  return [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)].length;
}

/** Arabic words, split on anything that is not an Arabic letter or mark. */
function arabicWords(text: string): readonly string[] {
  return text.split(/[^؀-ۿ]+/u).filter(Boolean);
}

/* ── Punctuation ─────────────────────────────────────────────────────────── */

describe('punctuation', () => {
  it('never joins facts with a middle dot', () => {
    expect(offenders(ALL_VALUES, (text) => text.includes('·'))).toEqual([]);
  });

  it('never uses a spaced em or en dash', () => {
    expect(offenders(ALL_VALUES, (text) => / [—–] /u.test(text))).toEqual([]);
  });

  it('never draws an arrow in text: arrows are icons, mirrored in RTL (SPEC §4.21)', () => {
    expect(offenders(ALL_VALUES, (text) => /[→←↗↘➜➔]/u.test(text))).toEqual([]);
  });

  it('uses the ellipsis character, only at the end of an in-progress line (SPEC §4.0)', () => {
    expect(offenders(ALL_VALUES, (text) => text.includes('...'))).toEqual([]);
    expect(offenders(ALL_VALUES, (text) => text.slice(0, -1).includes('…'))).toEqual([]);
    const inProgress = (key: Key): boolean =>
      (STATUS_KEYS as readonly Key[]).includes(key) ||
      key.startsWith('placeholder.') ||
      key === 'build.live.skeleton' ||
      // The telemetry's planning stage, beside the edit.* stage lines (RunTelemetry STAGE_KEY).
      key === 'telemetry.planning' ||
      key === 'stage.overture';
    expect(
      offenders(ALL_VALUES, (text) => text.endsWith('…')).filter(
        (line) => !inProgress(line.split(':')[0] as Key),
      ),
    ).toEqual([]);
  });

  it('writes Arabic punctuation in Arabic: «،» «؟» «؛» and «» quotes', () => {
    expect(offenders(AR_VALUES, (text) => /[,?;"“”]/u.test(text))).toEqual([]);
  });

  it('writes English quotes as “ ”, never «» or straight double quotes', () => {
    expect(offenders(EN_VALUES, (text) => /[«»"]/u.test(text))).toEqual([]);
  });

  it('keeps every quote pair balanced', () => {
    const unbalanced = (open: string, close: string) => (text: string) =>
      text.split(open).length !== text.split(close).length;
    expect(offenders(AR_VALUES, unbalanced('«', '»'))).toEqual([]);
    expect(offenders(EN_VALUES, unbalanced('“', '”'))).toEqual([]);
  });

  it('quotes every page word interpolated into Arabic (SPEC §4.0 "Quotes follow the locale")', () => {
    const PAGE_WORDS = /\{(title|target|sample|section|value|before|after)\}/gu;
    expect(
      offenders(AR_VALUES, (text) =>
        [...text.matchAll(PAGE_WORDS)].some(
          (match) => text[match.index - 1] !== '«' || text[match.index + match[0].length] !== '»',
        ),
      ),
    ).toEqual([]);
  });

  it('has no stray whitespace', () => {
    expect(offenders(ALL_VALUES, (text) => text !== text.trim() || text.includes('  '))).toEqual(
      [],
    );
  });
});

/* ── Digits and counts ───────────────────────────────────────────────────── */

describe('digits and counted nouns', () => {
  it('never writes an Arabic-Indic digit', () => {
    expect(offenders(ALL_VALUES, (text) => /[٠-٩۰-۹]/u.test(text))).toEqual([]);
  });

  it('never writes "(s)" plurals in English (SPEC §4.0)', () => {
    expect(offenders(EN_VALUES, (text) => text.includes('(s)'))).toEqual([]);
  });

  it('routes every counted section, minute or block through nouns.ts, in both catalogs', () => {
    // English is held to the count slot `{n}`: "{done} of {total} sections" is partitive,
    // plural for any total, and a plan always holds at least two sections (SPEC §4.11).
    const ENGLISH_COUNTED = /\{n\}\s*(?:sections?|minutes?|blocks?)\b/u;
    expect(offenders(AR_VALUES, (text) => LITERAL_COUNTED.test(text))).toEqual([]);
    expect(offenders(EN_VALUES, (text) => ENGLISH_COUNTED.test(text))).toEqual([]);
  });

  it('catches every way a component could write «{n} أقسام» (the scan tests itself)', () => {
    // How wave-2 .tsx would reintroduce the v1 bug; each must fire, or the scan below
    // passes on code it cannot see.
    const WRITTEN_BY_HAND = [
      '<span>{row.total} أقسام</span>',
      '{n + 1} أقسام',
      '{formatNumber(locale, n)} قسمًا',
      'String(n) + " أقسام"',
      "count + ' دقائق'",
      '{count}&nbsp;أقسام',
      '{count}&#160;أقسام',
      '{count}&#xA0;قسمًا',
      '{n}&#8239;دقائق',
      '<span>{sections.length}{"\u00a0"}أقسام</span>',
      '{count} أقسام',
      "{n}{' '}أقسام",
      '`${n} عناصر`',
      "'11 قسماً'",
    ];
    expect(WRITTEN_BY_HAND.filter((line) => !LITERAL_COUNTED.test(line))).toEqual([]);
    // And the ways the catalog is allowed to count stay quiet.
    const ALLOWED = [
      "'حذف الأقسام الفارغة ({n})'",
      "'{sections} قيد الكتابة'",
      "'لا أقسام'",
      "countNoun(locale, 'section', n)",
      "t(locale, 'build.caption.done', { n: row.total })",
      "'تتسع الخطة لاثني عشر قسمًا كحدّ أقصى'",
    ];
    expect(ALLOWED.filter((line) => LITERAL_COUNTED.test(line))).toEqual([]);
  });

  it('keeps literal counted Arabic nouns out of every source file but nouns.ts', () => {
    // Resolved from the vitest root: under jsdom `import.meta.url` is not a file: URL.
    const root = join(process.cwd(), 'src', 'features', 'agent');
    const walk = (dir: string): readonly string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    // Tests are left out: they assert the rendered output, «3 أقسام» included.
    const sources = walk(root).filter(
      (path) =>
        /\.(ts|tsx|mdx)$/u.test(path) &&
        !/\.test\.tsx?$/u.test(path) &&
        !path.endsWith(join('copy', 'nouns.ts')),
    );
    expect(sources.length).toBeGreaterThan(5);
    const found = sources.flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          !isCommentLine(line) && LITERAL_COUNTED.test(line)
            ? [`${relative(root, path)}:${String(index + 1)}: ${line.trim()}`]
            : [],
        ),
    );
    // A doc page that needs an example renders it: {t('ar', 'build.writing', { n: 3 })}.
    expect(found).toEqual([]);
  });
});

/* ── Register and voice ──────────────────────────────────────────────────── */

describe('register (SPEC §4.0)', () => {
  it('never uses the retired imperatives «صِف», «جرّب», «أرِني» or the masculine «قول»', () => {
    const RETIRED = new Set(['صِف', 'صف', 'جرّب', 'جرب', 'أرِني', 'أرني', 'قول']);
    expect(offenders(AR_VALUES, (text) => arabicWords(text).some((w) => RETIRED.has(w)))).toEqual(
      [],
    );
  });

  it('keeps the Levantine character voice to the empty-state greeting and its variants', () => {
    const DIALECT = new Set(['احكيلي', 'شو', 'بدك', 'ببنيلك', 'ورا']);
    const CHARACTER: readonly Key[] = ['empty.greeting', 'empty.hasContent', 'empty.selection'];
    expect(
      offenders(AR_VALUES, (text) => arabicWords(text).some((w) => DIALECT.has(w))).filter(
        (line) => !CHARACTER.some((key) => line.startsWith(`${key}:`)),
      ),
    ).toEqual([]);
  });

  it('never glues a Latin prefix onto Arabic text (the old "AI: …" bug)', () => {
    expect(offenders(AR_VALUES, (text) => /^[A-Za-z][A-Za-z ]*:/u.test(text))).toEqual([]);
  });

  it('never shouts: no ALL-CAPS English labels', () => {
    expect(offenders(EN_VALUES, (text) => /\b[A-Z]{3,}\b/u.test(text))).toEqual([]);
  });
});

/* ── Length budget (SPEC §4.3) ───────────────────────────────────────────── */

describe('visible status length budget', () => {
  it('fits the RunBar at 288px: at most 20 Arabic or 24 Latin characters before interpolation', () => {
    const over = STATUS_KEYS.flatMap((key) => [
      ...formsOf(ar[key])
        .filter((text) => graphemes(withoutSlots(text), 'ar') > 20)
        .map((text) => `ar ${key}: ${text}`),
      ...formsOf(en[key])
        .filter((text) => graphemes(withoutSlots(text), 'en') > 24)
        .map((text) => `en ${key}: ${text}`),
    ]);
    expect(over).toEqual([]);
  });
});
