import { describe, expect, it } from 'vitest';

import {
  emptyRichText,
  richTextDocSchema,
  type RichTextBlockNode,
  type RichTextDoc,
  type RichTextInline,
  type RichTextListItem,
  type RichTextMark,
} from '@craftkit/builder-schema';

import {
  isMarkActive,
  plainTextOf,
  replaceRange,
  richTextLength,
  toggleMark,
  type TextRange,
  type ToggleableMark,
} from './mark-range';

const BOLD: RichTextMark = { type: 'bold' };
const ITALIC: RichTextMark = { type: 'italic' };
const link = (href: string): RichTextMark => ({ type: 'link', attrs: { href } });

const t = (text: string, ...marks: RichTextMark[]): RichTextInline =>
  marks.length === 0 ? { type: 'text', text } : { type: 'text', text, marks };

const BREAK: RichTextInline = { type: 'hardBreak' };

const para = (...content: RichTextInline[]): RichTextBlockNode =>
  content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content };

const heading = (level: 2 | 3 | 4, ...content: RichTextInline[]): RichTextBlockNode => ({
  type: 'heading',
  attrs: { level },
  content,
});

const bullets = (...items: RichTextInline[][]): RichTextBlockNode => ({
  type: 'bulletList',
  content: items.map((content) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content }],
  })),
});

/** A list item the door's way round: an OPENING paragraph, then further blocks. */
const item = (text: string, ...blocks: RichTextBlockNode[]): RichTextListItem => ({
  type: 'listItem',
  content: [{ type: 'paragraph', content: [t(text)] }, ...blocks],
});

const list = (...items: RichTextListItem[]): RichTextBlockNode => ({
  type: 'bulletList',
  content: items,
});

const doc = (first: RichTextBlockNode, ...rest: RichTextBlockNode[]): RichTextDoc => ({
  type: 'doc',
  content: [first, ...rest],
});

/** Every text run in the document, in order — what fragmentation is measured on. */
function runsOf(value: unknown): RichTextInline[] {
  if (Array.isArray(value)) {
    return value.flatMap(runsOf);
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const node = value as { type?: unknown; text?: unknown; content?: unknown };
  return node.type === 'text' && typeof node.text === 'string'
    ? [value as RichTextInline]
    : runsOf(node.content);
}

/** Every object node in a document — what an IDENTITY probe searches. */
function nodesOf(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap(nodesOf);
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return [value, ...nodesOf((value as { content?: unknown }).content)];
}

/** A produced document's blocks — the transforms hand back `unknown` (Law J). */
function blocksOf(value: unknown): unknown[] {
  const content =
    typeof value === 'object' && value !== null ? (value as { content?: unknown }).content : null;
  return Array.isArray(content) ? content : [];
}

/** The marks on the run that carries `needle` — what inheritance is read from. */
function marksOfRunWith(value: unknown, needle: string): RichTextMark[] {
  const run = runsOf(value).find((entry) => 'text' in entry && entry.text.includes(needle));
  return run !== undefined && 'marks' in run ? (run.marks ?? []) : [];
}

/** Deep-freeze: a transform that mutates its input throws here instead of passing. */
function frozen<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      frozen(entry);
    }
    Object.freeze(value);
  }
  return value;
}

