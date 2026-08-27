import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InlineFormatAction, InlineSelectionAnchor } from '@craftkit/builder-schema';

import { plainTextOf } from '../../inline/mark-range';
import { InlineRichSurface } from './InlineRichSurface';

afterEach(cleanup);

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

interface Harness {
  surface: HTMLElement;
  commits: unknown[];
  actions: InlineFormatAction[][];
  anchors: (InlineSelectionAnchor | null)[];
  exits: number;
  rerender: (value: unknown) => void;
}

function mount(value: unknown = doc('Select a word here')): Harness {
  const commits: unknown[] = [];
  const actions: InlineFormatAction[][] = [];
  const anchors: (InlineSelectionAnchor | null)[] = [];
  const state = { exits: 0 };
  const view = render(
    <InlineRichSurface
      value={value}
      label="body"
      onCommit={(next) => commits.push(next)}
      onExit={() => (state.exits += 1)}
      onAnchor={(anchor) => anchors.push(anchor)}
      onActions={(next) => actions.push(next)}
    />,
  );
  const surface = view.container.querySelector<HTMLElement>('.bldr-inline-rich');
  if (surface === null) {
    throw new Error('the surface must render');
  }
  return {
    surface,
    commits,
    actions,
    anchors,
    get exits() {
      return state.exits;
    },
    rerender: (next: unknown) => {
      view.rerender(
        <InlineRichSurface
          value={next}
          label="body"
          onCommit={(committed) => commits.push(committed)}
          onExit={() => (state.exits += 1)}
          onAnchor={(anchor) => anchors.push(anchor)}
          onActions={(list) => actions.push(list)}
        />,
      );
    },
  };
}

/** Put a real DOM selection over [from,to) of the surface's first text node. */
const selectWord = (surface: HTMLElement, word: string) => {
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode();
  if (first === null) {
    throw new Error('the surface must render text');
  }
  const at = (first.textContent ?? '').indexOf(word);
  const range = document.createRange();
  range.setStart(first, at);
  range.setEnd(first, at + word.length);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  act(() => {
    document.dispatchEvent(new Event('selectionchange'));
  });
};

const rangeInFirstText = (surface: HTMLElement, from: number, to: number): Range => {
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode();
  if (first === null) {
    throw new Error('the surface must render text');
  }
  const range = document.createRange();
  range.setStart(first, from);
  range.setEnd(first, to);
  return range;
};

const selectRange = (range: Range): void => {
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const deletionEvent = (
  inputType: string,
  targetRanges: readonly Range[] | 'unavailable',
): InputEvent => {
  const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType });
  Object.defineProperty(event, 'getTargetRanges', {
    configurable: true,
    value: targetRanges === 'unavailable' ? undefined : () => targetRanges,
  });
  return event;
};

const STANDARD_TARGET_DELETIONS = [
  'deleteWordBackward',
  'deleteWordForward',
  'deleteSoftLineBackward',
  'deleteSoftLineForward',
  'deleteByCut',
  'deleteByDrag',
  'deleteEntireSoftLine',
] as const;

