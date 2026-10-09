import { useState } from 'react';

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Editor } from '@tiptap/react';

import { createAnchorChannel, type FrameBridge, type RectIndex } from '@craftkit/builder-shell';
import type {
  InlineEditorProps,
  InlineFormatAction,
  InlineSelectionAnchor,
  RichTextDoc,
} from '@craftkit/builder-schema';

import InlineRichTextEditor from './inline-editor';

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

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const seed = (text: string): RichTextDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

/** Mimics the canvas wiring: document-truth value + committed writes. */
function Harness({
  onCommit,
  onAnchor,
  onActions,
  onEditor,
  formattingMenuElement,
  requestFormattingMenuFocus,
}: {
  onCommit: (next: unknown) => void;
  onAnchor: (anchor: unknown) => void;
  onActions: (actions: InlineFormatAction[]) => void;
  onEditor: (editor: Editor) => void;
  formattingMenuElement?: Element | null | undefined;
  requestFormattingMenuFocus?: InlineEditorProps['requestFormattingMenuFocus'];
}) {
  const [value, setValue] = useState<unknown>(seed('Start'));
  return (
    <InlineRichTextEditor
      value={value}
      label="Article body"
      onCommit={(next) => {
        setValue(next);
        onCommit(next);
      }}
      onExit={() => undefined}
      onAnchor={onAnchor}
      onActions={onActions}
      onEditorReady={onEditor}
      {...(formattingMenuElement === undefined ? {} : { formattingMenuElement })}
      {...(requestFormattingMenuFocus === undefined ? {} : { requestFormattingMenuFocus })}
    />
  );
}

function mount(
  formattingMenuElement?: Element | null,
  requestFormattingMenuFocus?: InlineEditorProps['requestFormattingMenuFocus'],
) {
  const onCommit = vi.fn();
  const onAnchor = vi.fn();
  const onActions = vi.fn();
  let editor: Editor | null = null;
  const view = render(
    <Harness
      onCommit={onCommit}
      onAnchor={onAnchor}
      onActions={onActions}
      onEditor={(instance) => {
        editor = instance;
      }}
      {...(formattingMenuElement === undefined ? {} : { formattingMenuElement })}
      {...(requestFormattingMenuFocus === undefined ? {} : { requestFormattingMenuFocus })}
    />,
  );
  expect(editor).not.toBeNull();
  return { onCommit, onAnchor, onActions, view, ed: editor as unknown as Editor };
}

const lastActions = (onActions: ReturnType<typeof vi.fn>): InlineFormatAction[] =>
  onActions.mock.lastCall?.[0] as InlineFormatAction[];

const selectStart = (ed: Editor) => {
  act(() => {
    // The focus COMMAND defers to requestAnimationFrame (tiptap) — focus the
    // view directly so jsdom sees it synchronously.
    ed.view.dom.focus();
    ed.commands.setTextSelection({ from: 1, to: 6 });
  });
};