/** Shapes that are not documents at all — stored JSON is `unknown` (Law J). */
const MALFORMED: [string, unknown][] = [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'just text'],
  ['a number', 42],
  ['an array', [{ type: 'paragraph' }]],
  ['an empty object', {}],
  ['a doc with no content', { type: 'doc' }],
  ['a doc whose content is not an array', { type: 'doc', content: 'nope' }],
  ['a bare block', { type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
];

/** Shapes that are not RANGES at all — a caller may pass anything here too. */
const UNREADABLE_RANGES: [string, TextRange][] = [
  ['null', null as unknown as TextRange],
  ['undefined', undefined as unknown as TextRange],
  ['a number', 42 as unknown as TextRange],
  ['an array', [] as unknown as TextRange],
];

/**
 * THE shared fixture (009 contract §15): the offset table both `mark-range` and
 * `dom-range` are pinned to, so the two implementations can never drift.
 *
 *     0 a 1 b 2 | 3 c 4 d 5      length 5, text 'ab\ncd'
 */
const SHARED = doc(para(t('ab')), para(t('cd')));

/**
 * THE hard-break parity fixture, mirrored byte-for-byte in `dom-range.test.ts`:
 *
 *     0 a 1 ↵ 2 b 3 | 4 c 5 d 6      text 'a\nb\ncd'
 *             ^ break    ^ block separator
 */
const HARD_BREAK_SHARED = doc(para(t('a'), BREAK, t('b')), para(t('cd')));

describe('the shared offset fixture — doc(para(ab), para(cd))', () => {
  it('indexes the text with ONE separator position between the blocks', () => {
    expect(richTextLength(SHARED)).toBe(5);
    expect(plainTextOf(SHARED)).toBe('ab\ncd');
  });

  it('the END of block 1 and the START of block 2 are DIFFERENT offsets', () => {
    // The ambiguity this model exists to kill: typing at the visible start of a
    // paragraph must not land in the paragraph above it.
    expect(replaceRange(SHARED, { from: 2, to: 2 }, 'X').doc).toEqual(
      doc(para(t('abX')), para(t('cd'))),
    );
    expect(replaceRange(SHARED, { from: 3, to: 3 }, 'X').doc).toEqual(
      doc(para(t('ab')), para(t('Xcd'))),
    );
  });

  it('a delete that SPANS the separator merges the blocks, first type surviving', () => {
    expect(replaceRange(SHARED, { from: 2, to: 3 }, '').doc).toEqual(doc(para(t('abcd'))));
    expect(replaceRange(SHARED, { from: 1, to: 4 }, '').doc).toEqual(doc(para(t('ad'))));
  });

  it('a mark across the separator marks BOTH sides and leaves the blocks alone', () => {
    const marked = toggleMark(SHARED, { from: 1, to: 4 }, 'bold');
    expect(marked).toEqual(doc(para(t('a'), t('b', BOLD)), para(t('c', BOLD), t('d'))));
    expect(plainTextOf(marked)).toBe('ab\ncd');
    expect(blocksOf(marked)).toHaveLength(2);
  });

  it('an EMPTY document has length 0, with offset 0 a real caret position', () => {
    expect(richTextLength(emptyRichText())).toBe(0);
    expect(plainTextOf(emptyRichText())).toBe('');
    expect(replaceRange(emptyRichText(), { from: 0, to: 0 }, 'x').doc).toStrictEqual(
      doc(para(t('x'))),
    );
  });
});

describe('hard-break parity — doc(para(a, hardBreak, b), para(cd))', () => {
  it('counts the break as ONE position and renders it as a newline', () => {
    expect(richTextLength(HARD_BREAK_SHARED)).toBe(6);
    expect(plainTextOf(HARD_BREAK_SHARED)).toBe('a\nb\ncd');
  });

  it('keeps the caret before the break distinct from the caret after it', () => {
    expect(replaceRange(HARD_BREAK_SHARED, { from: 1, to: 1 }, 'X').doc).toEqual(
      doc(para(t('aX'), BREAK, t('b')), para(t('cd'))),
    );
    expect(replaceRange(HARD_BREAK_SHARED, { from: 2, to: 2 }, 'X').doc).toEqual(
      doc(para(t('a'), BREAK, t('Xb')), para(t('cd'))),
    );
  });

  it('Backspace after the break removes the BREAK, never the preceding character', () => {
    const { doc: after, caret } = replaceRange(HARD_BREAK_SHARED, { from: 1, to: 2 }, '');
    expect(after).toEqual(doc(para(t('ab')), para(t('cd'))));
    expect(caret).toBe(1);
  });

  it('a break-only position can never carry or receive a mark', () => {
    const marked = doc(para(t('a', BOLD), BREAK, t('b', BOLD)), para(t('cd')));
    expect(isMarkActive(marked, { from: 1, to: 2 }, 'bold')).toBe(false);
    expect(toggleMark(marked, { from: 1, to: 2 }, 'bold')).toBe(marked);
  });
});

describe('the offset space (009 contract §15)', () => {
  it.each<[string, RichTextDoc, string]>([
    ['a single run', doc(para(t('hello'))), 'hello'],
    ['runs concatenate with NO separator', doc(para(t('he'), t('llo', BOLD))), 'hello'],
    ['blocks are separated by ONE position', doc(para(t('one')), para(t('two'))), 'one\ntwo'],
    ['an empty paragraph is still a caret of its own', doc(para(), para(t('x')), para()), '\nx\n'],
    ['an empty text node occupies nothing', doc(para(t(''), t('x'))), 'x'],
    ['a hard break occupies ONE newline position', doc(para(t('a'), BREAK, t('b'))), 'a\nb'],
    [
      'nested list text shares the space',
      doc(para(t('a')), bullets([t('bc')], [t('d')])),
      'a\nbc\nd',
    ],
    ['a heading is text like any other', doc(heading(2, t('Ti')), para(t('tle'))), 'Ti\ntle'],
  ])('%s', (_name, input, text) => {
    expect(plainTextOf(input)).toBe(text);
    expect(richTextLength(input)).toBe(text.length);
  });

  it.each(MALFORMED)('%s has no offset space', (_name, input) => {
    expect(richTextLength(input)).toBe(0);
    expect(plainTextOf(input)).toBe('');
  });
});

describe('isMarkActive', () => {
  // "Hello brave world", with `brave` italic: offsets 6..11.
  const fixture = doc(para(t('Hello '), t('brave', ITALIC), t(' world')));

  it.each<[string, TextRange, ToggleableMark, boolean]>([
    ['the whole italic run is italic', { from: 6, to: 11 }, 'italic', true],
    ['part of the italic run is still italic', { from: 7, to: 10 }, 'italic', true],
    ['a range reaching past the run is not', { from: 5, to: 12 }, 'italic', false],
    ['the run is not bold', { from: 6, to: 11 }, 'bold', false],
    ['a collapsed range is never active', { from: 6, to: 6 }, 'italic', false],
    ['a reversed range is never active', { from: 11, to: 6 }, 'italic', false],
  ])('%s', (_name, range, mark, expected) => {
    expect(isMarkActive(fixture, range, mark)).toBe(expected);
  });

  it('is true only when EVERY character across the blocks carries the mark', () => {
    const spread = doc(para(t('ab', BOLD)), para(t('cd', BOLD)));
    expect(isMarkActive(spread, { from: 0, to: 5 }, 'bold')).toBe(true);
    expect(isMarkActive(doc(para(t('ab', BOLD)), para(t('cd'))), { from: 0, to: 5 }, 'bold')).toBe(
      false,
    );
  });

  it('a range covering ONLY the separator carries no mark at all', () => {
    const spread = doc(para(t('ab', BOLD)), para(t('cd', BOLD)));
    expect(isMarkActive(spread, { from: 2, to: 3 }, 'bold')).toBe(false);
    expect(toggleMark(spread, { from: 2, to: 3 }, 'bold')).toBe(spread);
  });

  it('an interior ZERO-LENGTH run neither carries nor refutes the mark', () => {
    // F1: the empty run holds no characters, so the range IS fully bold — and
    // the toggle-OFF press that follows must be able to un-bold it.
    const ragged = doc(para(t('ab', BOLD), t(''), t('cd', BOLD)));
    expect(isMarkActive(ragged, { from: 0, to: 4 }, 'bold')).toBe(true);
    expect(toggleMark(ragged, { from: 0, to: 4 }, 'bold')).toEqual(doc(para(t('abcd'))));
  });

  it('an EMPTY BLOCK between two marked ones does not refute the mark either', () => {
    const spread = doc(para(t('a', BOLD)), para(t('')), para(t('b', BOLD)));
    expect(isMarkActive(spread, { from: 0, to: 4 }, 'bold')).toBe(true);
    const toggled = toggleMark(spread, { from: 0, to: 4 }, 'bold');
    expect(toggled).toEqual(doc(para(t('a')), para(t('')), para(t('b'))));
    // The empty block held no character the toggle could change, so it keeps
    // its very IDENTITY — a block the edit did not edit is never rebuilt.
    expect(blocksOf(toggled)[1]).toBe(spread.content[1]);
  });

  it('clamps an overshooting range instead of refusing it', () => {
    expect(isMarkActive(doc(para(t('ab', BOLD))), { from: -9, to: 99 }, 'bold')).toBe(true);
  });

  it('a link is not a bold or italic mark', () => {
    const linked = doc(para(t('site', link('https://example.com'))));
    expect(isMarkActive(linked, { from: 0, to: 4 }, 'bold')).toBe(false);
  });

  it.each(MALFORMED)('%s is never active', (_name, input) => {
    expect(isMarkActive(input, { from: 0, to: 5 }, 'bold')).toBe(false);
  });

  it.each(UNREADABLE_RANGES)('%s as the range is never active', (_name, range) => {
    expect(isMarkActive(doc(para(t('ab', BOLD))), range, 'bold')).toBe(false);
  });
});

describe('toggleMark — splitting (p1)', () => {
  it('splits a run into THREE, and only the middle one carries the mark', () => {
    expect(toggleMark(doc(para(t('foobarbaz'))), { from: 3, to: 6 }, 'bold')).toEqual(
      doc(para(t('foo'), t('bar', BOLD), t('baz'))),
    );
  });

  it('a boundary that already coincides with a run boundary makes no empty runs', () => {
    const marked = toggleMark(doc(para(t('foo'), t('bar', ITALIC))), { from: 3, to: 6 }, 'bold');
    expect(marked).toEqual(doc(para(t('foo'), t('bar', ITALIC, BOLD))));
    expect(runsOf(marked).map((run) => ('text' in run ? run.text : ''))).toEqual(['foo', 'bar']);
  });

  it('a PARTIALLY marked range gains the mark everywhere rather than flipping', () => {
    // Half-bold selection + Bold is "make it all bold" in every editor.
    expect(toggleMark(doc(para(t('ab', BOLD), t('cd'))), { from: 0, to: 4 }, 'bold')).toEqual(
      doc(para(t('abcd', BOLD))),
    );
  });
});

describe('toggleMark — merging (p2)', () => {
  it.each<[string, RichTextDoc, TextRange]>([
    ['one run', doc(para(t('hello world'))), { from: 0, to: 5 }],
    ['the middle of a run', doc(para(t('hello world'))), { from: 3, to: 8 }],
    [
      'across mark boundaries',
      doc(para(t('Hello '), t('brave', ITALIC), t(' world'))),
      {
        from: 0,
        to: 11,
      },
    ],
    ['across two blocks', doc(para(t('one')), para(t('two'))), { from: 1, to: 6 }],
    ['through a list', doc(para(t('a')), bullets([t('bc')], [t('d')])), { from: 0, to: 6 }],
    [
      'a document with a link',
      doc(para(t('see '), t('here', link('https://x.test')))),
      {
        from: 2,
        to: 8,
      },
    ],
  ])('bold ON then OFF over %s returns the document it started from', (_name, input, range) => {
    const there = toggleMark(input, range, 'bold');
    expect(isMarkActive(there, range, 'bold')).toBe(true);
    expect(toggleMark(there, range, 'bold')).toStrictEqual(input);
  });

  it('merges runs that already carried the same marks before the toggle', () => {
    // Fragmented input (two identical runs) is CANONICALISED as it is rewritten.
    const fragmented = doc(para(t('foo'), t('bar')));
    const there = toggleMark(fragmented, { from: 0, to: 6 }, 'bold');
    expect(there).toEqual(doc(para(t('foobar', BOLD))));
    expect(toggleMark(there, { from: 0, to: 6 }, 'bold')).toEqual(doc(para(t('foobar'))));
  });

  it('drops zero-length runs it passes over', () => {
    const marked = toggleMark(doc(para(t(''), t('ab'), t(''))), { from: 0, to: 2 }, 'bold');
    expect(marked).toEqual(doc(para(t('ab', BOLD))));
    expect(runsOf(marked)).toHaveLength(1);
  });
});

describe('toggleMark — marks compose (p3)', () => {
  it('bold over italic yields runs carrying BOTH', () => {
    expect(toggleMark(doc(para(t('word', ITALIC))), { from: 0, to: 4 }, 'bold')).toEqual(
      doc(para(t('word', ITALIC, BOLD))),
    );
  });

  it('un-bolding leaves the italic intact', () => {
    const both = doc(para(t('word', ITALIC, BOLD)));
    expect(toggleMark(both, { from: 0, to: 4 }, 'bold')).toEqual(doc(para(t('word', ITALIC))));
  });

  it('the two marks are independent over the same range', () => {
    const bolded = toggleMark(doc(para(t('word'))), { from: 0, to: 4 }, 'bold');
    const both = toggleMark(bolded, { from: 0, to: 4 }, 'italic');
    expect(isMarkActive(both, { from: 0, to: 4 }, 'bold')).toBe(true);
    expect(isMarkActive(both, { from: 0, to: 4 }, 'italic')).toBe(true);
  });
});

describe('toggleMark — links are never collateral (p4)', () => {
  const href = 'https://example.com/a';

  it('keeps the link mark, attrs and all, through bold on and off', () => {
    const linked = doc(para(t('see '), t('here', link(href))));
    const bolded = toggleMark(linked, { from: 0, to: 8 }, 'bold');
    expect(bolded).toEqual(doc(para(t('see ', BOLD), t('here', link(href), BOLD))));
    expect(toggleMark(bolded, { from: 0, to: 8 }, 'bold')).toStrictEqual(linked);
  });

  it('never merges two links that point somewhere different', () => {
    const two = doc(para(t('ab', link('https://one.test')), t('cd', link('https://two.test'))));
    const bolded = toggleMark(two, { from: 0, to: 4 }, 'bold');
    expect(runsOf(bolded)).toHaveLength(2);
    expect(plainTextOf(bolded)).toBe('abcd');
  });
});

describe('toggleMark — across blocks (p5) and nesting (p6)', () => {
  it('marks the right characters in each paragraph, leaving the structure alone', () => {
    const marked = toggleMark(doc(para(t('one')), para(t('two'))), { from: 1, to: 6 }, 'bold');
    expect(marked).toEqual(doc(para(t('o'), t('ne', BOLD)), para(t('tw', BOLD), t('o'))));
    expect(blocksOf(marked)).toHaveLength(2);
    expect(plainTextOf(marked)).toBe('one\ntwo');
  });

  it('reaches text nested in bulletList > listItem > paragraph by the same offsets', () => {
    const nested = doc(para(t('a')), bullets([t('bcd')]));
    const marked = toggleMark(nested, { from: 3, to: 4 }, 'bold');
    expect(marked).toEqual(doc(para(t('a')), bullets([t('b'), t('c', BOLD), t('d')])));
    expect(plainTextOf(marked)).toBe('a\nbcd');
  });

  it('marks a heading without disturbing its level', () => {
    const marked = toggleMark(doc(heading(3, t('Title'))), { from: 0, to: 5 }, 'italic');
    expect(marked).toEqual(doc(heading(3, t('Title', ITALIC))));
  });
});

describe('toggleMark — clamping and robustness (p7)', () => {
  const fixture = doc(para(t('abcd')));

  it.each(MALFORMED)('%s comes back exactly as it went in', (_name, input) => {
    expect(toggleMark(input, { from: 0, to: 3 }, 'bold')).toBe(input);
  });

  it.each<[string, TextRange]>([
    ['a collapsed range', { from: 2, to: 2 }],
    ['a reversed range', { from: 3, to: 1 }],
    ['a range entirely past the end', { from: 9, to: 12 }],
    ['a non-integer from', { from: 0.5, to: 3 }],
    ['a non-integer to', { from: 0, to: 2.5 }],
    ['NaN', { from: Number.NaN, to: 3 }],
    ['Infinity', { from: 0, to: Number.POSITIVE_INFINITY }],
  ])('%s leaves the document untouched', (_name, range) => {
    expect(toggleMark(fixture, range, 'bold')).toBe(fixture);
  });

  it.each(UNREADABLE_RANGES)('%s as the range is refused, never thrown over', (_name, range) => {
    // A nullish range is a caller bug, not a crash: the document is handed back.
    expect(toggleMark(fixture, range, 'bold')).toBe(fixture);
  });

  it('CLAMPS a range that overshoots on either side', () => {
    expect(toggleMark(fixture, { from: -20, to: 99 }, 'bold')).toEqual(doc(para(t('abcd', BOLD))));
    expect(toggleMark(fixture, { from: 2, to: 99 }, 'bold')).toEqual(
      doc(para(t('ab'), t('cd', BOLD))),
    );
  });

  it('a range overlapping ONLY zero-width containers is a TRUE no-op', () => {
    // 0 a 1 | 2 | 3 b 4 — [1, 3) covers two separators and the empty middle
    // block: no characters, so nothing to toggle, so the very same document
    // comes back — identity, not a rebuilt equal, and no empty run dropped.
    const hollow = doc(para(t('a')), para(), para(t('b')));
    expect(toggleMark(hollow, { from: 1, to: 3 }, 'bold')).toBe(hollow);
    const ragged = doc(para(t('a')), para(t('')), para(t('b')));
    expect(toggleMark(ragged, { from: 1, to: 3 }, 'bold')).toBe(ragged);
  });

  it('survives paragraphs with no content and empty text nodes', () => {
    const ragged = doc(para(), para(t('')), para(t('ab')), para());
    // Four blocks, three separators, two characters.
    expect(richTextLength(ragged)).toBe(5);
    expect(toggleMark(ragged, { from: 2, to: 4 }, 'bold')).toEqual(
      doc(para(), para(t('')), para(t('ab', BOLD)), para()),
    );
  });

  it('reads past marks the door could never have stored', () => {
    const noisy: unknown = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'ab',
              marks: [
                'bold',
                { type: 'link' },
                { type: 'link', attrs: { href: 42 } },
                { type: 'strike' },
                BOLD,
              ],
            },
          ],
        },
      ],
    };
    expect(isMarkActive(noisy, { from: 0, to: 2 }, 'bold')).toBe(true);
    // A rewritten run keeps exactly the marks the door would have taken.
    expect(toggleMark(noisy, { from: 0, to: 2 }, 'italic')).toEqual(
      doc(para(t('ab', BOLD, ITALIC))),
    );
  });

  it('passes over a hard break inside the range instead of marking it', () => {
    const broken = doc(para(t('a', BOLD), BREAK, t('b', BOLD)));
    expect(isMarkActive(broken, { from: 0, to: 3 }, 'bold')).toBe(true);
    expect(toggleMark(broken, { from: 0, to: 3 }, 'bold')).toEqual(
      doc(para(t('a'), BREAK, t('b'))),
    );
  });

  it('walks past junk sitting between blocks', () => {
    const junky: unknown = {
      type: 'doc',
      content: [null, 'stray', { type: 'paragraph', content: [{ type: 'text', text: 'ab' }] }],
    };
    expect(plainTextOf(junky)).toBe('ab');
    expect(toggleMark(junky, { from: 0, to: 2 }, 'bold')).toEqual({
      type: 'doc',
      content: [null, 'stray', { type: 'paragraph', content: [t('ab', BOLD)] }],
    });
  });

  it('a document with blocks but no text is a no-op, not a crash', () => {
    const contentless: unknown = { type: 'doc', content: [] };
    expect(toggleMark(contentless, { from: 0, to: 1 }, 'bold')).toBe(contentless);
    expect(richTextLength(contentless)).toBe(0);
  });
});

