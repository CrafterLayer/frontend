import { afterEach, describe, expect, it } from 'vitest';

import {
  applyOffsets,
  offsetsOfSelection,
  plainTextOfDom,
  rangeGeometry,
  richTextLengthOfDom,
} from './dom-range';

/**
 * THE SHARED FIXTURE — doc(para('ab'), para('cd')), in exactly the markup
 * `RichText` renders it as, and exactly the document `mark-range.test.ts`
 * asserts the same table against:
 *
 *     0 a 1 b 2 | 3 c 4 d 5     length 5, plain text 'ab\ncd'
 *                 ^ separator
 *
 * One separator position sits between the two paragraphs, so the END of the
 * first (2) and the START of the second (3) are DIFFERENT offsets. Both modules
 * assert this table so neither can drift away from it in silence.
 */
const DOC = '<div class="bldr-richtext"><p><span>ab</span></p><p><span>cd</span></p></div>';
const END_OF_P1 = 2;
const START_OF_P2 = 3;
const DOC_LENGTH = 5;

/**
 * THE hard-break parity fixture, mirrored byte-for-byte in `mark-range.test.ts`:
 * doc(para(t('a'), hardBreak, t('b')), para(t('cd'))).
 *
 *     0 a 1 ↵ 2 b 3 | 4 c 5 d 6      text 'a\nb\ncd'
 *             ^ break    ^ block separator
 */
const HARD_BREAK_DOC =
  '<div class="bldr-richtext"><p><span>a</span><br><span>b</span></p><p><span>cd</span></p></div>';
const BEFORE_BREAK = 1;
const AFTER_BREAK = 2;
const HARD_BREAK_LENGTH = 6;

/**
 * "Hello brave world" + "Second" — two blocks, 23 characters and ONE separator
 * between them, so the offset space is 24 wide. The <strong> in the middle
 * proves nested inline elements land at the offsets their text implies. Text
 * nodes: "Hello " 0–6, "brave" 6–11, " world" 11–17, "Second" 18–24.
 */
const FIXTURE = '<p>Hello <strong>brave</strong> world</p><p>Second</p>';
const END_OF_FIRST = 17;
const START_OF_SECOND = 18;
const LENGTH = 24;

const mount = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
};

const textAt = (root: HTMLElement, index: number): Text => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let seen = 0; ; seen += 1) {
    const node = walker.nextNode();
    if (node === null) {
      throw new Error(`fixture has no text node #${String(index)}`);
    }
    if (seen === index) {
      return node as Text;
    }
  }
};

const el = (root: HTMLElement, selector: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) {
    throw new Error(`fixture has no ${selector}`);
  }
  return found;
};

/**
 * Splice an EMPTY text node into a paragraph — what a re-render can leave
 * behind, and the one shape HTML alone cannot express.
 */
const withEmptyRun = (
  root: HTMLElement,
  paragraph: number,
  where: 'start' | 'end',
): HTMLElement => {
  const block = root.querySelectorAll('p')[paragraph];
  if (block === undefined) {
    throw new Error(`fixture has no paragraph #${String(paragraph)}`);
  }
  const empty = document.createTextNode('');
  if (where === 'start') {
    block.insertBefore(empty, block.firstChild);
  } else {
    block.appendChild(empty);
  }
  return root;
};

const selectionOf = (): Selection => {
  const selection = window.getSelection();
  if (selection === null) {
    throw new Error('jsdom must expose a Selection');
  }
  return selection;
};

/** anchor → focus, in that order, so BACKWARD selections stay expressible. */
const select = (anchor: [Node, number], focus: [Node, number]): Selection => {
  const selection = selectionOf();
  selection.setBaseAndExtent(anchor[0], anchor[1], focus[0], focus[1]);
  return selection;
};

/** The document's own length, read through the API that clamps to it. */
const lengthOfDocument = (root: HTMLElement): number => {
  applyOffsets(root, { from: Number.MAX_SAFE_INTEGER, to: Number.MAX_SAFE_INTEGER }, selectionOf());
  const end = offsetsOfSelection(root, selectionOf());
  if (end === null) {
    throw new Error('the fixture has no addressable end');
  }
  return end.to;
};

