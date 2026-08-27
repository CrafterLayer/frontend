import { getSchema, type Editor } from '@tiptap/core';
import { EditorState, NodeSelection, TextSelection, type Selection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';

import { shouldShowBubble } from './should-show';

const schema = getSchema([StarterKit]);
// doc: <p>Hello world</p><hr> — text at positions 1..12, the rule at 13.
const doc = schema.node('doc', null, [
  schema.node('paragraph', null, [schema.text('Hello world')]),
  schema.node('horizontalRule'),
]);
// Two EMPTY paragraphs: a range across them selects zero characters.
const emptyDoc = schema.node('doc', null, [schema.node('paragraph'), schema.node('paragraph')]);

interface FakeOptions {
  focused?: boolean;
  editable?: boolean;
  destroyed?: boolean;
}

function editorFor(selection: Selection, options: FakeOptions = {}): Editor {
  const state = EditorState.create({ doc: selection.$from.doc, selection });
  // A live view has an ATTACHED dom — that is the mounted-editor signal.
  const host = document.createElement('div');
  const dom = document.createElement('div');
  host.appendChild(dom);
  document.body.appendChild(host);
  return {
    isDestroyed: options.destroyed ?? false,
    isEditable: options.editable ?? true,
    state,
    view: { dom, hasFocus: () => options.focused ?? true },
  } as unknown as Editor;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('shouldShowBubble (009 contract §5 b4 — vendored TipTap predicate)', () => {
  it('true for a focused, editable, non-empty text selection', () => {
    expect(shouldShowBubble(editorFor(TextSelection.create(doc, 1, 6)))).toBe(true);
  });

  it('false when the editor is not editable', () => {
    expect(shouldShowBubble(editorFor(TextSelection.create(doc, 1, 6), { editable: false }))).toBe(
      false,
    );
  });

  it('false for an empty (collapsed) selection', () => {
    expect(shouldShowBubble(editorFor(TextSelection.create(doc, 3, 3)))).toBe(false);
  });

  it('false for a selection inside an empty text block', () => {
    expect(shouldShowBubble(editorFor(TextSelection.create(emptyDoc, 1, 3)))).toBe(false);
  });

  it('false when neither the view nor the menu owns focus', () => {
    expect(shouldShowBubble(editorFor(TextSelection.create(doc, 1, 6), { focused: false }))).toBe(
      false,
    );
  });

  it('true when the MENU owns focus — clicking the bubble must not dismiss it', () => {
    const menu = document.createElement('div');
    const control = document.createElement('button');
    menu.appendChild(control);
    document.body.appendChild(menu);
    control.focus();
    const editor = editorFor(TextSelection.create(doc, 1, 6), { focused: false });
    expect(shouldShowBubble(editor, menu)).toBe(true);
  });

  it('false when a menu is passed but focus lives elsewhere', () => {
    const menu = document.createElement('div');
    const outside = document.createElement('button');
    document.body.append(menu, outside);
    outside.focus();
    const editor = editorFor(TextSelection.create(doc, 1, 6), { focused: false });
    expect(shouldShowBubble(editor, menu)).toBe(false);
  });

  it('true for a node selection — not a text selection, so never "empty text"', () => {
    expect(shouldShowBubble(editorFor(NodeSelection.create(doc, 13)))).toBe(true);
  });

  it('false for destroyed and unmounted editors — and never throws', () => {
    expect(shouldShowBubble(editorFor(TextSelection.create(doc, 1, 6), { destroyed: true }))).toBe(
      false,
    );
    // tiptap v3's view getter THROWS for an unmounted editor — the predicate
    // must absorb that and answer false.
    const unmounted = {
      isDestroyed: false,
      get view(): never {
        throw new Error('[tiptap error]: The editor view is not available.');
      },
    } as unknown as Editor;
    expect(shouldShowBubble(unmounted)).toBe(false);
  });
});