describe('the structural ceiling is the write door’s own (p6)', () => {
  /**
   * The door's list shape, `levels` deep: every listItem OPENS with a paragraph
   * and carries the next list after it. At 14 levels the innermost paragraph
   * sits at depth 29 and its text at 30 — RICH_TEXT_MAX_DEPTH exactly, the
   * deepest text a document can store.
   */
  const buriedIn = (levels: number, deepest: unknown[]): unknown => {
    let content: unknown[] = deepest;
    for (let level = 0; level < levels; level += 1) {
      content = [
        { type: 'paragraph' },
        { type: 'bulletList', content: [{ type: 'listItem', content }] },
      ];
    }
    return { type: 'doc', content };
  };

  it('edits text at the DEEPEST storable nesting, and nothing below it', () => {
    // One level deeper than the ceiling: a paragraph the door can never store,
    // so its text is not in the offset space and is left exactly as found.
    const tooDeep = {
      type: 'bulletList',
      content: [{ type: 'paragraph', content: [t('deeper')] }],
    };
    const storable = buriedIn(14, [para(t('deep'))]);
    const hostile = buriedIn(14, [para(t('deep')), tooDeep]);

    expect(richTextDocSchema.safeParse(storable).success).toBe(true);
    expect(richTextDocSchema.safeParse(hostile).success).toBe(false);
    expect(plainTextOf(hostile)).toBe(`${'\n'.repeat(14)}deep`);
    expect(richTextLength(hostile)).toBe(18);

    const marked = toggleMark(hostile, { from: 14, to: 18 }, 'bold');
    expect(isMarkActive(marked, { from: 14, to: 18 }, 'bold')).toBe(true);
    expect(nodesOf(marked)).toContain(tooDeep);

    const { doc: typed, caret } = replaceRange(storable, { from: 18, to: 18 }, 'er');
    expect(plainTextOf(typed)).toBe(`${'\n'.repeat(14)}deeper`);
    expect(caret).toBe(20);
    expect(richTextDocSchema.safeParse(typed).success).toBe(true);
  });
});

