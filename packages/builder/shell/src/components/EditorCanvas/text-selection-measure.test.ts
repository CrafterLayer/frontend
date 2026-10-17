import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  inlineRectOf,
  isInlineSelectionAnchorSource,
  measureTextSelection,
} from './text-selection-measure';

afterEach(() => {
  vi.restoreAllMocks();
  document.getSelection()?.removeAllRanges();
});

function selectText(element: HTMLElement, start: number, end: number) {
  const text = element.firstChild;
  if (text === null) throw new Error('element must hold text');
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, end);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
}

describe('inlineRectOf', () => {
  it('keeps a finite, non-empty box as plain numbers', () => {
    expect(inlineRectOf({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
  });

  it('drops degenerate boxes', () => {
    expect(inlineRectOf({ x: 1, y: 2, width: 0, height: 4 })).toBeNull();
    expect(inlineRectOf({ x: Number.NaN, y: 2, width: 3, height: 4 })).toBeNull();
    expect(inlineRectOf({ x: 1, y: 2, width: 3, height: -1 })).toBeNull();
  });
});

describe('isInlineSelectionAnchorSource', () => {
  it('tells a deferred source from a frozen anchor', () => {
    expect(isInlineSelectionAnchorSource({ measure: () => null })).toBe(true);
    expect(isInlineSelectionAnchorSource({ box: { x: 0, y: 0, width: 1, height: 1 } })).toBe(false);
  });
});

describe('measureTextSelection', () => {
  it('a collapsed caret or a selection outside the element measures nothing', () => {
    document.body.innerHTML = '<p id="edited">Hello world</p><p id="other">Elsewhere</p>';
    const edited = document.getElementById('edited')!;
    const other = document.getElementById('other')!;
    selectText(edited, 2, 2);
    expect(measureTextSelection(document, edited)).toBeNull();
    selectText(other, 0, 4);
    expect(measureTextSelection(document, edited)).toBeNull();
  });

  it('uses the bounding box and keeps the line rects', () => {
    document.body.innerHTML = '<p id="edited">Hello world</p>';
    const edited = document.getElementById('edited')!;
    const range = selectText(edited, 0, 5);
    const lines = [
      { x: 10, y: 20, width: 30, height: 10 },
      { x: 10, y: 32, width: 12, height: 10 },
    ];
    Object.assign(range, {
      getClientRects: () => lines as unknown as DOMRectList,
      getBoundingClientRect: () => ({ x: 10, y: 20, width: 30, height: 22 }) as DOMRect,
    });
    expect(measureTextSelection(document, edited)).toEqual({
      box: { x: 10, y: 20, width: 30, height: 22 },
      rects: lines,
    });
  });

  it('without a bounding box, the union of the line rects is the box', () => {
    document.body.innerHTML = '<p id="edited">Hello world</p>';
    const edited = document.getElementById('edited')!;
    const range = selectText(edited, 0, 5);
    Object.assign(range, {
      getClientRects: () =>
        [
          { x: 10, y: 20, width: 30, height: 10 },
          { x: 5, y: 32, width: 12, height: 10 },
        ] as unknown as DOMRectList,
      getBoundingClientRect: undefined,
    });
    expect(measureTextSelection(document, edited)?.box).toEqual({
      x: 5,
      y: 20,
      width: 35,
      height: 22,
    });
  });

  it('a selection with no measurable rect measures nothing', () => {
    document.body.innerHTML = '<p id="edited">Hello world</p>';
    const edited = document.getElementById('edited')!;
    const range = selectText(edited, 0, 5);
    Object.assign(range, {
      getClientRects: () => [] as unknown as DOMRectList,
      getBoundingClientRect: undefined,
    });
    expect(measureTextSelection(document, edited)).toBeNull();
  });
});
