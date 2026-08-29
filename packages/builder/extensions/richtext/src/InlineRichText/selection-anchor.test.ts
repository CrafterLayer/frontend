import { getSchema, type Editor } from '@tiptap/core';
import { EditorState, NodeSelection, TextSelection, type Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { selectionAnchorOf } from './selection-anchor';

// jsdom implements no selection geometry — the stubs below feed deterministic
// rects through the SAME DOM entry points a browser uses (the RichTextField
// test pattern): Range.getClientRects for the per-line channel, coordsAtPos
// for posToDOMRect's union box.
let rangeRects: DOMRect[] = [];

beforeAll(() => {
  Range.prototype.getClientRects = function getClientRectsStub() {
    return rangeRects as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
    return rangeRects[0] ?? new DOMRect(0, 0, 0, 0);
  };
});

beforeEach(() => {
  rangeRects = [];
});

const schema = getSchema([StarterKit]);
// doc: <p>Hello world</p><hr> — text at positions 1..12, the rule at 13.
const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('Hello world')]),
  schema.node('horizontalRule'),
]);
const HR_POS = 13;

/** 10px per position, one 16px line at y=10 — pure arithmetic for assertions. */
const coordsFor = (pos: number) => ({ top: 10, bottom: 26, left: pos * 10, right: pos * 10 });

function makeView(overrides: Record<string, unknown> = {}): {
  view: EditorView;
  text: Text;
} {
  const host = document.createElement('div');
  const dom = document.createElement('div');
  const text = document.createTextNode('Hello world');
  dom.appendChild(text);
  host.appendChild(dom);
  document.body.appendChild(host);
  const view = {
    dom,
    coordsAtPos: coordsFor,
    domAtPos: (pos: number) => ({ node: text, offset: Math.max(0, Math.min(pos - 1, 11)) }),
    nodeDOM: () => null,
    ...overrides,
  } as unknown as EditorView;
  return { view, text };
}

function makeEditor(selection: Selection, view: EditorView): Editor {
  const state = EditorState.create({ doc, selection });
  // posToDOMRect reads view.state — mirror the real coupling.
  (view as unknown as { state: EditorState }).state = state;
  return { isDestroyed: false, state, view } as unknown as Editor;
}

