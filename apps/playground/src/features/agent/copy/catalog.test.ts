/**
 * The catalog's contract (SPEC §4.0, WP-04): one key union, two authored catalogs that
 * cannot drift apart, plural-aware keys that are grammatical in every Arabic category,
 * and the typed doors (status, announcements, row states, …) wave 2 codes against.
 *
 * Half of this file is enforced by `tsc`, not vitest: every `expectTypeOf` fails
 * `pnpm --filter @craftkit/playground typecheck` if a view-types union gains a member the
 * catalog cannot render.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  AnnouncementKey,
  AssistantMode,
  BuildPhase,
  BuildStopReason,
  ChangeLineView,
  EmptyStateView,
  EndNoteKey,
  ErrorClass,
  ErrorPageState,
  FailureClass,
  Locale,
  ModelTier,
  RowState,
  StatusKey,
  SwatchRole,
} from '../model/view-types';
import { IMPACT_KEYS, IMPACT_WORD_KEYS, type ImpactKey, type ImpactWordKey } from '../model/impact';
import { starterSuggestions } from '../model/suggestions';

import { ar } from './ar';
import { en } from './en';
import {
  ACTION_KEYS,
  ANNOUNCEMENT_KEYS,
  announceKey,
  buildTitleKey,
  entryForms,
  ERROR_CAUSE_KEY,
  ERROR_PAGE_KEY,
  isPluralEntry,
  JUMP_LABEL_KEY,
  KEYS,
  MENU_ITEM_KEY,
  PLAN_PROBLEM_KEY,
  QUEUE_CAPTION_KEY,
  STARTER_KEYS,
  STATUS_KEYS,
  UNDO_UNAVAILABLE_KEY,
  type ArEntry,
  type EnEntry,
  type Key,
} from './keys';
import { countNoun, isNounSlot } from './nouns';

import { formatRemaining, plural, t, tAnnounce, tList, tParts } from './index';

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];

/** SPEC §8 WP-04: every count key is rendered at these counts, in both locales. */
const COUNTS = [0, 1, 2, 3, 11, 100, 103] as const;

/** Arabic-Indic (U+0660–0669) and Extended Arabic-Indic (U+06F0–06F9) digits. */
const NON_LATIN_DIGIT = /[٠-٩۰-۹]/u;

/** One value for every slot the catalog uses; counts are overridden per sweep. */
const FIXTURE = {
  n: 3,
  done: 2,
  total: 8,
  i: 3,
  kept: 2,
  r: 4.5,
  title: 'Hero',
  target: 'Hero',
  label: 'Hero',
  state: 'Writing',
  sample: '25 JD',
  section: 'Pricing',
  mood: 'Calm, clinical, teal',
  colors: '#FBFBFD',
  fonts: 'Reem Kufi / IBM Plex Sans',
  pair: 'Reem Kufi / IBM Plex Sans',
  role: 'Background',
  hex: '#0E1116',
  mode: 'Auto',
  name: 'Fast',
  shortcut: '⌘.',
  before: 'light',
  after: 'deep navy',
  value: 'WhatsApp',
  child: 'Pricing Plan',
  prompt: 'A pricing table with three plans',
  titles: '“Hero” and “FAQ”',
} as const;

/** The slots that carry a count: plural selectors and noun slots read these. */
const COUNT_SLOTS = new Set(['n', 'done', 'total', 'i', 'kept']);

function slotsOf(entry: ArEntry | EnEntry): readonly string[] {
  return entryForms(entry).flatMap((form) =>
    [...form.matchAll(/\{([A-Za-z]+)\}/gu)].map(([, slot = '']) => slot),
  );
}

/** The params a key reads: its slots (noun slots count `n`) and its plural selector. */
function paramsRead(entry: ArEntry | EnEntry): ReadonlySet<string> {
  const read = new Set<string>();
  if (isPluralEntry(entry)) read.add(entry.by ?? 'n');
  for (const slot of slotsOf(entry)) read.add(isNounSlot(slot) ? 'n' : slot);
  return read;
}

const COUNT_KEYS: readonly Key[] = KEYS.filter((key) =>
  [...paramsRead(en[key]), ...paramsRead(ar[key])].some((name) => COUNT_SLOTS.has(name)),
);

/** Keys that put a counted noun (`{sections}`, `{minutes}`, `{blocks}`) in a sentence. */
const NOUN_KEYS: readonly Key[] = KEYS.filter((key) =>
  [...slotsOf(ar[key]), ...slotsOf(en[key])].some(isNounSlot),
);

function paramsAt(count: number): Readonly<Record<string, string | number>> {
  return { ...FIXTURE, n: count, done: count, kept: count, i: count, total: Math.max(count, 8) };
}

/* ── Parity ──────────────────────────────────────────────────────────────── */