describe('replaceRange — inserting (p8)', () => {
  it('inserts at 0, at the end, and in the middle', () => {
    expect(replaceRange(doc(para(t('bc'))), { from: 0, to: 0 }, 'a').doc).toEqual(
      doc(para(t('abc'))),
    );
    expect(replaceRange(doc(para(t('ab'))), { from: 2, to: 2 }, 'c').doc).toEqual(
      doc(para(t('abc'))),
    );
    expect(replaceRange(doc(para(t('ac'))), { from: 1, to: 1 }, 'b').doc).toEqual(
      doc(para(t('abc'))),
    );
  });

  it('reports the caret AFTER the change', () => {
    expect(replaceRange(doc(para(t('ac'))), { from: 1, to: 1 }, 'bbb').caret).toBe(4);
    expect(replaceRange(doc(para(t('abcd'))), { from: 1, to: 3 }, 'X').caret).toBe(2);
    expect(replaceRange(doc(para(t('abcd'))), { from: 1, to: 3 }, '').caret).toBe(1);
  });

  it('fills the canonical EMPTY document with one paragraph of text', () => {
    const { doc: filled, caret } = replaceRange(emptyRichText(), { from: 0, to: 0 }, 'hi');
    expect(filled).toStrictEqual(doc(para(t('hi'))));
    expect(caret).toBe(2);
  });

  it('gives a document with nowhere to put text the paragraph it lacks', () => {
    const contentless: unknown = { type: 'doc', content: [] };
    expect(replaceRange(contentless, { from: 0, to: 0 }, 'hi').doc).toStrictEqual(
      doc(para(t('hi'))),
    );
  });

  it('keeps both sides of a hard break independently addressable for insertion', () => {
    const broken = doc(para(t('a'), BREAK, t('b')));
    expect(replaceRange(broken, { from: 1, to: 1 }, 'X').doc).toEqual(
      doc(para(t('aX'), BREAK, t('b'))),
    );
    expect(replaceRange(broken, { from: 2, to: 2 }, 'X').doc).toEqual(
      doc(para(t('a'), BREAK, t('Xb'))),
    );
  });

  it('types into the EMPTY block a caret sits in, not the one before it', () => {
    const ragged = doc(para(t('ab')), para(), para(t('cd')));
    // 0 a 1 b 2 | 3 | 4 c 5 d 6 — offset 3 is the empty paragraph's only caret.
    expect(replaceRange(ragged, { from: 3, to: 3 }, 'X').doc).toEqual(
      doc(para(t('ab')), para(t('X')), para(t('cd'))),
    );
  });
});