type StubRect = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;

/** The boundary points of a Range at the moment it was measured. */
interface Measured {
  startContainer: Node;
  startOffset: number;
  endContainer: Node;
  endOffset: number;
}

let measured: Measured[] = [];

/**
 * jsdom has NO layout: `Range.prototype.getClientRects` is absent there
 * entirely — not an empty list — so line geometry has to be stubbed. What only
 * a real browser proves is that a selection yields one rect PER RENDERED LINE
 * and where those lines sit; the Chromium/Storybook gate owns that. These tests
 * own the arithmetic layered on top of it — and the stub records the Range it
 * was asked about, which is how WHERE the measurement was taken gets asserted.
 */
const stubRects = (rects: StubRect[] | null): void => {
  measured = [];
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: function (this: Range): ArrayLike<DOMRect> | null {
      measured.push({
        startContainer: this.startContainer,
        startOffset: this.startOffset,
        endContainer: this.endContainer,
        endOffset: this.endOffset,
      });
      return rects as DOMRect[] | null;
    },
  });
};

const lastMeasured = (): Measured => {
  const last = measured[measured.length - 1];
  if (last === undefined) {
    throw new Error('nothing was measured');
  }
  return last;
};

afterEach(() => {
  Reflect.deleteProperty(Range.prototype, 'getClientRects');
  measured = [];
  selectionOf().removeAllRanges();
  document.body.replaceChildren();
});

describe('the shared offset model — doc(para(ab), para(cd)) (p1)', () => {
  it('gives every caret position in the document its own offset', () => {
    const root = mount(DOC);
    expect(root.textContent).toBe('abcd');
    for (const [index, local, expected] of [
      [0, 0, 0],
      [0, 1, 1],
      [0, 2, END_OF_P1],
      [1, 0, START_OF_P2],
      [1, 1, 4],
      [1, 2, DOC_LENGTH],
    ] as const) {
      const node = textAt(root, index);
      const caret = select([node, local], [node, local]);
      expect(offsetsOfSelection(root, caret), `text #${String(index)}+${String(local)}`).toEqual({
        from: expected,
        to: expected,
      });
    }
  });

  it('separates the two blocks by exactly ONE position', () => {
    expect(START_OF_P2).toBe(END_OF_P1 + 1);
    expect(lengthOfDocument(mount(DOC))).toBe(DOC_LENGTH);
  });
});

describe('hard-break parity — doc(para(a, hardBreak, b), para(cd))', () => {
  it('counts the break as ONE position and renders it as a newline', () => {
    const root = mount(HARD_BREAK_DOC);
    expect(richTextLengthOfDom(root)).toBe(HARD_BREAK_LENGTH);
    expect(plainTextOfDom(root)).toBe('a\nb\ncd');
  });

  it('maps the caret before the break and the caret after it to different offsets', () => {
    const root = mount(HARD_BREAK_DOC);
    const before = textAt(root, 0);
    const after = textAt(root, 1);
    expect(offsetsOfSelection(root, select([before, 1], [before, 1]))).toEqual({
      from: BEFORE_BREAK,
      to: BEFORE_BREAK,
    });
    expect(offsetsOfSelection(root, select([after, 0], [after, 0]))).toEqual({
      from: AFTER_BREAK,
      to: AFTER_BREAK,
    });
    expect(AFTER_BREAK).toBe(BEFORE_BREAK + 1);
  });

  it('restores both sides of the break without collapsing either caret', () => {
    const root = mount(HARD_BREAK_DOC);
    for (const offset of [BEFORE_BREAK, AFTER_BREAK]) {
      expect(applyOffsets(root, { from: offset, to: offset }, selectionOf())).toBe(true);
      expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: offset, to: offset });
    }
  });
});