describe('selectionAnchorOf (009 contract §5 b4 — vendored TipTap logic + per-line rects)', () => {
  it('collapsed selection: the caret rect, width 0, one rect', () => {
    const { view } = makeView();
    const anchor = selectionAnchorOf(makeEditor(TextSelection.create(doc, 3, 3), view));
    expect(anchor).not.toBeNull();
    expect(anchor?.box).toEqual({ x: 30, y: 10, width: 0, height: 16 });
    // No DOM rects (jsdom returns none) — the union box is the fallback line.
    expect(anchor?.rects).toEqual([{ x: 30, y: 10, width: 0, height: 16 }]);
  });

  it('single-line selection: the from/to union box and its one line rect', () => {
    rangeRects = [new DOMRect(10, 10, 50, 16)];
    const { view } = makeView();
    const anchor = selectionAnchorOf(makeEditor(TextSelection.create(doc, 1, 6), view));
    expect(anchor?.box).toEqual({ x: 10, y: 10, width: 50, height: 16 });
    expect(anchor?.rects).toEqual([{ x: 10, y: 10, width: 50, height: 16 }]);
  });

  it('multi-line selection: several per-line rects, zero-size DOM noise dropped', () => {
    rangeRects = [
      new DOMRect(40, 10, 60, 16), // first line, from the caret to the wrap
      new DOMRect(0, 30, 45, 16), // last line, from the wrap to the caret
      new DOMRect(45, 30, 0, 0), // the empty rect browsers emit at a line end
    ];
    const { view } = makeView();
    const anchor = selectionAnchorOf(makeEditor(TextSelection.create(doc, 1, 12), view));
    expect(anchor?.rects.length).toBeGreaterThan(1);
    expect(anchor?.rects).toEqual([
      { x: 40, y: 10, width: 60, height: 16 },
      { x: 0, y: 30, width: 45, height: 16 },
    ]);
    // The union box is NOT what the bubble hugs — the lines are (§2 p4).
    expect(anchor?.box).toEqual({ x: 10, y: 10, width: 110, height: 16 });
  });

  it('node selection: the selected node element is the anchor (upstream special case)', () => {
    const rect = new DOMRect(5, 40, 200, 4);
    const rule = document.createElement('hr');
    rule.getBoundingClientRect = () => rect;
    rule.getClientRects = () => [rect] as unknown as DOMRectList;
    const { view } = makeView({ nodeDOM: (pos: number) => (pos === HR_POS ? rule : null) });
    const anchor = selectionAnchorOf(makeEditor(NodeSelection.create(doc, HR_POS), view));
    expect(anchor?.box).toEqual({ x: 5, y: 40, width: 200, height: 4 });
    expect(anchor?.rects).toEqual([{ x: 5, y: 40, width: 200, height: 4 }]);
  });

  it('uses a node-view wrapper when present and falls back to positional geometry for non-elements', () => {
    const wrapperRect = new DOMRect(40, 50, 120, 20);
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-node-view-wrapper', '');
    wrapper.getBoundingClientRect = () => wrapperRect;
    wrapper.getClientRects = () => [] as unknown as DOMRectList;
    const node = document.createElement('section');
    node.getBoundingClientRect = () => new DOMRect(1, 2, 3, 4);
    node.append(wrapper);
    const { view } = makeView({ nodeDOM: (pos: number) => (pos === HR_POS ? node : null) });

    const wrapped = selectionAnchorOf(makeEditor(NodeSelection.create(doc, HR_POS), view));
    expect(wrapped).toEqual({
      box: { x: 40, y: 50, width: 120, height: 20 },
      rects: [{ x: 40, y: 50, width: 120, height: 20 }],
    });

    const fallback = makeView();
    Object.defineProperty(fallback.view, 'nodeDOM', {
      configurable: true,
      value: () => fallback.text,
    });
    expect(
      selectionAnchorOf(makeEditor(NodeSelection.create(doc, HR_POS), fallback.view))?.box,
    ).toEqual({ x: 130, y: 10, width: 10, height: 16 });
  });

  it('keeps a node view that is itself the wrapper as its selection anchor', () => {
    const wrapperRect = new DOMRect(25, 70, 80, 18);
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-node-view-wrapper', '');
    wrapper.getBoundingClientRect = () => wrapperRect;
    wrapper.getClientRects = () => [wrapperRect] as unknown as DOMRectList;
    const outerNode = document.createElement('section');
    outerNode.getBoundingClientRect = () => new DOMRect(1, 2, 3, 4);
    outerNode.append(wrapper);
    const { view } = makeView({ nodeDOM: (pos: number) => (pos === HR_POS ? wrapper : null) });

    expect(selectionAnchorOf(makeEditor(NodeSelection.create(doc, HR_POS), view))).toEqual({
      box: { x: 25, y: 70, width: 80, height: 18 },
      rects: [{ x: 25, y: 70, width: 80, height: 18 }],
    });
  });

  it('a range the DOM refuses degrades to the union box instead of throwing', () => {
    rangeRects = [new DOMRect(10, 10, 50, 16)];
    const { view } = makeView({
      domAtPos: () => {
        throw new Error('position has no DOM');
      },
    });
    const anchor = selectionAnchorOf(makeEditor(TextSelection.create(doc, 1, 6), view));
    expect(anchor?.rects).toEqual([anchor?.box]);
  });

  it('destroyed, unmounted, and detached editors return null — and never touch the view', () => {
    const destroyed = { isDestroyed: true } as unknown as Editor;
    expect(selectionAnchorOf(destroyed)).toBeNull();

    // tiptap v3's view getter THROWS for an unmounted editor — the derivation
    // must absorb that and answer null.
    const unmounted = {
      isDestroyed: false,
      get view(): EditorView {
        throw new Error('[tiptap error]: The editor view is not available.');
      },
    } as unknown as Editor;
    expect(selectionAnchorOf(unmounted)).toBeNull();

    const detachedDom = document.createElement('div');
    const detached = {
      isDestroyed: false,
      state: EditorState.create({ doc, selection: TextSelection.create(doc, 1, 6) }),
      view: { dom: detachedDom } as unknown as EditorView,
    } as unknown as Editor;
    expect(selectionAnchorOf(detached)).toBeNull();
  });
});