describe('key parity', () => {
  it('lists every key once', () => {
    expect(new Set(KEYS).size).toBe(KEYS.length);
  });

  it('authors every key in both locales, and nothing else', () => {
    const sorted = [...KEYS].sort();
    expect(Object.keys(en).sort()).toEqual(sorted);
    expect(Object.keys(ar).sort()).toEqual(sorted);
    // The same fact at compile time: a key missing from either catalog is a type error.
    expectTypeOf<keyof typeof en>().toEqualTypeOf<Key>();
    expectTypeOf<keyof typeof ar>().toEqualTypeOf<Key>();
  });

  it('reads the same params in both locales, so a caller cannot satisfy only one', () => {
    const drifted = KEYS.filter((key) => {
      const a = [...paramsRead(ar[key])].sort().join(',');
      const e = [...paramsRead(en[key])].sort().join(',');
      return a !== e;
    });
    expect(drifted).toEqual([]);
  });

  it('exposes every form of an entry to the copy rules, never the `by` selector', () => {
    // Every rule in copy-rules.test.ts reads values through this; a form it skipped
    // would be a form no rule checks.
    expect(entryForms(ar['footer.removeEmpty'])).toHaveLength(6);
    expect(entryForms(en['announce.build.progress'])).toEqual([
      '{done} of {total} sections is on the page',
      '{done} of {total} sections are on the page',
    ]);
    expect(entryForms(ar.send)).toEqual(['إرسال']);
  });

  it('selects a plural form by the same param in both locales', () => {
    for (const key of KEYS) {
      // Widened to the entry types: the catalogs' literal types omit `by` where unused.
      const a: ArEntry = ar[key];
      const e: EnEntry = en[key];
      if (isPluralEntry(a) && isPluralEntry(e)) expect(a.by ?? 'n', key).toBe(e.by ?? 'n');
    }
  });
});

/* ── The typed doors wave 2 codes against ───────────────────────────────── */