describe('replaceRange — deleting (p8)', () => {
  it('deletes a whole run and MERGES the neighbours it leaves adjacent', () => {
    const { doc: after } = replaceRange(
      doc(para(t('a'), t('BOLD', BOLD), t('b'))),
      { from: 1, to: 5 },
      '',
    );
    expect(after).toEqual(doc(para(t('ab'))));
    expect(runsOf(after)).toHaveLength(1);
  });

  it('deletes across two runs with different marks, keeping what survives', () => {
    expect(replaceRange(doc(para(t('abc'), t('def', BOLD))), { from: 2, to: 4 }, '').doc).toEqual(
      doc(para(t('ab'), t('ef', BOLD))),
    );
  });

  it('MERGES two blocks: the survivor keeps the FIRST block type', () => {
    const { doc: after } = replaceRange(
      doc(heading(2, t('Title')), para(t('body'))),
      { from: 3, to: 8 },
      '',
    );
    expect(after).toEqual(doc(heading(2, t('Titdy'))));
    expect(blocksOf(after)).toHaveLength(1);
  });

  it('joins a paragraph to the one above when only the separator is deleted', () => {
    // Backspace at the visible START of the second block — the whole point of
    // the separator being an addressable offset.
    const { doc: after, caret } = replaceRange(
      doc(para(t('one')), para(t('two'))),
      { from: 3, to: 4 },
      '',
    );
    expect(after).toEqual(doc(para(t('onetwo'))));
    expect(caret).toBe(3);
  });

  it('prunes the list item and list a merge empties out', () => {
    const { doc: after } = replaceRange(
      doc(para(t('ab')), bullets([t('cd')])),
      { from: 1, to: 4 },
      '',
    );
    expect(after).toStrictEqual(doc(para(t('ad'))));
  });

  it('takes a hard break with it when the deletion spans one', () => {
    const { doc: after, caret } = replaceRange(
      doc(para(t('ab'), BREAK, t('cd'))),
      { from: 1, to: 4 },
      '',
    );
    expect(after).toStrictEqual(doc(para(t('ad'))));
    expect(caret).toBe(1);
  });

  it('an emptied document keeps ONE empty paragraph', () => {
    const { doc: after, caret } = replaceRange(doc(para(t('abc'))), { from: 0, to: 3 }, '');
    expect(after).toStrictEqual(emptyRichText());
    expect(caret).toBe(0);
  });

  it('replaces a multi-block selection with the typed text in one block', () => {
    const { doc: after, caret } = replaceRange(
      doc(para(t('one')), para(t('two')), para(t('six'))),
      { from: 2, to: 9 },
      'X',
    );
    expect(after).toEqual(doc(para(t('onXix'))));
    expect(caret).toBe(3);
  });
});