describe('block boundaries — the separator (p2)', () => {
  it('reads a caret at the START of the second paragraph as end-of-first + 1', () => {
    const root = mount(DOC);
    const start = textAt(root, 1);
    const end = textAt(root, 0);
    expect(offsetsOfSelection(root, select([end, 2], [end, 2]))).toEqual({
      from: END_OF_P1,
      to: END_OF_P1,
    });
    expect(offsetsOfSelection(root, select([start, 0], [start, 0]))).toEqual({
      from: END_OF_P1 + 1,
      to: END_OF_P1 + 1,
    });
  });

  it('puts that caret back in the SECOND paragraph, not at the end of the first', () => {
    const root = mount(DOC);
    const second = el(root, 'p:nth-of-type(2)');
    expect(applyOffsets(root, { from: START_OF_P2, to: START_OF_P2 }, selectionOf())).toBe(true);
    expect(second.contains(selectionOf().anchorNode)).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({
      from: START_OF_P2,
      to: START_OF_P2,
    });
  });

  it('keeps the end of the first paragraph inside the FIRST paragraph', () => {
    const root = mount(DOC);
    const first = el(root, 'p:nth-of-type(1)');
    expect(applyOffsets(root, { from: END_OF_P1, to: END_OF_P1 }, selectionOf())).toBe(true);
    expect(first.contains(selectionOf().anchorNode)).toBe(true);
  });
});

describe('offsetsOfSelection — the offset model (p3)', () => {
  it('visits text in DOCUMENT order, so a nested <strong> sits at its own offsets', () => {
    const root = mount(FIXTURE);
    for (const [index, local, expected] of [
      [0, 0, 0],
      [0, 6, 6],
      [1, 0, 6], // the <strong>'s own text starts where "Hello " ended
      [1, 5, 11],
      [2, 0, 11],
      [2, 6, END_OF_FIRST], // the end of the first block
      [3, 0, START_OF_SECOND], // the second block starts one position later
      [3, 6, LENGTH],
    ] as const) {
      const node = textAt(root, index);
      const caret = select([node, local], [node, local]);
      expect(offsetsOfSelection(root, caret), `text #${String(index)}+${String(local)}`).toEqual({
        from: expected,
        to: expected,
      });
    }
  });

  it('spans a range that crosses inline element boundaries', () => {
    const root = mount(FIXTURE);
    const selection = select([textAt(root, 0), 6], [textAt(root, 2), 6]);
    expect(selection.toString()).toBe('brave world');
    expect(offsetsOfSelection(root, selection)).toEqual({ from: 6, to: END_OF_FIRST });
  });
});

describe('offsetsOfSelection — ELEMENT containers (p4)', () => {
  it('resolves a child index to the first text position at or after it', () => {
    const root = mount(FIXTURE);
    const first = el(root, 'p');
    for (const [container, index, expected] of [
      [root, 0, 0],
      [root, 1, START_OF_SECOND], // between the blocks: the next block's start
      [root, 2, LENGTH], // past the last child: the end of root's text
      [first, 1, 6], // before the <strong>
      [first, 2, 11], // before the trailing " world"
      [first, 3, END_OF_FIRST], // past the first block's last child — still in it
    ] as const) {
      const caret = select([container, index], [container, index]);
      expect(offsetsOfSelection(root, caret), `child index ${String(index)}`).toEqual({
        from: expected,
        to: expected,
      });
    }
  });

  it('handles the select-all shape browsers hand back (element containers)', () => {
    const root = mount(FIXTURE);
    const selection = select([root, 0], [root, root.childNodes.length]);
    expect(offsetsOfSelection(root, selection)).toEqual({ from: 0, to: LENGTH });
  });

  it('skips past an element that renders no text', () => {
    const root = mount('<p><span></span>after</p>');
    const paragraph = el(root, 'p');
    expect(offsetsOfSelection(root, select([paragraph, 0], [paragraph, 0]))).toEqual({
      from: 0,
      to: 0,
    });
    expect(offsetsOfSelection(root, select([paragraph, 1], [paragraph, 1]))).toEqual({
      from: 0,
      to: 0,
    });
  });
});