describe('view-types unions are catalog keys', () => {
  it('makes every visible status key (SPEC §4.3) a catalog key', () => {
    expectTypeOf<StatusKey>().toExtend<Key>();
    // The runtime list is exhaustive: a StatusKey added to view-types fails here first.
    expectTypeOf<(typeof STATUS_KEYS)[number]>().toEqualTypeOf<StatusKey>();
    for (const key of STATUS_KEYS) expect(KEYS).toContain(key);
  });

  it('gives every announcement its own `announce.*` key, apart from the visible line', () => {
    expectTypeOf<`announce.${AnnouncementKey}`>().toExtend<Key>();
    expectTypeOf<(typeof ANNOUNCEMENT_KEYS)[number]>().toEqualTypeOf<AnnouncementKey>();
    for (const key of ANNOUNCEMENT_KEYS) expect(KEYS).toContain(announceKey(key));
    // §4.3 and §4.9 both define `edit.noChange`; the namespace keeps them apart.
    expect(t('en', 'edit.noChange')).toBe('It already matched what you asked for.');
    expect(tAnnounce('en', 'edit.noChange', { target: 'Hero' })).toBe('Nothing changed in Hero');
  });

  it('authors no announcement the model cannot emit', () => {
    // The other direction: `announce.*` copy with no `AnnouncementKey` behind it is a
    // sentence nobody can speak, and it drifts unreviewed.
    const authored = KEYS.filter((key) => key.startsWith('announce.')).sort();
    expect(authored).toEqual(ANNOUNCEMENT_KEYS.map(announceKey).sort());
  });

  it('renders every impact part `describeImpact` emits (SPEC §7.4, WP-08 model/impact.ts)', () => {
    expectTypeOf<ImpactKey>().toExtend<Key>();
    for (const key of IMPACT_KEYS) expect(KEYS).toContain(key);
  });

  it('holds every word `impactLines` names things with, so a host builds its naming from t()', () => {
    expectTypeOf<ImpactWordKey>().toExtend<Key>();
    for (const key of IMPACT_WORD_KEYS) expect(KEYS).toContain(key);
    // Definite labels, as `role.*` are, and the antonym of «مفعّل» («متوقف» says "stopped").
    expect(IMPACT_WORD_KEYS.map((key) => ar[key])).toEqual([
      'القسم',
      'العنوان',
      'الرابط',
      'الزر',
      'عنصر القائمة',
      'الاقتباس',
      'التعليق',
      'التسمية',
      'رأس الجدول',
      'خلية الجدول',
      'النص',
      'اتجاه الصفحة',
      'سطح الصفحة',
      'من اليسار إلى اليمين',
      'من اليمين إلى اليسار',
      'مفعّل',
      'معطّل',
    ]);
    // The surface label and the impact sentence name one thing the same way.
    expect(t('ar', 'impact.surface')).toContain(ar['change.label.pageSurface']);
  });

  it('gives every ChangeLines kind its visible word and its spoken sentence', () => {
    type Kind = ChangeLineView['kind'];
    expectTypeOf<`change.${Kind}.aria`>().toExtend<Key>();
    expectTypeOf<`change.${Exclude<Kind, 'changed' | 'added' | 'removed'>}`>().toExtend<Key>();
    expect(t('ar', 'change.restyled.aria', { label: 'القسم', value: 'الأسعار' })).toBe(
      'القسم: تغيّر مظهر «الأسعار»',
    );
    expect(t('en', 'change.moved.aria', { label: 'Section', value: 'Pricing' })).toBe(
      'Section: moved “Pricing”',
    );
  });

  it('renders every union a component interpolates into a key name', () => {
    expectTypeOf<`row.${RowState}`>().toExtend<Key>();
    expectTypeOf<`reason.${FailureClass}`>().toExtend<Key>();
    expectTypeOf<`end.${EndNoteKey}`>().toExtend<Key>();
    expectTypeOf<`role.${SwatchRole}`>().toExtend<Key>();
    expectTypeOf<`mode.${AssistantMode}`>().toExtend<Key>();
    expectTypeOf<`mode.${AssistantMode}.desc`>().toExtend<Key>();
    expectTypeOf<`placeholder.${AssistantMode}`>().toExtend<Key>();
    expectTypeOf<`model.${ModelTier}`>().toExtend<Key>();
    expectTypeOf<`model.${ModelTier}.trait`>().toExtend<Key>();
    expectTypeOf<`error.${ErrorClass}.title`>().toExtend<Key>();
    expectTypeOf<`empty.${EmptyStateView['kind']}`>().toExtend<Key>();
  });

  it('maps every closed union with its own copy to an existing key', () => {
    const tables = [
      MENU_ITEM_KEY,
      QUEUE_CAPTION_KEY,
      PLAN_PROBLEM_KEY,
      UNDO_UNAVAILABLE_KEY,
      JUMP_LABEL_KEY,
    ] as const;
    for (const table of tables) for (const key of Object.values(table)) expect(KEYS).toContain(key);
    for (const key of Object.values(ERROR_CAUSE_KEY)) if (key !== null) expect(KEYS).toContain(key);
    expectTypeOf<keyof typeof ERROR_PAGE_KEY>().toEqualTypeOf<ErrorPageState['kind']>();
    for (const key of Object.values(ERROR_PAGE_KEY)) expect(KEYS).toContain(key);
    // §4.14: "unknown" has no cause line; every other class has one.
    expect(ERROR_CAUSE_KEY.unknown).toBeNull();
    expect(Object.values(ERROR_CAUSE_KEY).filter((key) => key === null)).toHaveLength(1);
  });

  it('titles a build by its phase and, once stopped, by why (SPEC §4.8 phase table)', () => {
    const table: readonly (readonly [BuildPhase, BuildStopReason | undefined, Key])[] = [
      ['skeleton', undefined, 'build.title.skeleton'],
      ['building', undefined, 'build.title.running'],
      ['stopping', undefined, 'build.title.running'],
      ['done', undefined, 'build.title.done'],
      ['partial', undefined, 'build.title.partial'],
      ['stopped', 'signal', 'build.title.stopped'],
      ['stopped', undefined, 'build.title.stopped'],
      ['stopped', 'budget', 'build.title.budget'],
      ['stopped', 'maxTasks', 'build.title.maxTasks'],
      ['interrupted', undefined, 'build.title.interrupted'],
      ['failed', undefined, 'build.title.failed'],
      ['undone', undefined, 'build.title.undone'],
    ];
    for (const [phase, reason, key] of table) expect(buildTitleKey(phase, reason)).toBe(key);
  });
});

/* ── Rendering ───────────────────────────────────────────────────────────── */