describe('replaceRange — the door takes every document it produces (p11)', () => {
  /** The reviewer's shape: a list item holding a paragraph AND a nested list. */
  const NESTED = doc(para(t('A')), list(item('B', list(item('C')))));

  it.each<[string, RichTextDoc, TextRange]>([
    ['two paragraphs merging', doc(para(t('ab')), para(t('cd'))), { from: 1, to: 4 }],
    [
      'a paragraph merging into a heading',
      doc(heading(2, t('Ti')), para(t('tle'))),
      { from: 1, to: 4 },
    ],
    [
      'a list item merging into the paragraph above',
      doc(para(t('ab')), bullets([t('cd')])),
      { from: 1, to: 4 },
    ],
    [
      'a list item merging into its sibling',
      doc(bullets([t('ab')], [t('cd')])),
      { from: 1, to: 4 },
    ],
    ['a list item that still holds a NESTED list', NESTED, { from: 0, to: 2 }],
    ['a nested item merging into its parent item', NESTED, { from: 3, to: 4 }],
    ['every block at once', doc(para(t('ab')), bullets([t('cd')], [t('ef')])), { from: 0, to: 8 }],
    [
      'a list emptied from its last item',
      doc(para(t('ab')), bullets([t('cd')])),
      { from: 2, to: 5 },
    ],
  ])('%s stays a document the door accepts', (_name, input, range) => {
    // The defect class (F2): an edit whose OUTPUT the write door rejects cannot
    // be saved at all, so every structural case is parsed both ways.
    expect(richTextDocSchema.safeParse(input).success).toBe(true);
    for (const text of ['', 'X']) {
      const { doc: after } = replaceRange(input, range, text);
      expect(richTextDocSchema.safeParse(after).success).toBe(true);
    }
    expect(richTextDocSchema.safeParse(toggleMark(input, range, 'bold')).success).toBe(true);
  });

  it('DISSOLVES a stranded list item, lifting its nested list into its place', () => {
    // The item lost the paragraph the merge took, but still holds its nested
    // list. Handing it a replacement empty paragraph would be a NEW inline
    // container — a phantom '\n' the caller never asked for (D1) — so the
    // nested list is lifted into the item's place instead: same text, same
    // separators, and still a document the door takes.
    const { doc: after } = replaceRange(NESTED, { from: 0, to: 2 }, 'X');
    expect(after).toEqual(doc(para(t('XB')), list(item('C'))));
    expect(plainTextOf(after)).toBe('XB\nC');
    expect(richTextDocSchema.safeParse(after).success).toBe(true);
  });

  it("the reviewer's exact probe: deleting 'A\\n' reads 'B\\nC', never 'B\\n\\nC'", () => {
    const { doc: after, caret } = replaceRange(NESTED, { from: 0, to: 2 }, '');
    expect(plainTextOf(after)).toBe('B\nC');
    expect(richTextLength(after)).toBe(3);
    expect(caret).toBe(0);
    expect(richTextDocSchema.safeParse(after).success).toBe(true);
  });

  it('never repairs an item that was malformed on the way in', () => {
    // This item NEVER opened with a paragraph — the door refuses it as it
    // stands. An edit elsewhere leaves the malformed shape exactly as found
    // rather than repairing it into a document the author never wrote.
    const withItem = (inner: RichTextBlockNode): unknown => ({
      type: 'doc',
      content: [
        para(t('ab')),
        { type: 'bulletList', content: [{ type: 'listItem', content: [inner] }] },
      ],
    });
    const malformed = withItem(list(item('cd')));
    expect(richTextDocSchema.safeParse(malformed).success).toBe(false);
    const { doc: after } = replaceRange(malformed, { from: 3, to: 3 }, 'X');
    expect(after).toEqual(withItem(list(item('Xcd'))));
  });

  it('leaves an item that keeps its own paragraph exactly as it was', () => {
    const { doc: after } = replaceRange(NESTED, { from: 3, to: 4 }, '');
    expect(after).toEqual(doc(para(t('A')), list(item('BC'))));
  });
});

