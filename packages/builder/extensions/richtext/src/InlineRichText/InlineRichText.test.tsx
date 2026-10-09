import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useState } from 'react';

import { act, cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Editor } from '@tiptap/react';

import type { RichTextDoc } from '@craftkit/builder-schema';

import { InlineRichText } from './InlineRichText';
import type { SelectionAnchorReport } from './selection-anchor';

// ProseMirror measures selection geometry jsdom does not implement — inert
// stubs keep the EDITING logic (the part under test) fully real (the
// RichTextField.test.tsx pattern).
beforeAll(() => {
  Range.prototype.getClientRects = function getClientRectsStub() {
    return [] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
    return new DOMRect(0, 0, 0, 0);
  };
});

afterEach(cleanup);

const seed = (text: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

/** Mimics the canvas seam's wiring: document-truth value + committed writes. */
function Harness({
  onCommit,
  onExit,
  onSelectionChange,
  onEditor,
}: {
  onCommit?: (next: RichTextDoc) => void;
  onExit?: () => void;
  onSelectionChange?: (report: SelectionAnchorReport | null) => void;
  onEditor: (editor: Editor) => void;
}) {
  const [value, setValue] = useState<unknown>(seed('Start'));
  return (
    <InlineRichText
      label="Article body"
      value={value}
      onCommit={(next) => {
        setValue(next);
        onCommit?.(next);
      }}
      onExit={onExit}
      onSelectionChange={onSelectionChange}
      onEditorReady={onEditor}
    />
  );
}

const surfaceOf = (): HTMLElement => {
  const surface = document.querySelector('.bldr-richtext-field__surface');
  expect(surface).not.toBeNull();
  return surface as HTMLElement;
};

describe('InlineRichText — the canvas rich surface (009 contract §4 t2)', () => {
  it('adopts the caret the canvas placed at the click point when focus arrives', async () => {
    let editor: Editor | null = null;
    render(
      <Harness
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const surface = surfaceOf();
    const text = surface.querySelector('p')?.firstChild;
    expect(text?.nodeType).toBe(Node.TEXT_NODE);
    // What the canvas does on a double-click: a DOM caret at the clicked letter.
    const range = document.createRange();
    range.setStart(text as Node, 3);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    act(() => {
      surface.dispatchEvent(new FocusEvent('focus'));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    // "Sta|rt": position 1 opens the paragraph, so the caret is at 1 + 3.
    expect((editor as Editor | null)?.state.selection.from).toBe(4);
  });

  it('one commit per update, ZERO on mount — and no block toolbar on the canvas', () => {
    const onCommit = vi.fn();
    let editor: Editor | null = null;
    render(
      <Harness
        onCommit={onCommit}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    expect(editor).not.toBeNull();
    const ed = editor as unknown as Editor;
    // The regression law: editor creation must never emit a phantom commit.
    expect(onCommit).not.toHaveBeenCalled();
    // The bubble replaces the block toolbar on the canvas — no toolbar here.
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Formatting' })).not.toBeInTheDocument();

    act(() => {
      ed.chain().focus('end').insertContent(' more').run();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onCommit.mock.calls[0]?.[0])).toContain('Start more');

    act(() => {
      ed.chain().selectAll().toggleBold().run();
    });
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(onCommit.mock.calls[1]?.[0])).toContain('"bold"');
  });

  it('Escape calls onExit and commits nothing', () => {
    const onCommit = vi.fn();
    const onExit = vi.fn();
    render(<Harness onCommit={onCommit} onExit={onExit} onEditor={() => undefined} />);
    act(() => {
      fireEvent.keyDown(surfaceOf(), { key: 'Escape' });
    });
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('leaves forward Tab native when the host provides no formatting-focus bridge', () => {
    let editor: Editor | null = null;
    render(
      <Harness
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    const tab = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    });

    act(() => {
      ed.view.dom.dispatchEvent(tab);
    });

    expect(tab.defaultPrevented).toBe(false);
  });

  it('contains native canvas gestures while Escape still exits the inline session', () => {
    const onExit = vi.fn();
    render(<Harness onExit={onExit} onEditor={() => undefined} />);
    const surface = surfaceOf();
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const onDoubleClick = vi.fn();
    const onKeyDown = vi.fn();
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('click', onClick);
    document.addEventListener('dblclick', onDoubleClick);
    document.addEventListener('keydown', onKeyDown);

    try {
      const pointerDown = createEvent.pointerDown(surface);
      fireEvent(surface, pointerDown);
      const click = createEvent.click(surface);
      fireEvent(surface, click);
      const doubleClick = createEvent.dblClick(surface);
      fireEvent(surface, doubleClick);
      fireEvent.keyDown(surface, { key: 'ArrowRight' });

      expect(onPointerDown).not.toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
      expect(onDoubleClick).not.toHaveBeenCalled();
      expect(onKeyDown).not.toHaveBeenCalled();
      // Containment must not cancel the editor's own selection/caret behavior.
      expect(pointerDown.defaultPrevented).toBe(false);
      expect(click.defaultPrevented).toBe(false);
      expect(doubleClick.defaultPrevented).toBe(false);

      fireEvent.keyDown(surface, { key: 'Escape' });
      expect(onExit).toHaveBeenCalledTimes(1);
      // Escape remains the session-level gesture and may reach the canvas's
      // idempotent exit listener; only ordinary editing keys are contained.
      expect(onKeyDown).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('click', onClick);
      document.removeEventListener('dblclick', onDoubleClick);
      document.removeEventListener('keydown', onKeyDown);
    }
  });

  it('selection channel: a deferred source for a selection, null on collapse and unmount', () => {
    const onSelection = vi.fn();
    let editor: Editor | null = null;
    const view = render(
      <Harness
        onSelectionChange={onSelection}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    // Mount reports a defined initial state: no focus, so no bubble.
    expect(onSelection).toHaveBeenLastCalledWith(null);

    act(() => {
      // The focus COMMAND defers to requestAnimationFrame (tiptap) — focus the
      // view directly so jsdom sees it synchronously.
      ed.view.dom.focus();
      ed.commands.setTextSelection({ from: 1, to: 6 });
    });
    const report = onSelection.mock.lastCall?.[0] as SelectionAnchorReport | null;
    expect(report).toEqual({ measure: expect.any(Function) as () => unknown });
    // Geometry correctness stays in selection-anchor.test.ts; the adapter's
    // merge gate proves this source is invoked only by a scheduled flush.

    act(() => {
      ed.chain().setTextSelection({ from: 3, to: 3 }).run();
    });
    expect(onSelection).toHaveBeenLastCalledWith(null);

    act(() => {
      ed.chain().setTextSelection({ from: 1, to: 6 }).run();
    });
    expect(onSelection.mock.lastCall?.[0]).not.toBeNull();

    // Editing ended (unmount): the channel closes with null — never a
    // stranded bubble (§5 b1).
    view.unmount();
    expect(onSelection).toHaveBeenLastCalledWith(null);
  });

  it('a queued anchor source rechecks eligibility when the selection collapses before measurement', () => {
    const onSelection = vi.fn();
    let editor: Editor | null = null;
    render(
      <Harness
        onSelectionChange={onSelection}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;

    act(() => {
      ed.view.dom.focus();
      ed.commands.setTextSelection({ from: 1, to: 6 });
    });
    const report = onSelection.mock.lastCall?.[0] as SelectionAnchorReport | null | undefined;
    if (report === null || report === undefined || !('measure' in report)) {
      throw new Error('A selected editor must report a deferred anchor source');
    }

    act(() => {
      ed.commands.setTextSelection({ from: 3, to: 3 });
    });
    expect(report.measure()).toBeNull();
  });

  it('document truth: an external value re-seeds the editor with ZERO commits', () => {
    const onCommit = vi.fn();
    let editor: Editor | null = null;
    const capture = (instance: Editor) => {
      editor = instance;
    };
    const view = render(
      <InlineRichText
        label="Article body"
        value={seed('Start')}
        onCommit={onCommit}
        onEditorReady={capture}
      />,
    );
    const ed = editor as unknown as Editor;
    expect(ed.getText()).toBe('Start');

    view.rerender(
      <InlineRichText
        label="Article body"
        value={seed('Restored')}
        onCommit={onCommit}
        onEditorReady={capture}
      />,
    );
    expect(ed.getText()).toBe('Restored');
    // The regression law: re-seeds and re-renders never emit a phantom commit.
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('the surface is a named, multiline textbox following its content direction', () => {
    render(<Harness onEditor={() => undefined} />);
    const surface = screen.getByRole('textbox', { name: 'Article body' });
    expect(surface).toHaveAttribute('aria-multiline', 'true');
    expect(surface).toHaveAttribute('dir', 'auto');
    expect(surface).toHaveClass('bldr-richtext-field__surface');
  });

  /**
   * EDITING MUST NOT RESIZE THE BLOCK.
   *
   * Inline editing replaces the rendered `.bldr-richtext` wrapper with this
   * editor, and the prose typography used to leave with it: paragraphs fell
   * back to the user agent's 1em margins where the page renders 0.5em, and the
   * editor set its lines at the host's `normal` where the page sets 1.6. A
   * rich-text block therefore CHANGED HEIGHT the moment you clicked into it —
   * measured in Chromium at 122px rendered against 115px editing, and 40px
   * against 83px on an empty one.
   *
   * jsdom resolves no cascade, so the fix is held as a SOURCE contract: the
   * surface must carry the renderer's prose class, the field's panel
   * typography must stand down for it, and the inline sheet must not re-declare
   * the typography it once used to escape that panel scale.
   */
  it('writes inside the renderer prose context so editing cannot resize the block', () => {
    render(<Harness onEditor={() => undefined} />);
    const surface = screen.getByRole('textbox', { name: 'Article body' });
    expect(surface).toHaveClass('bldr-richtext');
  });
});

describe('the prose context is one stylesheet, not two', () => {
  const read = (file: string) =>
    readFileSync(join(process.cwd(), 'src', file), 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '');

  const fieldCss = read('RichTextField/RichTextField.css');
  const inlineCss = read('InlineRichText/InlineRichText.css');

  it('lets the panel scale apply only where no prose context was supplied', () => {
    // Both rules are ONE class, so leaving this to the cascade would let the
    // bundler's load order decide which typography a canvas surface gets.
    expect(fieldCss).toContain('.bldr-richtext-field__surface:not(.bldr-richtext)');

    const gated = fieldCss.slice(fieldCss.indexOf('.bldr-richtext-field__surface:not('));
    const body = gated.slice(gated.indexOf('{'), gated.indexOf('}'));
    expect(body).toContain('font-size');
    expect(body).toContain('line-height');
  });

  it('leaves prose typography to the prose class, never restating it inline', () => {
    const rule = inlineCss.slice(
      inlineCss.indexOf('.bldr-inline-richtext .bldr-richtext-field__surface'),
    );
    const body = rule.slice(rule.indexOf('{'), rule.indexOf('}'));

    // Non-vacuous: the rule must still exist and still do its real job.
    expect(body).toContain('min-block-size');
    // These two are what defeated the prose class and resized the block.
    expect(body).not.toContain('font-size');
    expect(body).not.toContain('line-height');
  });
});