describe('inline-editor — the registry adapter (009 inlineEditors contribution)', () => {
  it('T036: TipTap selection geometry is read once per coalesced anchor flush', () => {
    const queue: (() => void)[] = [];
    const snapshots: (InlineSelectionAnchor | null)[] = [];
    const channel = createAnchorChannel({
      index: {
        rect: () => undefined,
        onInvalidate: () => () => undefined,
      } as unknown as RectIndex,
      bridge: {
        frameBox: () => ({ x: 0, y: 0, width: 400, height: 300 }),
        hostViewport: () => ({ width: 800, height: 600 }),
        visibleArea: () => ({ width: 400, height: 300 }),
        // FrameBridge gained `scale` (the zoomed canvas); an unscaled frame is 1.
        scale: () => 1,
      } as unknown as FrameBridge,
      schedule: (callback) => {
        queue.push(callback);
        return () => {
          const at = queue.indexOf(callback);
          if (at >= 0) {
            queue.splice(at, 1);
          }
        };
      },
      onSnapshot: (snapshot) => snapshots.push(snapshot.text),
    });
    const onActions = vi.fn();
    let editor: Editor | null = null;
    const isSource = (report: unknown): report is { measure: () => InlineSelectionAnchor | null } =>
      typeof report === 'object' &&
      report !== null &&
      'measure' in report &&
      typeof report.measure === 'function';

    render(
      <Harness
        onCommit={() => undefined}
        onAnchor={(report) => {
          channel.setText(
            report === null
              ? null
              : isSource(report)
                ? report.measure
                : () => report as InlineSelectionAnchor,
          );
        }}
        onActions={onActions}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    const text = ed.view.dom.querySelector('p')?.firstChild;
    if (text === null || text === undefined) {
      throw new Error('the TipTap surface must render selectable text');
    }
    Object.defineProperties(ed.view, {
      coordsAtPos: {
        configurable: true,
        value: (position: number) => ({
          top: 10,
          bottom: 28,
          left: position * 10,
          right: position * 10,
        }),
      },
      domAtPos: {
        configurable: true,
        value: (position: number) => ({ node: text, offset: Math.max(0, position - 1) }),
      },
    });

    const clientRects = vi
      .spyOn(Range.prototype, 'getClientRects')
      .mockImplementation(() => [new DOMRect(10, 10, 50, 18)] as unknown as DOMRectList);
    const boundingRects = vi
      .spyOn(Range.prototype, 'getBoundingClientRect')
      .mockImplementation(() => new DOMRect(10, 10, 50, 18));

    try {
      act(() => {
        ed.view.dom.focus();
      });
      for (const callback of queue.splice(0)) {
        callback();
      }
      clientRects.mockClear();
      boundingRects.mockClear();
      snapshots.length = 0;

      const selectionEndpoints = [2, 3, 4, 5, 6];
      act(() => {
        for (const to of selectionEndpoints) {
          ed.commands.setTextSelection({ from: 1, to });
        }
      });

      const latestActions = onActions.mock.lastCall?.[0] as InlineFormatAction[] | undefined;
      expect(latestActions?.length ?? 0).toBeGreaterThan(0);
      expect(clientRects.mock.calls.length + boundingRects.mock.calls.length).toBe(0);
      const scheduledFlushes = queue.length;
      expect(scheduledFlushes).toBe(1);
      expect(selectionEndpoints.length).toBeGreaterThan(scheduledFlushes);

      for (const callback of queue.splice(0)) {
        callback();
      }
      const geometryReads = clientRects.mock.calls.length + boundingRects.mock.calls.length;
      expect(geometryReads).toBeGreaterThan(0);
      expect(geometryReads).toBeLessThanOrEqual(scheduledFlushes);
      expect(snapshots.at(-1)).not.toBeNull();
    } finally {
      clientRects.mockRestore();
      boundingRects.mockRestore();
      channel.dispose();
    }
  });

  it('reports the formatting actions while the edit owns focus, collapsed caret included', () => {
    const { onActions, ed } = mount();
    // The session opens ON the surface: it takes focus, so the chrome is there
    // from the first moment, at a bare caret.
    expect(ed.view.hasFocus()).toBe(true);
    expect(lastActions(onActions).map((action) => action.id)).toContain('bold');

    selectStart(ed);
    const actions = lastActions(onActions);
    expect(actions.map((action) => action.id)).toEqual([
      'bold',
      'italic',
      'link',
      'heading2',
      'heading3',
      'bulletList',
      'orderedList',
      'clear',
    ]);
    expect(actions.map((action) => action.label)).toEqual([
      'Bold',
      'Italic',
      'Link',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Clear formatting',
    ]);
    // Toggles carry pressed; the one-shot carries NO pressed key at all.
    expect(actions[0]?.pressed).toBe(false);
    expect(actions[0]?.disabled).toBe(false);
    expect(Object.keys(actions[7] ?? {})).not.toContain('pressed');

    // A collapsed caret keeps the chrome (the canvas docks it at the surface):
    // marks and lists stay usable, Link needs characters to carry it.
    act(() => {
      ed.commands.setTextSelection({ from: 3, to: 3 });
    });
    const atCaret = lastActions(onActions);
    expect(atCaret.map((action) => action.id)).toContain('bulletList');
    expect(atCaret.find((action) => action.id === 'bold')?.disabled).toBe(false);
    expect(atCaret.find((action) => action.id === 'link')?.disabled).toBe(true);
  });

  it('a list toggle at the caret is ONE commit and its pressed state follows', () => {
    const { onCommit, onActions, ed } = mount();
    act(() => {
      ed.view.dom.focus();
      ed.commands.setTextSelection({ from: 3, to: 3 });
    });
    const bullets = lastActions(onActions).find((action) => action.id === 'bulletList');
    expect(bullets?.pressed).toBe(false);
    act(() => {
      bullets?.run();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onCommit.mock.lastCall?.[0])).toContain('"bulletList"');
    expect(lastActions(onActions).find((action) => action.id === 'bulletList')?.pressed).toBe(true);
  });

  it('run() is ONE commit and the selection survives; pressed follows the mark', () => {
    const { onCommit, onActions, ed } = mount();
    selectStart(ed);
    const bold = lastActions(onActions).find((action) => action.id === 'bold');
    expect(bold).toBeDefined();
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      bold?.run();
    });
    // Exactly one commit (the canvas turns each into one dispatch)…
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onCommit.mock.calls[0]?.[0])).toContain('"bold"');
    // …the selection is intact (risk 2: activation must not drop it)…
    expect(ed.state.selection.from).toBe(1);
    expect(ed.state.selection.to).toBe(6);
    expect(ed.isActive('bold')).toBe(true);
    // …and the re-reported actions show the toggle pressed.
    const after = lastActions(onActions).find((action) => action.id === 'bold');
    expect(after?.pressed).toBe(true);

    // The same toggle back: one more commit, selection still intact.
    act(() => {
      after?.run();
    });
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(ed.state.selection.from).toBe(1);
    expect(ed.state.selection.to).toBe(6);
    expect(ed.isActive('bold')).toBe(false);
  });

  it('forward Tab reaches host formatting chrome and returns with the TipTap selection intact', async () => {
    const menu = document.createElement('div');
    const boldButton = document.createElement('button');
    menu.append(boldButton);
    document.body.append(menu);
    const bookmark: { restore: (() => void) | null } = { restore: null };
    const requestFormattingMenuFocus = vi.fn((restore: () => void) => {
      bookmark.restore = restore;
      boldButton.focus();
      return boldButton.ownerDocument.activeElement === boldButton;
    });
    const { onActions, ed } = mount(menu, requestFormattingMenuFocus);
    selectStart(ed);
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });

    await act(async () => {
      ed.view.dom.dispatchEvent(tab);
      await Promise.resolve();
    });

    expect(requestFormattingMenuFocus).toHaveBeenCalledTimes(1);
    expect(tab.defaultPrevented).toBe(true);
    expect(menu.ownerDocument.activeElement).toBe(boldButton);
    expect(ed.state.selection.from).toBe(1);
    expect(ed.state.selection.to).toBe(6);
    expect(lastActions(onActions).length).toBeGreaterThan(0);

    act(() => {
      bookmark.restore?.();
    });
    expect(ed.view.hasFocus()).toBe(true);
    expect(ed.view.dom.ownerDocument.activeElement).toBe(ed.view.dom);
    expect(ed.state.selection.from).toBe(1);
    expect(ed.state.selection.to).toBe(6);
  });

  it('forward Tab remains native when the canvas has no enabled formatting action', () => {
    const requestFormattingMenuFocus = vi.fn(() => false);
    const { ed } = mount(undefined, requestFormattingMenuFocus);
    selectStart(ed);
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      ed.view.dom.dispatchEvent(tab);
    });

    expect(requestFormattingMenuFocus).toHaveBeenCalledTimes(1);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('a cancelled link prompt commits nothing; a refused URL commits nothing', () => {
    const { onCommit, onActions, ed } = mount();
    selectStart(ed);
    const link = lastActions(onActions).find((action) => action.id === 'link');

    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    );
    act(() => {
      link?.run();
    });
    expect(onCommit).not.toHaveBeenCalled();

    // The system allowlist refuses what the published page would neutralize.
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'javascript:alert(1)'),
    );
    act(() => {
      link?.run();
    });
    expect(onCommit).not.toHaveBeenCalled();

    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'https://example.com/docs'),
    );
    act(() => {
      link?.run();
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(onCommit.mock.calls[0]?.[0])).toContain('https://example.com/docs');
    vi.unstubAllGlobals();
  });

  it('keeps actions and anchor while formatting chrome owns focus, then clears outside it', async () => {
    const menu = document.createElement('div');
    const menuControl = document.createElement('button');
    const unrelated = document.createElement('button');
    menu.append(menuControl);
    document.body.append(menu, unrelated);
    const { onAnchor, onActions, ed } = mount(menu);
    selectStart(ed);
    expect(lastActions(onActions).length).toBeGreaterThan(0);
    expect(onAnchor.mock.lastCall?.[0]).not.toBeNull();
    const actionReportsBeforeTransfer = onActions.mock.calls.length;
    const anchorReportsBeforeTransfer = onAnchor.mock.calls.length;

    await act(async () => {
      menuControl.focus();
      await Promise.resolve();
    });
    expect(menu.ownerDocument.activeElement).toBe(menuControl);
    const actionReportsDuringTransfer = onActions.mock.calls
      .slice(actionReportsBeforeTransfer)
      .map((call) => call[0] as InlineFormatAction[]);
    const anchorReportsDuringTransfer = onAnchor.mock.calls
      .slice(anchorReportsBeforeTransfer)
      .map((call) => call[0] as unknown);
    expect(actionReportsDuringTransfer.length).toBeGreaterThan(0);
    expect(actionReportsDuringTransfer.every((actions) => actions.length > 0)).toBe(true);
    expect(anchorReportsDuringTransfer.length).toBeGreaterThan(0);
    expect(anchorReportsDuringTransfer.every((anchor) => anchor !== null)).toBe(true);
    expect(lastActions(onActions).length).toBeGreaterThan(0);
    expect(onAnchor.mock.lastCall?.[0]).not.toBeNull();

    await act(async () => {
      unrelated.focus();
      await Promise.resolve();
    });
    expect(lastActions(onActions)).toEqual([]);
    expect(onAnchor).toHaveBeenLastCalledWith(null);
  });

  it('without formatting chrome, blur still clears actions and anchor', async () => {
    const unrelated = document.createElement('button');
    document.body.append(unrelated);
    const { onAnchor, onActions, ed } = mount();
    selectStart(ed);

    await act(async () => {
      unrelated.focus();
      await Promise.resolve();
    });
    expect(lastActions(onActions)).toEqual([]);
    expect(onAnchor).toHaveBeenLastCalledWith(null);
  });

  it('blur directly to unrelated content clears reports even when formatting chrome exists', async () => {
    const menu = document.createElement('div');
    const unrelated = document.createElement('button');
    document.body.append(menu, unrelated);
    const { onAnchor, onActions, ed } = mount(menu);
    selectStart(ed);

    await act(async () => {
      unrelated.focus();
      await Promise.resolve();
    });
    expect(lastActions(onActions)).toEqual([]);
    expect(onAnchor).toHaveBeenLastCalledWith(null);
  });

  it('unmount cancels a pending focus re-check and closes both channels exactly once', async () => {
    const menu = document.createElement('div');
    const unrelated = document.createElement('button');
    document.body.append(menu, unrelated);
    const { onAnchor, onActions, ed, view } = mount(menu);
    selectStart(ed);

    act(() => {
      unrelated.focus();
      view.unmount();
    });
    expect(lastActions(onActions)).toEqual([]);
    expect(onAnchor).toHaveBeenLastCalledWith(null);
    const actionReportCount = onActions.mock.calls.length;
    const anchorReportCount = onAnchor.mock.calls.length;

    await act(async () => {
      await Promise.resolve();
    });
    expect(onActions).toHaveBeenCalledTimes(actionReportCount);
    expect(onAnchor).toHaveBeenCalledTimes(anchorReportCount);
  });

  it('unmount reports [] and null — never a stranded bubble', () => {
    const { onAnchor, onActions, ed, view } = mount();
    selectStart(ed);
    expect(lastActions(onActions).length).toBeGreaterThan(0);
    expect(onAnchor.mock.lastCall?.[0]).not.toBeNull();

    view.unmount();
    expect(lastActions(onActions)).toEqual([]);
    expect(onAnchor).toHaveBeenLastCalledWith(null);
  });

  it('unsets an active link, applies italic, and clears formatting through one commit per action', () => {
    const { onActions, onCommit, ed } = mount();
    const action = (id: InlineFormatAction['id']) => {
      const found = lastActions(onActions).find((candidate) => candidate.id === id);
      if (found === undefined) {
        throw new Error(`Expected ${id} action for the current selection`);
      }
      return found;
    };

    selectStart(ed);
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'https://example.com/docs'),
    );
    try {
      act(() => {
        action('link').run();
      });
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(onCommit.mock.lastCall?.[0])).toContain('https://example.com/docs');
      expect(action('link').pressed).toBe(true);

      act(() => {
        action('link').run();
      });
      expect(onCommit).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(onCommit.mock.lastCall?.[0])).not.toContain('https://example.com/docs');
      expect(action('link').pressed).toBe(false);

      act(() => {
        action('italic').run();
      });
      expect(onCommit).toHaveBeenCalledTimes(3);
      expect(JSON.stringify(onCommit.mock.lastCall?.[0])).toContain('"italic"');

      act(() => {
        action('clear').run();
      });
      expect(onCommit).toHaveBeenCalledTimes(4);
      expect(JSON.stringify(onCommit.mock.lastCall?.[0])).not.toContain('"italic"');
      expect(ed.state.selection.from).toBe(1);
      expect(ed.state.selection.to).toBe(6);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('block-parts bidi — the canvas inline editor (DESIGN §2.10)', () => {
  it('gives each block its own content direction, never stored', () => {
    const { ed, onCommit } = mount();
    for (const paragraph of ed.view.dom.querySelectorAll('p')) {
      expect(paragraph).toHaveAttribute('dir', 'auto');
    }
    act(() => {
      ed.chain().focus('end').insertContent(' grows.').run();
    });
    expect(JSON.stringify(onCommit.mock.lastCall?.[0])).not.toContain('"dir"');
  });
});