describe('replaceRange — every edit IS the splice it asks for (p12, D1)', () => {
  /**
   * THE SPLICE LAW as a property: for any door-valid document and any range ×
   * text, the SAME output must (a) still be a document the write door accepts
   * AND (b) read as exactly `before.slice(0, from) + text + before.slice(to)`.
   * Property (b) alone catches a phantom block (the D1 defect — a stranded
   * list item "repaired" with an injected paragraph gains a separator);
   * property (a) alone catches a repair the door refuses. Only together do
   * they pin the edit, so both are asserted on every combination.
   */
  const FIXTURES: [string, RichTextDoc][] = [
    ['flat paragraphs', doc(para(t('ab')), para(t('cd')))],
    ['a heading then a paragraph', doc(heading(2, t('Ti')), para(t('tle')))],
    ['a flat list', doc(bullets([t('ab')], [t('cd')]))],
    [
      "a list with a nested list (the reviewer's input)",
      doc(para(t('A')), list(item('B', list(item('C'))))),
    ],
    [
      'an item holding a paragraph AND a nested list, with a sibling item',
      doc(para(t('x')), list(item('a', list(item('b'))), item('c'))),
    ],
    [
      'an item holding a heading after its paragraph',
      doc(para(t('A')), list(item('B', heading(2, t('H'))))),
    ],
    ['an empty paragraph between two blocks', doc(para(t('ab')), para(), para(t('cd')))],
    ['a hard break between two runs', doc(para(t('ab'), BREAK, t('cd')))],
    ['a document ending in a list', doc(para(t('a')), bullets([t('b')]))],
    ['a deeply nested list', doc(para(t('x')), list(item('a', list(item('b', list(item('c')))))))],
  ];

  it.each(FIXTURES)('%s', (_name, input) => {
    expect(richTextDocSchema.safeParse(input).success).toBe(true);
    const before = plainTextOf(input);
    const length = richTextLength(input);
    // EVERY range the document has — inside one block, spanning one separator,
    // spanning several blocks, collapsed, the whole document — crossed with
    // deletion, a one-character replacement, and a longer one.
    for (let from = 0; from <= length; from += 1) {
      for (let to = from; to <= length; to += 1) {
        for (const text of ['', 'X', 'YZ']) {
          const at = `[${String(from)}, ${String(to)}) ${JSON.stringify(text)}`;
          const { doc: after, caret } = replaceRange(input, { from, to }, text);
          expect(plainTextOf(after), at).toBe(before.slice(0, from) + text + before.slice(to));
          expect(richTextDocSchema.safeParse(after).success, at).toBe(true);
          expect(caret, at).toBe(from + text.length);
        }
      }
    }
  });
});

describe('replaceRange — mark inheritance (p9)', () => {
  it.each<[string, RichTextDoc, number, RichTextMark[]]>([
    ['typing at the END of a bold run continues bold', doc(para(t('ab', BOLD))), 2, [BOLD]],
    ['typing at offset 0 of a bold run inherits it', doc(para(t('ab', BOLD))), 0, [BOLD]],
    [
      'typing between an unmarked and a bold run takes the PRECEDING run',
      doc(para(t('ab'), t('cd', BOLD))),
      2,
      [],
    ],
    [
      'typing at the start of the run AFTER a bold one takes the bold',
      doc(para(t('ab', BOLD), t('cd'))),
      2,
      [BOLD],
    ],
  ])('%s', (_name, input, at, marks) => {
    const { doc: typed } = replaceRange(input, { from: at, to: at }, 'X');
    expect(marksOfRunWith(typed, 'X')).toEqual(marks);
  });

  it('typing at the START of a block takes ITS marks, not the block above', () => {
    // No mark reaches across a separator: the block the caret is visibly in wins.
    const across = doc(para(t('ab', BOLD)), para(t('cd')));
    expect(replaceRange(across, { from: 3, to: 3 }, 'X').doc).toEqual(
      doc(para(t('ab', BOLD)), para(t('Xcd'))),
    );
    expect(replaceRange(across, { from: 2, to: 2 }, 'X').doc).toEqual(
      doc(para(t('abX', BOLD)), para(t('cd'))),
    );
  });

  it('typing in an EMPTY block never inherits marks from a run PAST the caret', () => {
    // D2: 0 a 1 b 2 | 3 | 4 c 5 d 6 — the caret at 3 sits in the empty middle
    // block, so the X must come out unmarked. The backward probe asks for the
    // character at index 2 ('b'); the bold 'cd' run lives at offsets 4..6,
    // BEYOND that index, and only the `index >= offset` guard in
    // marksAtCharacter keeps the scan from falling through to it and answering
    // with a neighbour's bold.
    const ragged = doc(para(t('ab')), para(), para(t('cd', BOLD)));
    expect(replaceRange(ragged, { from: 3, to: 3 }, 'X').doc).toEqual(
      doc(para(t('ab')), para(t('X')), para(t('cd', BOLD))),
    );
  });

  it('a replacement inherits the character BEFORE the selection it replaced', () => {
    const { doc: typed } = replaceRange(
      doc(para(t('ab', BOLD), t('cd'))),
      { from: 2, to: 4 },
      'XY',
    );
    expect(typed).toEqual(doc(para(t('abXY', BOLD))));
  });

  it('looks past hard breaks and earlier runs for the character before the caret', () => {
    const { doc: typed } = replaceRange(
      doc(para(t('a'), BREAK, t('bc', BOLD))),
      { from: 4, to: 4 },
      'X',
    );
    expect(typed).toEqual(doc(para(t('a'), BREAK, t('bcX', BOLD))));
  });

  it('inherits nothing when there is no text at all', () => {
    expect(replaceRange(doc(para()), { from: 0, to: 0 }, 'hi').doc).toStrictEqual(
      doc(para(t('hi'))),
    );
  });
});

