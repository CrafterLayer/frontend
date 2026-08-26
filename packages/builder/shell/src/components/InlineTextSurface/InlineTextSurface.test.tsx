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

  it('commits ONE call per change, through NATIVE listeners (the frame has no React delegation)', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    const surface = surfaceIn(container);

    type(surface, 'ab');
    type(surface, 'abc');
    expect(onCommit).toHaveBeenNthCalledWith(1, 'ab');
    expect(onCommit).toHaveBeenNthCalledWith(2, 'abc');
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('CARET SAFETY: an echo of its own value never rewrites the DOM', () => {
    const onCommit = vi.fn();
    const view = render(<InlineTextSurface value="a" onCommit={onCommit} />);
    const surface = surfaceIn(view.container);
    type(surface, 'ab');

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

  it('single-line refuses newlines in both the value and the key', () => {
    const onCommit = vi.fn();
    const { container } = render(<InlineTextSurface value="a" singleLine onCommit={onCommit} />);
    const surface = surfaceIn(container);
    type(surface, 'one\ntwo');
    expect(onCommit).toHaveBeenLastCalledWith('onetwo');

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    surface.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
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