describe('t', () => {
  it('renders every key in both locales with no slot left unfilled', () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) {
        const text = t(locale, key, FIXTURE);
        expect(text, `${locale} ${key}`).not.toMatch(/[{}]/u);
        expect(text.trim(), `${locale} ${key}`).not.toBe('');
      }
    }
  });

  it('renders the SPEC copy exactly', () => {
    expect(t('ar', 'build.blocked', { title: 'الواجهة' })).toBe('بانتظار «الواجهة»…');
    expect(t('en', 'build.blocked', { title: 'Hero' })).toBe('Waiting on Hero…');
    expect(
      t('ar', 'row.aria', { i: 3, n: 8, title: 'الخدمات', state: t('ar', 'row.writing') }),
    ).toBe('القسم 3 من 8: «الخدمات»، قيد الكتابة');
    expect(t('en', 'facts.item', { sample: '25 JD', section: 'Pricing' })).toBe(
      '“25 JD” in Pricing',
    );
    expect(t('ar', 'stop.tooltip', { shortcut: 'Ctrl+.' })).toBe('إيقاف العمل (Ctrl+.)');
  });

  it('formats numbers with Latin digits, grouped, in both locales', () => {
    expect(t('ar', 'build.showSections', { n: 1234 })).toBe('عرض الأقسام (1,234)');
    expect(t('en', 'swatch.ok', { r: 4.567 })).toBe('Readable on the background (contrast 4.57)');
  });

  it('refuses a missing param in development instead of rendering a raw slot', () => {
    expect(() => t('en', 'build.blocked')).toThrow(/title/u);
    expect(() => t('ar', 'build.caption.done', { title: 'x' })).toThrow(/n/u);
    expect(() => t('ar', 'footer.removeEmpty', { n: 'three' })).toThrow(/n/u);
  });

  it('marks every interpolated value, so a component can wrap it in <bdi>', () => {
    expect(tParts('ar', 'build.landed', { title: 'Hero' })).toEqual([
      { kind: 'text', text: 'أصبح «' },
      { kind: 'value', slot: 'title', text: 'Hero' },
      { kind: 'text', text: '» على الصفحة' },
    ]);
    expect(tParts('en', 'build.caption.done', { n: 8 })).toEqual([
      { kind: 'value', slot: 'sections', text: '8 sections' },
      { kind: 'text', text: ' on the page' },
    ]);
  });

  it('speaks announcements from their own namespace (SPEC §4.3)', () => {
    expect(tAnnounce('ar', 'build.progress', { done: 4, total: 8 })).toBe('على الصفحة الآن 4 من 8');
    expect(tAnnounce('ar', 'stopping')).toBe('جارٍ الإيقاف');
    expect(t('ar', 'stopping')).toBe('جارٍ الإيقاف…');
  });

  it('picks a plural form by CLDR category, falling back to other', () => {
    const forms = { one: 'one', two: 'two', other: 'other' } as const;
    expect(plural('ar', 2, forms)).toBe('two');
    expect(plural('ar', 11, forms)).toBe('other');
    expect(plural('en', 2, forms)).toBe('other');
    expect(plural('en', 1, forms)).toBe('one');
  });

  it('says an authored `zero` form for exactly 0 in English too (CLDR en has no zero)', () => {
    const forms = { zero: 'none', one: 'one', other: 'other' } as const;
    expect(plural('en', 0, forms)).toBe('none');
    expect(plural('en', 0, { one: 'one', other: 'other' })).toBe('other');
    expect(plural('ar', 0, forms)).toBe('none');
    expect(t('en', 'build.caption.stopped', { n: 0 })).toBe('Every section was written');
    expect(t('en', 'build.caption.stopped', { n: 2 })).toBe("2 sections weren't written");
  });

  it('joins catalog phrases the way the locale joins a list, as one sentence-case line', () => {
    expect(
      tList('ar', [
        { key: 'impact.added', params: { n: 2 } },
        { key: 'impact.changed', params: { n: 1 } },
        { key: 'impact.dir' },
      ]),
    ).toBe('أُضيف عنصران وعُدِّل عنصر واحد وتغيّر اتجاه الصفحة');
    expect(
      tList('en', [{ key: 'impact.added', params: { n: 3 } }, { key: 'impact.surface' }]),
    ).toBe('3 blocks added and the page surface changed');
    // A phrase written to follow another still opens the line with a capital.
    expect(tList('en', [{ key: 'impact.dir' }])).toBe('The page direction changed');
    expect(tList('en', [{ key: 'impact.none' }])).toBe('Changes nothing on the page');
    expect(tList('ar', [{ key: 'impact.none' }])).toBe('لا يغيّر شيئًا على الصفحة');
    expect(tList('en', [])).toBe('');
  });

  it('keeps each visible label at the start of its accessible name (WCAG 2.5.3)', () => {
    // A speech-input user says what they see: "click Retry" must reach the row's Retry.
    const PAIRS = [
      ['row.undo', 'row.undo.aria'],
      ['row.redo', 'row.redo.aria'],
      ['row.retry', 'row.retry.aria'],
      ['stop', 'stop.tooltip'],
    ] as const satisfies readonly (readonly [Key, Key])[];
    for (const locale of LOCALES) {
      for (const [label, name] of PAIRS) {
        expect(t(locale, name, FIXTURE), `${locale} ${name}`).toMatch(
          new RegExp(`^${t(locale, label)}`, 'u'),
        );
      }
    }
    expect(t('ar', 'row.retry.aria', { title: 'الخدمات' })).toBe('إعادة المحاولة: «الخدمات»');
    expect(t('en', 'row.retry.aria', { title: 'Services' })).toBe('Retry Services');
    expect(t('ar', 'row.undo.aria', { title: 'الخدمات' })).toBe('تراجع عن «الخدمات»');
  });

  it('says a failed search matches nothing, not that a name was looked up (§4.18)', () => {
    // A conversation has no name: its row is titled by the first request, and search
    // matches the text.
    expect(t('ar', 'history.noMatch')).toBe('لا محادثات مطابقة');
    expect(t('en', 'history.noMatch')).toBe('No matching conversations');
  });
});