describe('offsetsOfSelection — direction (p5)', () => {
  it('normalises a BACKWARD selection inside one text node', () => {
    const root = mount(FIXTURE);
    const node = textAt(root, 0);
    expect(offsetsOfSelection(root, select([node, 4], [node, 1]))).toEqual({ from: 1, to: 4 });
  });

  it('normalises a BACKWARD selection spanning several text nodes', () => {
    const root = mount(FIXTURE);
    const backward = select([textAt(root, 2), 3], [textAt(root, 0), 2]);
    expect(offsetsOfSelection(root, backward)).toEqual({ from: 2, to: 14 });
  });
});

describe('offsetsOfSelection — outside root (p6)', () => {
  it('returns null for a selection that never touches root', () => {
    const outside = mount('<p>elsewhere</p>');
    const root = mount(FIXTURE);
    const node = textAt(outside, 0);
    expect(offsetsOfSelection(root, select([node, 1], [node, 4]))).toBeNull();
  });

  it('CLAMPS a selection that starts inside root and runs out of it', () => {
    const root = mount(FIXTURE);
    const after = mount('<p>trailing</p>');
    const selection = select([textAt(root, 3), 2], [textAt(after, 0), 4]);
    expect(offsetsOfSelection(root, selection)).toEqual({ from: 20, to: LENGTH });
  });

  it('CLAMPS a selection that starts before root and ends inside it', () => {
    const before = mount('<p>leading</p>');
    const root = mount(FIXTURE);
    const selection = select([textAt(before, 0), 2], [textAt(root, 1), 3]);
    expect(offsetsOfSelection(root, selection)).toEqual({ from: 0, to: 9 });
  });

  it('keeps root’s whole span when the selection WRAPS it on both sides', () => {
    const before = mount('<p>leading</p>');
    const root = mount(FIXTURE);
    const after = mount('<p>trailing</p>');
    const selection = select([textAt(before, 0), 1], [textAt(after, 0), 5]);
    expect(offsetsOfSelection(root, selection)).toEqual({ from: 0, to: LENGTH });
  });
});

describe('an EMPTY document is addressable (p7)', () => {
  it('reads a caret inside a root that holds NO text as offset 0', () => {
    const root = mount('<div class="bldr-richtext"><p></p></div>');
    const paragraph = el(root, 'p');
    expect(offsetsOfSelection(root, select([paragraph, 0], [paragraph, 0]))).toEqual({
      from: 0,
      to: 0,
    });
  });

  it('places a caret in an empty root and reports that it did', () => {
    const root = mount('<div class="bldr-richtext"><p></p></div>');
    expect(applyOffsets(root, { from: 0, to: 0 }, selectionOf())).toBe(true);
    expect(el(root, 'p').contains(selectionOf().anchorNode)).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 0, to: 0 });
  });

  it('addresses a root holding only an EMPTY text node, in both directions', () => {
    const root = withEmptyRun(mount('<p></p>'), 0, 'end');
    expect(applyOffsets(root, { from: 0, to: 0 }, selectionOf())).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 0, to: 0 });
    expect(offsetsOfSelection(root, select([textAt(root, 0), 0], [textAt(root, 0), 0]))).toEqual({
      from: 0,
      to: 0,
    });
  });

  it('still returns null when the selection is somewhere else entirely', () => {
    const root = mount('<p></p>');
    const node = textAt(mount('<p>elsewhere</p>'), 0);
    expect(offsetsOfSelection(root, select([node, 0], [node, 2]))).toBeNull();
  });

  it('takes a caret even in a root with no inline container at all', () => {
    const root = mount('<hr>');
    expect(applyOffsets(root, { from: 0, to: 0 }, selectionOf())).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 0, to: 0 });
  });
});

