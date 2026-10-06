import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InlineTextSurface } from './InlineTextSurface';

afterEach(cleanup);

const surfaceIn = (container: HTMLElement): HTMLElement => {
  const element = container.querySelector<HTMLElement>('.bldr-inline-text');
  if (element === null) {
    throw new Error('the surface must render');
  }
  return element;
};

const type = (element: HTMLElement, text: string) => {
  element.textContent = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

const key = (element: HTMLElement, name: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
  act(() => {
    element.dispatchEvent(event);
  });
  return event;
};

const blur = (element: HTMLElement) => {
  act(() => {
    element.dispatchEvent(new FocusEvent('blur'));
  });
};

describe('InlineTextSurface (009 contract §4 t1)', () => {
  it('renders the stored value and exposes itself as a named textbox', () => {
    const { container } = render(
      <InlineTextSurface value="Hello" label="heading" onCommit={vi.fn()} />,
    );
    const surface = surfaceIn(container);
    expect(surface.textContent).toBe('Hello');
    expect(surface.getAttribute('role')).toBe('textbox');
    expect(surface.getAttribute('aria-label')).toBe('heading');
  });

  it('coerces a nullish value to empty — never the literal text "null"', () => {
    for (const value of [null, undefined, 42, { a: 1 }]) {
      const { container, unmount } = render(<InlineTextSurface value={value} onCommit={vi.fn()} />);
      expect(surfaceIn(container).textContent).toBe('');
      unmount();
    }
  });

  it('BUFFERS keystrokes and commits ONCE on blur (law L1: one gesture, one Undo)', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    const surface = surfaceIn(container);

    type(surface, 'ab');
    type(surface, 'abc');
    type(surface, 'abcd');
    expect(onCommit).not.toHaveBeenCalled();

    blur(surface);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abcd', 'blur');
  });

  it('Enter commits once; a later blur with nothing new commits nothing', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="a" singleLine onCommit={onCommit} />);
    const surface = surfaceIn(container);
    type(surface, 'a b');
    type(surface, 'a bc');

    const enter = key(surface, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('a bc', 'enter');

    blur(surface);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('an unchanged value commits nothing — no empty transaction', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="same" onCommit={onCommit} />);
    const surface = surfaceIn(container);
    type(surface, 'same');
    key(surface, 'Enter');
    blur(surface);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Escape CANCELS: the draft is discarded and the blur after exit commits nothing', () => {
    const onCommit = vi.fn();
    const onExit = vi.fn();
    const { container } = render(
      <InlineTextSurface value="Original" onCommit={onCommit} onExit={onExit} />,
    );
    const surface = surfaceIn(container);
    type(surface, 'Original but changed');

    key(surface, 'Escape');
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(surface.textContent).toBe('Original');
    blur(surface);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a draft whose session ends before any blur is committed on unmount, once', () => {
    const onCommit = vi.fn();
    const view = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    type(surfaceIn(view.container), 'kept');
    view.unmount();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('kept', 'blur');
  });

  it('multiline: Shift+Enter inserts a line feed, Enter commits the whole text', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="" onCommit={onCommit} />);
    const surface = surfaceIn(container);
    surface.textContent = 'one';
    const caret = document.createRange();
    caret.selectNodeContents(surface);
    caret.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(caret);

    const shiftEnter = key(surface, 'Enter', { shiftKey: true });
    expect(shiftEnter.defaultPrevented).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
    surface.append('two');
    surface.dispatchEvent(new Event('input', { bubbles: true }));

    key(surface, 'Enter');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('one\ntwo', 'enter');
    expect(surface.getAttribute('aria-multiline')).toBe('true');
  });

  it('IGNORES incoming values while a draft is unsaved (history replay never eats typing)', () => {
    const onCommit = vi.fn();
    const view = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    const surface = surfaceIn(view.container);
    type(surface, 'typing in progress');
    view.rerender(<InlineTextSurface value="replayed by undo" onCommit={onCommit} />);
    expect(surface.textContent).toBe('typing in progress');

    blur(surface);
    expect(onCommit).toHaveBeenCalledWith('typing in progress', 'blur');
    // Once the draft is committed, document truth shows through again.
    view.rerender(<InlineTextSurface value="restored" onCommit={onCommit} />);
    expect(surface.textContent).toBe('restored');
  });

  it('edits Arabic and English alike, with direction taken from the content', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="مرحبا" onCommit={onCommit} />);
    const surface = surfaceIn(container);
    expect(surface.getAttribute('dir')).toBe('auto');
    expect(surface.textContent).toBe('مرحبا');

    type(surface, 'مرحبا بالعالم');
    key(surface, 'Enter');
    expect(onCommit).toHaveBeenLastCalledWith('مرحبا بالعالم', 'enter');

    type(surface, 'Your site grows.');
    blur(surface);
    expect(onCommit).toHaveBeenLastCalledWith('Your site grows.', 'blur');
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('CARET SAFETY: an echo of its own value never rewrites the DOM', () => {
    const onCommit = vi.fn();
    const view = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    const surface = surfaceIn(view.container);
    type(surface, 'ab');
    key(surface, 'Enter');

    // The host commits and hands the same text back — the value the surface
    // already shows. Rewriting here is what resets a caret mid-typing.
    const before = surface.firstChild;
    view.rerender(<InlineTextSurface value="ab" onCommit={onCommit} />);
    expect(surface.firstChild).toBe(before);
  });

  it('an EXTERNAL change (undo, collaborator) does rewrite the DOM', () => {
    const view = render(<InlineTextSurface value="ab" onCommit={vi.fn()} />);
    const surface = surfaceIn(view.container);
    view.rerender(<InlineTextSurface value="restored" onCommit={vi.fn()} />);
    expect(surface.textContent).toBe('restored');
  });

  it('single-line refuses newlines in the value, on Enter, Shift+Enter and line-break input', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="a" singleLine onCommit={onCommit} />);
    const surface = surfaceIn(container);
    type(surface, 'one\ntwo');
    const shiftEnter = key(surface, 'Enter', { shiftKey: true });
    expect(shiftEnter.defaultPrevented).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();

    const lineBreak = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertLineBreak',
    });
    surface.dispatchEvent(lineBreak);
    expect(lineBreak.defaultPrevented).toBe(true);

    key(surface, 'Enter');
    expect(onCommit).toHaveBeenLastCalledWith('onetwo', 'enter');
    expect(surface.getAttribute('aria-multiline')).toBeNull();
  });

  it('Escape exits; other keys never reach the canvas behind it', () => {
    const onExit = vi.fn();
    const { container } = render(
      <InlineTextSurface value="a" onCommit={vi.fn()} onExit={onExit} />,
    );
    const surface = surfaceIn(container);

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    surface.dispatchEvent(escape);
    expect(onExit).toHaveBeenCalledTimes(1);

    // Arrow keys move the CARET here — the canvas must never see them and move
    // the selection instead.
    let sawArrow = false;
    document.addEventListener('keydown', () => (sawArrow = true));
    surface.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(sawArrow).toBe(false);
  });

  it('clicks place the caret without re-entering the canvas selection path', () => {
    let sawClick = false;
    document.addEventListener('click', () => (sawClick = true));
    const { container } = render(<InlineTextSurface value="a" onCommit={vi.fn()} />);
    surfaceIn(container).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sawClick).toBe(false);
  });

  it('is editable on the FIRST render, not one render later', () => {
    // A programmatic focus updates state on the next render; a keystroke in
    // that gap is dropped by a real browser. The surface mounts live.
    const { container } = render(<InlineTextSurface value="a" onCommit={vi.fn()} />);
    const surface = surfaceIn(container);
    expect(surface.getAttribute('contenteditable')).toBe('plaintext-only');
    expect(surface).toHaveFocus();
  });

  it('SAFARI GUARD: inert once neither hovered NOR focused (webkit 112854)', () => {
    const { container } = render(<InlineTextSurface value="a" onCommit={vi.fn()} />);
    const surface = surfaceIn(container);

    // Focused: the pointer leaving must NOT interrupt an edit in progress.
    act(() => {
      surface.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
    expect(surface.getAttribute('contenteditable')).toBe('plaintext-only');

    // Neither hovered nor focused: inert, so a drag cannot focus it.
    act(() => {
      surface.dispatchEvent(new FocusEvent('blur'));
    });
    expect(surface.getAttribute('contenteditable')).toBe('false');

    // Hover alone brings it back — the click that follows lands on a live field.
    act(() => {
      surface.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    expect(surface.getAttribute('contenteditable')).toBe('plaintext-only');
  });

  it('detaches every listener on unmount', () => {
    const onCommit = vi.fn();
    const view = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    const surface = surfaceIn(view.container);
    view.unmount();
    type(surface, 'after');
    expect(onCommit).not.toHaveBeenCalled();
  });
});