/* ── Counts ──────────────────────────────────────────────────────────────── */

describe('counted nouns (SPEC §4.0 six-form table)', () => {
  it('writes the section noun in its nominative form for every Arabic category', () => {
    expect(COUNTS.map((n) => countNoun('ar', 'section', n))).toEqual([
      'لا أقسام',
      'قسم واحد',
      'قسمان',
      '3 أقسام',
      '11 قسمًا',
      '100 قسم',
      '103 أقسام',
    ]);
    // Category edges: 10 is few, 99 many, 101 and 102 other, 111 many.
    expect([10, 99, 101, 102, 111].map((n) => countNoun('ar', 'section', n))).toEqual([
      '10 أقسام',
      '99 قسمًا',
      '101 قسم',
      '102 قسم',
      '111 قسمًا',
    ]);
  });

  it('writes the minute noun the same way', () => {
    expect([1, 2, 3, 11, 100, 103].map((n) => countNoun('ar', 'minute', n))).toEqual([
      'دقيقة واحدة',
      'دقيقتان',
      '3 دقائق',
      '11 دقيقةً',
      '100 دقيقة',
      '103 دقائق',
    ]);
  });

  it('writes the block noun the same way («عنصر», what impact counts)', () => {
    expect(COUNTS.map((n) => countNoun('ar', 'block', n))).toEqual([
      'لا عناصر',
      'عنصر واحد',
      'عنصران',
      '3 عناصر',
      '11 عنصرًا',
      '100 عنصر',
      '103 عناصر',
    ]);
    expect([1, 2].map((n) => countNoun('en', 'block', n))).toEqual(['1 block', '2 blocks']);
  });

  it('never writes "section(s)" in English', () => {
    expect(COUNTS.map((n) => countNoun('en', 'section', n))).toEqual([
      '0 sections',
      '1 section',
      '2 sections',
      '3 sections',
      '11 sections',
      '100 sections',
      '103 sections',
    ]);
  });
});

describe('zero, in every sentence that counts a noun', () => {
  /*
    «لا أقسام» is the zero noun only where the sentence can open with it or it stands
    alone after a colon («لا أقسام على الصفحة», «بُنيت الصفحة: لا أقسام»). After a
    verb or a preposition it is ungrammatical («لم يُكتب لا أقسام», «على الصفحة لا
    أقسام»), so those keys author a zero sentence of their own. The table is exhaustive:
    a new key with a noun slot fails here until its zero is read and written down.
  */
  const ZERO: Readonly<Record<string, readonly [ar: string, en: string]>> = {
    'build.planned': ['لا أقسام قيد الكتابة', 'Writing 0 sections'],
    'build.writing': ['لا أقسام قيد الكتابة', 'Writing 0 sections'],
    'announce.build.planned': ['رُسم هيكل الصفحة: لا أقسام', 'Page laid out: 0 sections'],
    'announce.build.done': ['بُنيت الصفحة: لا أقسام', 'Page built: 0 sections'],
    'announce.build.partial': ['انتهى البناء، ولم يتعذّر أي قسم', 'Build ended, no section failed'],
    // Routed at 0 only while the empty layout is on the page (agent-status), so zero names it.
    'announce.stopped': [
      'أُوقف البناء قبل أن يصل أي قسم، والهيكل الفارغ باقٍ على الصفحة.',
      'Stopped before any section landed. The empty layout is still on the page.',
    ],
    'announce.stopped.budget': [
      'توقّف البناء عند حدّه الزمني قبل أن يصل أي قسم، والهيكل الفارغ باقٍ على الصفحة.',
      'The build hit its time limit before any section landed. The empty layout is still on the page.',
    ],
    'build.title.partial': ['انتهى البناء، ولم يتعذّر أي قسم', 'Build ended, no section failed'],
    'build.caption.done': ['لا أقسام على الصفحة', '0 sections on the page'],
    'build.caption.stopped': ['كُتبت الأقسام كلها', 'Every section was written'],
    // Unreachable: formatRemaining says «المتبقي أقل من دقيقة» below a minute.
    'build.remaining.minutes': ['المتبقي تقريبًا: 0 دقيقة', 'About 0 min left'],
    'empty.hasContent': [
      'الصفحة فيها محتوى. احكيلي شو بدك نغيّر.',
      'This page has content. Tell me what to change.',
    ],
    'pill.done': ['بُنيت الصفحة: لا أقسام', 'Page built: 0 sections'],
    'impact.added': ['لم يُضف أي عنصر', 'No blocks added'],
    'impact.changed': ['لم يُعدَّل أي عنصر', 'No blocks changed'],
    'impact.removed': ['لم يُحذف أي عنصر', 'No blocks removed'],
  };

  it('reads every noun key at zero', () => {
    expect(Object.keys(ZERO).sort()).toEqual([...NOUN_KEYS].sort());
  });

  it('is grammatical in both locales', () => {
    for (const key of NOUN_KEYS) {
      const [arabic, english] = ZERO[key] ?? ['', ''];
      expect(t('ar', key, { n: 0 }), key).toBe(arabic);
      expect(t('en', key, { n: 0 }), key).toBe(english);
    }
  });

  it('never puts the zero noun after a verb or a preposition', () => {
    const AFTER_VERB_OR_PREPOSITION = /(?:يُكتب|تعذّر|على الصفحة|فيها|أُضيف|عُدِّل|حُذف) لا /u;
    for (const key of NOUN_KEYS) {
      expect(t('ar', key, { n: 0 }), key).not.toMatch(AFTER_VERB_OR_PREPOSITION);
    }
  });
});