describe('EMPTY text runs — the two directions agree (p8)', () => {
  it('reads a caret in an empty text node in a LATER block as that block’s offset', () => {
    const root = withEmptyRun(mount(DOC), 1, 'start');
    const empty = textAt(root, 1);
    expect(empty.data).toBe('');
    expect(offsetsOfSelection(root, select([empty, 0], [empty, 0]))).toEqual({
      from: START_OF_P2,
      to: START_OF_P2,
    });
  });

  it('round-trips EVERY offset of EVERY fixture, empty runs included', () => {
    const fixtures: { name: string; build: () => HTMLElement }[] = [
      { name: 'doc(para(ab), para(cd))', build: () => mount(DOC) },
      { name: 'the sample fixture', build: () => mount(FIXTURE) },
      { name: 'one block', build: () => mount('<p>only</p>') },
      { name: 'an empty document', build: () => mount('<p></p>') },
      { name: 'a hard break inside a paragraph', build: () => mount(HARD_BREAK_DOC) },
      {
        name: 'an empty block between two full ones',
        build: () => mount('<p>ab</p><p></p><p>cd</p>'),
      },
      {
        name: 'an empty run opening the last block',
        build: () => withEmptyRun(mount(DOC), 1, 'start'),
      },
      {
        name: 'an empty run closing the first block',
        build: () => withEmptyRun(mount(DOC), 0, 'end'),
      },
      { name: 'nothing but an empty run', build: () => withEmptyRun(mount('<p></p>'), 0, 'end') },
      { name: 'a list', build: () => mount('<ul><li><p>one</p></li><li><p>two</p></li></ul>') },
      { name: 'text with no paragraph at all', build: () => mount('bare') },
      { name: 'an unknown block holding text', build: () => mount('<div>one</div><p>two</p>') },
    ];
    for (const fixture of fixtures) {
      const root = fixture.build();
      const length = lengthOfDocument(root);
      for (let offset = 0; offset <= length; offset += 1) {
        const where = `${fixture.name} @${String(offset)}`;
        expect(applyOffsets(root, { from: offset, to: offset }, selectionOf()), where).toBe(true);
        expect(offsetsOfSelection(root, selectionOf()), where).toEqual({
          from: offset,
          to: offset,
        });
      }
      document.body.replaceChildren();
    }
  });
});

describe('applyOffsets — round trip with offsetsOfSelection (p9)', () => {
  it('restores every shape of range the caller can hold', () => {
    const root = mount(FIXTURE);
    for (const range of [
      { from: 0, to: 0 }, // offset 0
      { from: 3, to: 3 }, // a caret inside a text node
      { from: 2, to: 5 }, // a range inside ONE text node
      { from: 6, to: 11 }, // exactly the <strong>
      { from: END_OF_FIRST, to: END_OF_FIRST }, // the end of the first block
      { from: START_OF_SECOND, to: START_OF_SECOND }, // the start of the second
      { from: 4, to: 20 }, // across several inline elements AND both blocks
      { from: 0, to: LENGTH },
      { from: LENGTH, to: LENGTH }, // offset === length
    ]) {
      expect(applyOffsets(root, range, selectionOf()), JSON.stringify(range)).toBe(true);
      expect(offsetsOfSelection(root, selectionOf()), JSON.stringify(range)).toEqual(range);
    }
  });

  it('places a real caret, not just an offset — the selected text is the document text', () => {
    const root = mount(FIXTURE);
    applyOffsets(root, { from: 6, to: END_OF_FIRST }, selectionOf());
    expect(selectionOf().toString()).toBe('brave world');
  });
});

describe('applyOffsets — tolerance (p10)', () => {
  it('CLAMPS out-of-range offsets instead of throwing', () => {
    const root = mount(FIXTURE);
    expect(applyOffsets(root, { from: -20, to: 999 }, selectionOf())).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 0, to: LENGTH });
  });

  it('normalises a reversed range', () => {
    const root = mount(FIXTURE);
    expect(applyOffsets(root, { from: 9, to: 2 }, selectionOf())).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 2, to: 9 });
  });

  it('returns false without a selection', () => {
    const root = mount(FIXTURE);
    expect(applyOffsets(root, { from: 1, to: 2 }, null)).toBe(false);
  });

  it('returns false for a DETACHED root — the caret was never placed', () => {
    const root = document.createElement('div');
    root.innerHTML = FIXTURE;
    expect(applyOffsets(root, { from: 1, to: 4 }, selectionOf())).toBe(false);
    expect(selectionOf().rangeCount).toBe(0);
  });
});