describe('replaceRange — robustness (p7)', () => {
  const fixture = doc(para(t('abcd')));

  it.each(MALFORMED)('%s comes back exactly as it went in', (_name, input) => {
    const { doc: after, caret } = replaceRange(input, { from: 0, to: 2 }, 'x');
    expect(after).toBe(input);
    expect(caret).toBe(0);
  });

  it.each<[string, TextRange, number]>([
    ['a reversed range', { from: 3, to: 1 }, 3],
    ['a from past the end', { from: 99, to: 1 }, 4],
    ['a non-integer from', { from: 0.5, to: 3 }, 0],
    ['NaN', { from: Number.NaN, to: 1 }, 0],
    ['a negative Infinity', { from: Number.NEGATIVE_INFINITY, to: 1 }, 0],
  ])('%s changes nothing and KEEPS the caret where it IS an offset', (_name, range, caret) => {
    // F4: a refused edit must not jump the caret to the start of the document —
    // but only a `from` that IS an offset (an integer, :93) can be kept; one
    // that never was (0.5) falls to 0 rather than being handed back (D3).
    const result = replaceRange(fixture, range, 'x');
    expect(result.doc).toBe(fixture);
    expect(result.caret).toBe(caret);
  });

  it('a refused caret is always an ADDRESSABLE offset of the document (D3)', () => {
    // The module's own definition of an offset is Number.isInteger — a refused
    // edit must never hand back a caret (0.5) no document position can hold.
    const refused: TextRange[] = [
      { from: 0.5, to: 3 },
      { from: 2.5, to: 2.5 },
      { from: -1, to: 0.5 },
      { from: Number.NaN, to: 1 },
      { from: Number.POSITIVE_INFINITY, to: 1 },
      { from: 99, to: 0 },
    ];
    for (const range of refused) {
      const { doc: after, caret } = replaceRange(fixture, range, 'x');
      expect(after, JSON.stringify(range)).toBe(fixture);
      expect(Number.isInteger(caret), JSON.stringify(range)).toBe(true);
      expect(caret).toBeGreaterThanOrEqual(0);
      expect(caret).toBeLessThanOrEqual(richTextLength(fixture));
    }
  });

  it.each(UNREADABLE_RANGES)('%s as the range is refused, never thrown over', (_name, range) => {
    // F5: a nullish range used to throw a TypeError out of the module.
    const result = replaceRange(fixture, range, 'x');
    expect(result.doc).toBe(fixture);
    expect(result.caret).toBe(0);
  });

  it('a collapsed range with no text is a no-op that keeps the very same document', () => {
    const { doc: after, caret } = replaceRange(fixture, { from: 2, to: 2 }, '');
    expect(after).toBe(fixture);
    expect(caret).toBe(2);
  });

  it('CLAMPS a selection that runs past the end', () => {
    expect(replaceRange(fixture, { from: 2, to: 99 }, 'X').doc).toEqual(doc(para(t('abX'))));
    expect(replaceRange(fixture, { from: -5, to: 2 }, '').doc).toEqual(doc(para(t('cd'))));
  });
});

describe('purity (p10)', () => {
  it('never mutates the document it was given', () => {
    const input = frozen(
      doc(
        heading(2, t('Title')),
        para(t('Hello '), t('brave', ITALIC), t(' world'), BREAK),
        bullets([t('one')], [t('two')]),
      ),
    );
    const before = structuredClone(input);

    richTextLength(input);
    plainTextOf(input);
    isMarkActive(input, { from: 0, to: 10 }, 'bold');
    toggleMark(input, { from: 2, to: 14 }, 'bold');
    toggleMark(input, { from: 0, to: 40 }, 'italic');
    replaceRange(input, { from: 3, to: 9 }, 'typed');
    replaceRange(input, { from: 0, to: 40 }, '');

    expect(input).toStrictEqual(before);
  });

  it('leaves every untouched block object identical, not merely equal', () => {
    const input = doc(para(t('one')), para(t('two')));
    const marked = toggleMark(input, { from: 0, to: 3 }, 'bold');
    expect(blocksOf(marked)[1]).toBe(input.content[1]);
  });
});