describe('every count key at 0, 1, 2, 3, 11, 100, 103', () => {
  it('finds the count keys to sweep', () => {
    // A guard on the sweep itself: if detection broke, every assertion below would pass on nothing.
    expect(COUNT_KEYS.length).toBeGreaterThan(25);
    expect(COUNT_KEYS).toEqual(expect.arrayContaining(['build.writing', 'footer.removeEmpty']));
  });

  it('renders each in both locales with Latin digits only and no slot left', () => {
    for (const locale of LOCALES) {
      for (const key of COUNT_KEYS) {
        for (const count of COUNTS) {
          const text = t(locale, key, paramsAt(count));
          const where = `${locale} ${key} @${String(count)}`;
          expect(text, where).not.toMatch(NON_LATIN_DIGIT);
          expect(text, where).not.toMatch(/[{}]/u);
        }
      }
    }
  });

  it('agrees in Arabic with the noun in a nominative slot', () => {
    const at = (key: Key): readonly string[] => COUNTS.map((n) => t('ar', key, { n }));
    expect(at('build.caption.done')).toEqual([
      'لا أقسام على الصفحة',
      'قسم واحد على الصفحة',
      'قسمان على الصفحة',
      '3 أقسام على الصفحة',
      '11 قسمًا على الصفحة',
      '100 قسم على الصفحة',
      '103 أقسام على الصفحة',
    ]);
    expect(at('build.writing')).toEqual([
      'لا أقسام قيد الكتابة',
      'قسم واحد قيد الكتابة',
      'قسمان قيد الكتابة',
      '3 أقسام قيد الكتابة',
      '11 قسمًا قيد الكتابة',
      '100 قسم قيد الكتابة',
      '103 أقسام قيد الكتابة',
    ]);
    expect(at('build.caption.stopped')[2]).toBe('لم يُكتب قسمان');
    expect(t('ar', 'empty.hasContent', { n: 11 })).toBe(
      'الصفحة فيها 11 قسمًا. احكيلي شو بدك نغيّر.',
    );
  });

  it('authors the Arabic button forms per category instead of forcing a noun into a case slot', () => {
    const at = (key: Key): readonly string[] => COUNTS.map((n) => t('ar', key, { n }));
    expect(at('footer.removeEmpty')).toEqual([
      'حذف الأقسام الفارغة (0)',
      'حذف القسم الفارغ',
      'حذف القسمين الفارغين',
      'حذف الأقسام الفارغة (3)',
      'حذف الأقسام الفارغة (11)',
      'حذف الأقسام الفارغة (100)',
      'حذف الأقسام الفارغة (103)',
    ]);
    expect(at('footer.retryFailed').slice(1, 4)).toEqual([
      'إعادة كتابة القسم المتعذّر',
      'إعادة كتابة القسمين المتعذّرين',
      'إعادة كتابة الأقسام المتعذّرة (3)',
    ]);
  });

  it('counts impact blocks as the delayed subject of a passive verb (SPEC §7.4)', () => {
    const at = (key: Key): readonly string[] => COUNTS.map((n) => t('ar', key, { n }));
    // The verb stays singular before its subject at every count: «أُضيف 3 عناصر».
    expect(at('impact.added')).toEqual([
      'لم يُضف أي عنصر',
      'أُضيف عنصر واحد',
      'أُضيف عنصران',
      'أُضيف 3 عناصر',
      'أُضيف 11 عنصرًا',
      'أُضيف 100 عنصر',
      'أُضيف 103 عناصر',
    ]);
    expect(at('impact.changed').slice(1, 5)).toEqual([
      'عُدِّل عنصر واحد',
      'عُدِّل عنصران',
      'عُدِّل 3 عناصر',
      'عُدِّل 11 عنصرًا',
    ]);
    expect(at('impact.removed').slice(1, 4)).toEqual([
      'حُذف عنصر واحد',
      'حُذف عنصران',
      'حُذف 3 عناصر',
    ]);
    expect(COUNTS.map((n) => t('en', 'impact.removed', { n })).slice(0, 3)).toEqual([
      'No blocks removed',
      '1 block removed',
      '2 blocks removed',
    ]);
  });

  it('counts minutes left in the nominative after the colon', () => {
    expect([1, 2, 3, 11, 100, 103].map((n) => t('ar', 'build.remaining.minutes', { n }))).toEqual([
      'المتبقي تقريبًا: دقيقة واحدة',
      'المتبقي تقريبًا: دقيقتان',
      'المتبقي تقريبًا: 3 دقائق',
      'المتبقي تقريبًا: 11 دقيقةً',
      'المتبقي تقريبًا: 100 دقيقة',
      'المتبقي تقريبًا: 103 دقائق',
    ]);
  });

  it('agrees in English, verb included', () => {
    const at = (key: Key): readonly string[] => COUNTS.map((n) => t('en', key, { n }));
    expect(at('build.writing').slice(0, 3)).toEqual([
      'Writing 0 sections',
      'Writing 1 section',
      'Writing 2 sections',
    ]);
    expect(at('build.caption.stopped').slice(1, 3)).toEqual([
      "1 section wasn't written",
      "2 sections weren't written",
    ]);
    expect(tAnnounce('en', 'stopped', { n: 1 })).toBe('Stopped. 1 section is on the page.');
    expect(tAnnounce('en', 'stopped', { n: 103 })).toBe('Stopped. 103 sections are on the page.');
    expect(tAnnounce('en', 'build.progress', { done: 1, total: 8 })).toBe(
      '1 of 8 sections is on the page',
    );
    expect(tAnnounce('en', 'build.progress', { done: 4, total: 8 })).toBe(
      '4 of 8 sections are on the page',
    );
    expect(at('footer.removeEmpty').slice(1, 3)).toEqual([
      'Remove the empty section',
      'Remove empty sections (2)',
    ]);
  });
});

