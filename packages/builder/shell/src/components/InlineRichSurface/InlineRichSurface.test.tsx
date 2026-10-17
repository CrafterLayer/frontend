import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InlineFormatAction, InlineSelectionAnchorReport } from '@craftkit/builder-schema';

import { plainTextOf } from '../../inline/mark-range';
import { InlineRichSurface } from './InlineRichSurface';

afterEach(cleanup);

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const hardBreakDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }],
    },
  ],
};

interface Harness {
  surface: HTMLElement;
  commits: unknown[];
  actions: InlineFormatAction[][];
  anchors: (InlineSelectionAnchorReport | null)[];
  exits: number;
  rerender: (value: unknown) => void;
}

function mount(value: unknown = doc('Select a word here')): Harness {
  const commits: unknown[] = [];
  const actions: InlineFormatAction[][] = [];
  const anchors: (InlineSelectionAnchorReport | null)[] = [];
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

/**
 * The surface BUFFERS edits and commits once (on blur, Enter, or unmount): end
 * the edit with a blur, then read the single commit it produced.
 */
const committed = (h: Harness): unknown => {
  act(() => {
    h.surface.dispatchEvent(new FocusEvent('blur'));
  });
  return h.commits.at(-1);
};

const insertText = (surface: HTMLElement, data: string): InputEvent => {
  const event = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data,
  });
  act(() => {
    surface.dispatchEvent(event);
  });
  return event;
};