describe('InlineRichSurface (009 contract §15)', () => {
  it('renders the stored document as a named, focused multiline textbox', () => {
    const h = mount();
    expect(h.surface.getAttribute('role')).toBe('textbox');
    expect(h.surface.getAttribute('aria-label')).toBe('body');
    expect(h.surface.getAttribute('aria-multiline')).toBe('true');
    expect(h.surface.getAttribute('contenteditable')).toBe('true');
    expect(h.surface.textContent).toBe('Select a word here');
    // Live on the FIRST paint: a keystroke into a not-yet-focused surface is
    // dropped by a real browser.
    expect(h.surface).toHaveFocus();
  });

  it('reports NO actions without a selection — that is how the bubble stays hidden', () => {
    const h = mount();
    expect(h.actions.at(-1) ?? []).toEqual([]);
    expect(h.anchors.at(-1) ?? null).toBeNull();
  });

  it('a live selection reports bold and italic, with pressed reflecting the document', () => {
    const h = mount();
    selectWord(h.surface, 'word');
    const reported = h.actions.at(-1) ?? [];
    expect(reported.map((action) => action.label)).toEqual(['Bold', 'Italic']);
    // Nothing is marked yet, so neither toggle reads as pressed.
    expect(reported.every((action) => action.pressed === false)).toBe(true);
  });

  it('running an action commits ONE document that marks exactly the selection', () => {
    const h = mount();
    selectWord(h.surface, 'word');
    const bold = (h.actions.at(-1) ?? []).find((action) => action.id === 'bold');
    act(() => {
      bold?.run();
    });

    expect(h.commits).toHaveLength(1);
    const committed = JSON.stringify(h.commits[0]);
    // The marked run carries the SELECTED word and nothing else…
    expect(committed).toContain('"bold"');
    expect(committed).toContain('"word"');
    // …and the text is unchanged — formatting marks, it never rewrites.
    expect(committed).toContain('Select a ');
    expect(committed).toContain(' here');
  });

  it('typing replaces the selection through the document, never the DOM', () => {
    const h = mount();
    selectWord(h.surface, 'word');
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: 'line',
    });
    act(() => {
      h.surface.dispatchEvent(event);
    });
    // The browser's own mutation is REFUSED: React stays the authority.
    expect(event.defaultPrevented).toBe(true);
    expect(JSON.stringify(h.commits.at(-1))).toContain('Select a line here');
  });

  it('backspace with a caret deletes exactly one character', () => {
    const h = mount(doc('ab'));
    const walker = document.createTreeWalker(h.surface, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    const range = document.createRange();
    if (first !== null) {
      range.setStart(first, 2);
      range.setEnd(first, 2);
    }
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    act(() => {
      h.surface.dispatchEvent(
        new InputEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'deleteContentBackward',
        }),
      );
    });
    expect(JSON.stringify(h.commits.at(-1))).toContain('"a"');
  });

  it.each(STANDARD_TARGET_DELETIONS)(
    '%s deletes the exact browser target range instead of swallowing the command',
    (inputType) => {
      const h = mount(doc('alpha beta'));
      const target = rangeInFirstText(h.surface, 6, 10);
      // Keep the live selection collapsed: if target ranges are ignored, the
      // legacy fallback removes only one character and this guard fails.
      selectRange(rangeInFirstText(h.surface, 10, 10));
      const event = deletionEvent(inputType, [target]);
      act(() => {
        h.surface.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      expect(plainTextOf(h.commits.at(-1))).toBe('alpha ');
    },
  );

  it.each([
    ['an unavailable getTargetRanges', 'unavailable' as const],
    ['an empty getTargetRanges result', [] as const],
  ])('%s falls back to one-character deletion at a collapsed caret', (_name, targetRanges) => {
    const h = mount(doc('ab'));
    selectRange(rangeInFirstText(h.surface, 2, 2));
    const event = deletionEvent('deleteWordBackward', targetRanges);
    act(() => {
      h.surface.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(plainTextOf(h.commits.at(-1))).toBe('a');
  });

  it('refuses inputs it does not model rather than corrupting the document', () => {
    const h = mount();
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'formatBold',
    });
    act(() => {
      h.surface.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(h.commits).toHaveLength(0);
  });

  it('refuses input it cannot place — the DOM never drifts from the document', () => {
    // With no resolvable position the surface must still preventDefault: an
    // unhandled beforeinput lets the raw contenteditable write into the DOM
    // behind the document's back, and a controlled surface can never allow it.
    const h = mount();
    document.getSelection()?.removeAllRanges();
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: 'x',
    });
    act(() => {
      h.surface.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('Escape exits; caret keys never reach the canvas behind it', () => {
    const h = mount();
    act(() => {
      h.surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.exits).toBe(1);

    let sawArrow = false;
    const listener = () => (sawArrow = true);
    document.addEventListener('keydown', listener);
    act(() => {
      h.surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    document.removeEventListener('keydown', listener);
    expect(sawArrow).toBe(false);
  });

  it('clicks place the caret without re-entering the canvas selection path', () => {
    let sawClick = false;
    const listener = () => (sawClick = true);
    document.addEventListener('click', listener);
    const h = mount();
    act(() => {
      h.surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    document.removeEventListener('click', listener);
    expect(sawClick).toBe(false);
  });

  it('retires the bubble on unmount — a stranded toolbar is a bug', () => {
    const onAnchor = vi.fn();
    const onActions = vi.fn();
    const view = render(
      <InlineRichSurface
        value={doc('text')}
        label="body"
        onCommit={vi.fn()}
        onExit={vi.fn()}
        onAnchor={onAnchor}
        onActions={onActions}
      />,
    );
    view.unmount();
    expect(onAnchor).toHaveBeenLastCalledWith(null);
    expect(onActions).toHaveBeenLastCalledWith([]);
  });

  it('an EXTERNAL change (undo, collaborator) shows through', () => {
    const h = mount();
    h.rerender(doc('Restored by undo'));
    expect(h.surface.textContent).toBe('Restored by undo');
  });
});