describe('formatRemaining (SPEC §4.8 estimate display)', () => {
  it('says "About 2 min left" for the worked example (90s)', () => {
    expect(formatRemaining('en', 90_000)).toBe('About 2 min left');
    expect(formatRemaining('ar', 90_000)).toBe('المتبقي تقريبًا: دقيقتان');
  });

  it('rounds up, and has its own line under a minute', () => {
    expect(formatRemaining('en', 59_999)).toBe('Under a minute left');
    expect(formatRemaining('ar', 30_000)).toBe('المتبقي أقل من دقيقة');
    expect(formatRemaining('en', 60_000)).toBe('About 1 min left');
    expect(formatRemaining('ar', 60_000)).toBe('المتبقي تقريبًا: دقيقة واحدة');
    expect(formatRemaining('en', 60_001)).toBe('About 2 min left');
  });
});

/* ── Masdar actions (SPEC §4.0 registers) ───────────────────────────────── */

describe('action labels', () => {
  it('match the reviewed masdar list (a snapshot a reviewer approves)', () => {
    const labels = Object.fromEntries(ACTION_KEYS.map((key) => [key, ar[key]]));
    expect(labels).toEqual({
      'sheet.close': 'إغلاق',
      'sheet.showPage': 'عرض الصفحة',
      'sheet.backToChat': 'العودة إلى المحادثة',
      'panel.resize': 'تغيير عرض اللوحة',
      'jump.aria': 'الانتقال إلى الأحدث',
      'build.showSections': 'عرض الأقسام ({n})',
      'build.hideSections': 'إخفاء الأقسام',
      'row.undo': 'تراجع',
      'row.undo.aria': 'تراجع عن «{title}»',
      'row.redo': 'إعادة',
      'row.redo.aria': 'إعادة «{title}»',
      'row.retry': 'إعادة المحاولة',
      'row.retry.aria': 'إعادة المحاولة: «{title}»',
      'footer.undoBuild': 'تراجع عن البناء',
      'footer.redoBuild': 'إعادة البناء',
      'footer.finishRest': 'إكمال الباقي ({n})',
      'footer.removeEmpty': {
        zero: 'حذف الأقسام الفارغة ({n})',
        one: 'حذف القسم الفارغ',
        two: 'حذف القسمين الفارغين',
        few: 'حذف الأقسام الفارغة ({n})',
        many: 'حذف الأقسام الفارغة ({n})',
        other: 'حذف الأقسام الفارغة ({n})',
      },
      'footer.retryFailed': {
        zero: 'إعادة كتابة الأقسام المتعذّرة ({n})',
        one: 'إعادة كتابة القسم المتعذّر',
        two: 'إعادة كتابة القسمين المتعذّرين',
        few: 'إعادة كتابة الأقسام المتعذّرة ({n})',
        many: 'إعادة كتابة الأقسام المتعذّرة ({n})',
        other: 'إعادة كتابة الأقسام المتعذّرة ({n})',
      },
      'edit.showAll': 'عرض كل التغييرات ({n})',
      'edit.showOnPage': 'عرض على الصفحة',
      'edit.undo': 'تراجع',
      'edit.redo': 'إعادة',
      'answer.more': 'عرض المزيد',
      'answer.less': 'عرض أقل',
      'plan.row.drag': 'سحب لتغيير الترتيب، أو Alt مع الأسهم',
      'plan.row.rename': 'إعادة التسمية',
      'plan.row.moveUp': 'نقل للأعلى',
      'plan.row.moveDown': 'نقل للأسفل',
      'plan.row.remove': 'حذف القسم',
      'plan.add': 'إضافة قسم',
      'plan.build': 'بناء هذه الصفحة',
      'plan.discard': 'تجاهل الخطة',
      'steps.run': 'تنفيذ الخطة',
      'steps.discard': 'تجاهل',
      'proposal.apply': 'تطبيق',
      'proposal.discard': 'تجاهل',
      'proposal.preview': 'معاينة',
      'proposal.preview.end': 'إنهاء المعاينة',
      'proposal.viewCode': 'عرض ككود',
      'error.removeSkeleton': 'حذف الهيكل الفارغ',
      'error.retry': 'إعادة المحاولة',
      'error.copy': 'نسخ تفاصيل الخطأ',
      'menu.restore': 'إرجاع الصفحة لما قبل هذا الطلب',
      'menu.reuse': 'إعادة استخدام الطلب',
      'menu.copySummary': 'نسخ الملخص',
      'menu.copyAnswer': 'نسخ الإجابة',
      'confirm.undo': 'تراجع',
      'confirm.cancel': 'إلغاء',
      'restore.confirm': 'إرجاع الصفحة',
      'mention.button': 'الإشارة إلى قسم',
      send: 'إرسال',
      queue: 'إضافة كطلب تالٍ',
      stop: 'إيقاف',
      'stop.tooltip': 'إيقاف العمل ({shortcut})',
      'queue.continue': 'متابعة',
      'queue.remove': 'إزالة الطلب التالي',
      'chip.remove': 'إزالة «{label}» من الطلب',
      'history.delete': 'حذف المحادثة',
      'history.confirm.yes': 'حذف',
      'history.confirm.no': 'إلغاء',
      'history.back': 'رجوع',
    });
  });

  it('opens every Arabic action with a verbal noun, never an imperative', () => {
    const MASDAR = new Set([
      'إرجاع',
      'إرسال',
      'إزالة',
      'إضافة',
      'إعادة',
      'إغلاق',
      'إكمال',
      'إلغاء',
      'إنهاء',
      'إيقاف',
      'إخفاء',
      'الإشارة',
      'الانتقال',
      'العودة',
      'بناء',
      'تجاهل',
      'تراجع',
      'تطبيق',
      'تغيير',
      'تنفيذ',
      'حذف',
      'رجوع',
      'سحب',
      'عرض',
      'متابعة',
      'معاينة',
      'نسخ',
      'نقل',
    ]);
    for (const key of ACTION_KEYS) {
      for (const form of entryForms(ar[key])) {
        const first = form.split(' ')[0] ?? '';
        expect(MASDAR.has(first), `${key}: «${form}»`).toBe(true);
      }
    }
  });
});