const caretAtEnd = (surface: HTMLElement): void => {
  const walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  let last: Node | null = null;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    last = node;
  }
  if (last === null) {
    throw new Error('the surface must render text');
  }
  const range = document.createRange();
  range.setStart(last, (last.textContent ?? '').length);
  range.collapse(true);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

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

  it('a collapsed caret keeps the chrome with the marks DISABLED and reports no anchor', () => {
    const h = mount();
    // The surface opens focused with the caret at the end: the canvas docks
    // the bar at the surface, and nothing can be marked without characters.
    const reported = h.actions.at(-1) ?? [];
    expect(reported.map((action) => action.id)).toEqual(['bold', 'italic']);
    expect(reported.every((action) => action.disabled === true)).toBe(true);
    expect(reported.every((action) => action.pressed === false)).toBe(true);
    expect(h.anchors.at(-1) ?? null).toBeNull();
  });

  it('reports NO actions once the surface no longer owns focus', () => {
    const h = mount();
    act(() => {
      h.surface.blur();
    });
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
    expect(JSON.stringify(committed(h))).toContain('Select a line here');
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
    expect(JSON.stringify(committed(h))).toContain('"a"');
  });

  it('Backspace after a hard break removes the BREAK, never the preceding character', () => {
    const h = mount(hardBreakDoc);
    const hardBreak = h.surface.querySelector('br');
    if (hardBreak === null) {
      throw new Error('the rich surface must render its hard break');
    }
    const parent = hardBreak.parentNode;
    if (parent === null) {
      throw new Error('the rendered hard break must have a parent');
    }
    const index = Array.from(parent.childNodes).indexOf(hardBreak);
    const range = document.createRange();
    range.setStart(parent, index + 1);
    range.collapse(true);
    selectRange(range);

    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'deleteContentBackward',
    });
    act(() => {
      h.surface.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(plainTextOf(committed(h))).toBe('ab');
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
      expect(plainTextOf(committed(h))).toBe('alpha ');
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
    expect(plainTextOf(committed(h))).toBe('a');
  });

  it.each([
    'insertCompositionText',
    'deleteCompositionText',
    'deleteByComposition',
    'formatBold',
    'historyUndo',
    'historyRedo',
  ])('%s is deliberately refused rather than corrupting document truth', (inputType) => {
    const h = mount();
    const event = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType,
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

  it('Tab reaches formatting chrome and its bookmark restores the exact selection', () => {
    const menu = document.createElement('div');
    const boldButton = document.createElement('button');
    menu.append(boldButton);
    document.body.append(menu);
    const actions: InlineFormatAction[][] = [];
    const commits: unknown[] = [];
    const bookmark: { restore: (() => void) | null } = { restore: null };
    const requestFormattingMenuFocus = vi.fn((restore: () => void) => {
      bookmark.restore = restore;
      boldButton.focus();
      return boldButton.ownerDocument.activeElement === boldButton;
    });
    const view = render(
      <InlineRichSurface
        value={doc('Select a word here')}
        label="body"
        onCommit={(next) => commits.push(next)}
        onExit={vi.fn()}
        onAnchor={vi.fn()}
        onActions={(next) => actions.push(next)}
        requestFormattingMenuFocus={requestFormattingMenuFocus}
        formattingMenuElement={menu}
      />,
    );
    const surface = view.container.querySelector<HTMLElement>('.bldr-inline-rich');
    if (surface === null) {
      throw new Error('the rich surface must render');
    }
    selectWord(surface, 'word');
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      surface.dispatchEvent(tab);
    });

    expect(requestFormattingMenuFocus).toHaveBeenCalledTimes(1);
    expect(tab.defaultPrevented).toBe(true);
    expect(boldButton.ownerDocument.activeElement).toBe(boldButton);
    expect(document.getSelection()?.toString()).toBe('word');

    // Prove the action owns a semantic bookmark, not the browser's incidental
    // retained Range: erase the live range, then run the already-reported action.
    document.getSelection()?.removeAllRanges();
    const bold = (actions.at(-1) ?? []).find((action) => action.id === 'bold');
    act(() => {
      bold?.run();
    });
    expect(JSON.stringify(commits.at(-1))).toContain('"word"');
    expect(JSON.stringify(commits.at(-1))).toContain('"bold"');

    act(() => {
      bookmark.restore?.();
    });
    expect(surface).toHaveFocus();
    expect(document.getSelection()?.toString()).toBe('word');
    menu.remove();
  });

  it('Tab stays native when no enabled formatting destination accepts focus', () => {
    const requestFormattingMenuFocus = vi.fn(() => false);
    const view = render(
      <InlineRichSurface
        value={doc('Select a word here')}
        label="body"
        onCommit={vi.fn()}
        onExit={vi.fn()}
        onAnchor={vi.fn()}
        onActions={vi.fn()}
        requestFormattingMenuFocus={requestFormattingMenuFocus}
      />,
    );
    const surface = view.container.querySelector<HTMLElement>('.bldr-inline-rich');
    if (surface === null) {
      throw new Error('the rich surface must render');
    }
    selectWord(surface, 'word');
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      surface.dispatchEvent(tab);
    });

    expect(requestFormattingMenuFocus).toHaveBeenCalledTimes(1);
    expect(tab.defaultPrevented).toBe(false);
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

  it('COMMIT ONCE: several keystrokes stage a draft; one blur commits it once', () => {
    const h = mount(doc('Hi'));
    caretAtEnd(h.surface);
    insertText(h.surface, ' t');
    caretAtEnd(h.surface);
    insertText(h.surface, 'he');
    caretAtEnd(h.surface);
    insertText(h.surface, 're');
    // Typing shows on screen but is NOT handed to the host per keystroke.
    expect(h.surface.textContent).toBe('Hi there');
    expect(h.commits).toHaveLength(0);

    expect(plainTextOf(committed(h))).toBe('Hi there');
    expect(h.commits).toHaveLength(1);
    // A second blur with nothing new commits nothing.
    committed(h);
    expect(h.commits).toHaveLength(1);
  });

  it('Enter finishes the edit with ONE commit; Shift+Enter is inert', () => {
    const h = mount(doc('Hi'));
    caretAtEnd(h.surface);
    insertText(h.surface, '!');
    const shiftEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      h.surface.dispatchEvent(shiftEnter);
    });
    expect(shiftEnter.defaultPrevented).toBe(true);
    expect(h.commits).toHaveLength(0);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => {
      h.surface.dispatchEvent(enter);
    });
    expect(enter.defaultPrevented).toBe(true);
    expect(h.commits).toHaveLength(1);
    expect(plainTextOf(h.commits[0])).toBe('Hi!');
  });

  it('Escape CANCELS: the draft is discarded, nothing is committed, the stored text shows', () => {
    const h = mount(doc('Stored'));
    caretAtEnd(h.surface);
    insertText(h.surface, ' draft');
    expect(h.surface.textContent).toBe('Stored draft');

    act(() => {
      h.surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(h.exits).toBe(1);
    expect(h.surface.textContent).toBe('Stored');
    committed(h); // the blur that follows the focus hand-off
    expect(h.commits).toHaveLength(0);
  });

  it('IGNORES incoming values while a draft is unsaved (history replay never eats typing)', () => {
    const h = mount(doc('Hi'));
    caretAtEnd(h.surface);
    insertText(h.surface, '!');
    h.rerender(doc('Replayed'));
    expect(h.surface.textContent).toBe('Hi!');

    expect(plainTextOf(committed(h))).toBe('Hi!');
    // Once committed, the next stored value shows through again.
    h.rerender(doc('After undo'));
    expect(h.surface.textContent).toBe('After undo');
  });

  it('a draft whose session ends before any blur is committed on unmount, once', () => {
    const commits: unknown[] = [];
    const view = render(
      <InlineRichSurface
        value={doc('Hi')}
        label="body"
        onCommit={(next) => commits.push(next)}
        onExit={vi.fn()}
        onAnchor={vi.fn()}
        onActions={vi.fn()}
      />,
    );
    const surface = view.container.querySelector<HTMLElement>('.bldr-inline-rich');
    if (surface === null) {
      throw new Error('the rich surface must render');
    }
    caretAtEnd(surface);
    insertText(surface, ' you');
    view.unmount();
    expect(commits).toHaveLength(1);
    expect(plainTextOf(commits[0])).toBe('Hi you');
  });

  it('Arabic and English both edit in place, with direction from the content', () => {
    const h = mount(doc('مرحبا'));
    expect(h.surface.getAttribute('dir')).toBe('auto');
    caretAtEnd(h.surface);
    insertText(h.surface, ' بالعالم');
    expect(plainTextOf(committed(h))).toBe('مرحبا بالعالم');

    const english = mount(doc('Your site'));
    caretAtEnd(english.surface);
    insertText(english.surface, ' grows.');
    expect(plainTextOf(committed(english))).toBe('Your site grows.');
  });

  it('an EXTERNAL change (undo, collaborator) shows through', () => {
    const h = mount();
    h.rerender(doc('Restored by undo'));
    expect(h.surface.textContent).toBe('Restored by undo');
  });
});