describe('offsets are INDEXES — nothing else is addressable (p11)', () => {
  it('REFUSES a NaN offset and leaves the caret exactly where it was', () => {
    const root = mount(FIXTURE);
    applyOffsets(root, { from: 3, to: 3 }, selectionOf());
    expect(applyOffsets(root, { from: Number.NaN, to: Number.NaN }, selectionOf())).toBe(false);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 3, to: 3 });
  });

  it('REFUSES a fractional offset rather than truncating it silently', () => {
    const root = mount(FIXTURE);
    applyOffsets(root, { from: 3, to: 3 }, selectionOf());
    expect(applyOffsets(root, { from: 2.5, to: 7.5 }, selectionOf())).toBe(false);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 3, to: 3 });
  });

  it('measures no geometry for an offset that is not an index', () => {
    const root = mount(FIXTURE);
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: Number.NaN, to: 8 })).toBeNull();
    expect(rangeGeometry(root, { from: 2, to: Number.POSITIVE_INFINITY })).toBeNull();
    expect(rangeGeometry(root, { from: 1.5, to: 8 })).toBeNull();
    expect(measured).toHaveLength(0);
  });
});

describe('rangeGeometry (p12)', () => {
  it('returns null for a collapsed range', () => {
    const root = mount(FIXTURE);
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: 4, to: 4 })).toBeNull();
  });

  it('returns null for an empty root — it has one position, so nothing to measure', () => {
    const root = mount('<p></p>');
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: 0, to: 5 })).toBeNull();
  });

  it('returns null when clamping collapses the range', () => {
    const root = mount(FIXTURE);
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: 100, to: 200 })).toBeNull();
  });

  it('measures from the block the range STARTS in, not the one before it', () => {
    const root = mount(DOC);
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: START_OF_P2, to: DOC_LENGTH })).not.toBeNull();
    expect(el(root, 'p:nth-of-type(2)').contains(lastMeasured().startContainer)).toBe(true);
  });

  it('CLAMPS a negative from instead of throwing', () => {
    const root = mount(FIXTURE);
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: -5, to: 3 })?.box).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 16,
    });
    expect(lastMeasured().startContainer).toBe(textAt(root, 0));
    expect(lastMeasured().startOffset).toBe(0);
  });

  it('CLAMPS an over-large to instead of losing the geometry', () => {
    const root = mount(FIXTURE);
    stubRects([{ x: 10, y: 20, width: 40, height: 16 }]);
    expect(rangeGeometry(root, { from: 2, to: LENGTH + 500 })?.box).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 16,
    });
    // The end of the LAST text node — not the start of the block that holds it.
    expect(lastMeasured().endContainer).toBe(textAt(root, 3));
    expect(lastMeasured().endOffset).toBe(6);
  });
});

describe('rangeGeometry — line rects (p13)', () => {
  it('carries ONE entry per line and unions them into the box', () => {
    const root = mount(FIXTURE);
    stubRects([
      { x: 300, y: 100, width: 120, height: 20 }, // tail of the first line
      { x: 20, y: 120, width: 400, height: 20 }, // a full middle line
      { x: 20, y: 140, width: 90, height: 20 }, // head of the last line
    ]);
    const geometry = rangeGeometry(root, { from: 2, to: 20 });
    expect(geometry?.rects).toHaveLength(3);
    expect(geometry?.box).toEqual({ x: 20, y: 100, width: 400, height: 60 });
  });

  it('filters zero-area rects out of both the list and the union', () => {
    const root = mount(FIXTURE);
    stubRects([
      { x: 0, y: 100, width: 0, height: 20 }, // a line break's zero-width artifact
      { x: 40, y: 100, width: 60, height: 20 },
      { x: 40, y: 120, width: 60, height: 0 }, // a collapsed inline box
    ]);
    const geometry = rangeGeometry(root, { from: 2, to: 20 });
    expect(geometry?.rects).toEqual([{ x: 40, y: 100, width: 60, height: 20 }]);
    expect(geometry?.box).toEqual({ x: 40, y: 100, width: 60, height: 20 });
  });

  it('returns null when nothing with area was rendered', () => {
    const root = mount(FIXTURE);
    stubRects([{ x: 0, y: 0, width: 0, height: 0 }]);
    expect(rangeGeometry(root, { from: 2, to: 20 })).toBeNull();
  });

  it('degrades to null where Range geometry ANSWERS with nothing', () => {
    const root = mount(FIXTURE);
    stubRects(null);
    expect(rangeGeometry(root, { from: 2, to: 20 })).toBeNull();
    expect(measured).toHaveLength(1);
  });

  it('degrades to null where Range geometry does not exist (jsdom, unstubbed)', () => {
    const root = mount(FIXTURE);
    expect(rangeGeometry(root, { from: 2, to: 20 })).toBeNull();
  });
});