/* ── Starters (SPEC §4.16): one owner ────────────────────────────────────── */

describe('starters', () => {
  it('live in the catalog alone; model/suggestions.ts only picks which to show', () => {
    // One source of truth: v1 kept the starters twice and nothing read the catalog's copy.
    expect(KEYS.filter((key) => key.startsWith('starter.'))).toEqual([...STARTER_KEYS]);
    for (const locale of LOCALES) {
      expect(
        starterSuggestions(locale, { limit: Number.MAX_SAFE_INTEGER }).map(({ text }) => text),
      ).toEqual(STARTER_KEYS.map((key) => t(locale, key)));
    }
  });

  it("open an empty page with the SPEC's four rows, exactly", () => {
    expect(starterSuggestions('ar').map(({ text }) => text)).toEqual([
      'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب',
      'مقهى مختص في إربد: القائمة والدوام والموقع',
      'متجر عطور صغير يبيع عبر إنستغرام',
      'مكتب محاماة في رام الله: الخدمات والفريق',
    ]);
    expect(starterSuggestions('en').map(({ text }) => text)).toEqual([
      'A dental clinic in Amman with WhatsApp booking',
      'A specialty café: menu, hours and map',
      'A small perfume shop on Instagram',
      'A yoga studio: classes and prices',
    ]);
  });
});