describe('containers the stored model would not name (p14)', () => {
  it('treats text sitting directly in root as a container of its own', () => {
    const root = mount('bare');
    const node = textAt(root, 0);
    expect(offsetsOfSelection(root, select([node, 4], [node, 4]))).toEqual({ from: 4, to: 4 });
    expect(applyOffsets(root, { from: 2, to: 2 }, selectionOf())).toBe(true);
    expect(offsetsOfSelection(root, selectionOf())).toEqual({ from: 2, to: 2 });
  });

  it('counts an unknown block that HOLDS text, with a separator after it', () => {
    const root = mount('<div>one</div><p>two</p>'); // 0 one 3 | 4 two 7
    expect(offsetsOfSelection(root, select([textAt(root, 0), 3], [textAt(root, 0), 3]))).toEqual({
      from: 3,
      to: 3,
    });
    expect(offsetsOfSelection(root, select([textAt(root, 1), 0], [textAt(root, 1), 0]))).toEqual({
      from: 4,
      to: 4,
    });
  });

  it('leaves a block that renders NO text out of the offset space', () => {
    // The <hr> is not a place a caret can be, so it adds no separator: the two
    // paragraphs sit exactly as they do in doc(para(ab), para(cd)).
    const root = mount('<p>ab</p><hr><p>cd</p>');
    expect(lengthOfDocument(root)).toBe(DOC_LENGTH);
    expect(offsetsOfSelection(root, select([textAt(root, 1), 0], [textAt(root, 1), 0]))).toEqual({
      from: START_OF_P2,
      to: START_OF_P2,
    });
  });
});

describe('robustness (p15)', () => {
  it('survives a null selection', () => {
    const root = mount(FIXTURE);
    expect(offsetsOfSelection(root, null)).toBeNull();
  });

  it('survives a selection with rangeCount === 0', () => {
    const root = mount(FIXTURE);
    const selection = selectionOf();
    selection.removeAllRanges();
    expect(selection.rangeCount).toBe(0);
    expect(offsetsOfSelection(root, selection)).toBeNull();
  });

  it('survives a selection that reports a range but no anchor', () => {
    const root = mount(FIXTURE);
    // Not a shape a browser produces — but this module reads whatever the host
    // document hands it, and a nodeless selection is no position at all.
    const nodeless = {
      rangeCount: 1,
      anchorNode: null,
      anchorOffset: 0,
      focusNode: null,
      focusOffset: 0,
    } as unknown as Selection;
    expect(offsetsOfSelection(root, nodeless)).toBeNull();
  });

  it('survives a root that holds only elements', () => {
    const root = mount('<p></p><hr>');
    const node = textAt(mount('<p>elsewhere</p>'), 0);
    expect(offsetsOfSelection(root, select([node, 0], [node, 2]))).toBeNull();
    expect(rangeGeometry(root, { from: 0, to: 1 })).toBeNull();
  });

  it('survives a DETACHED root', () => {
    const root = document.createElement('div');
    root.innerHTML = FIXTURE;
    const node = textAt(mount('<p>elsewhere</p>'), 0);
    expect(offsetsOfSelection(root, select([node, 0], [node, 2]))).toBeNull();
    stubRects([{ x: 1, y: 2, width: 3, height: 4 }]);
    expect(rangeGeometry(root, { from: 0, to: 4 })).toEqual({
      box: { x: 1, y: 2, width: 3, height: 4 },
      rects: [{ x: 1, y: 2, width: 3, height: 4 }],
    });
  });
});
