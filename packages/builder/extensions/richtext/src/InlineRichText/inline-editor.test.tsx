import { useState } from 'react';

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Editor } from '@tiptap/react';

import type { InlineFormatAction, RichTextDoc } from '@craftkit/builder-schema';

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

afterEach(cleanup);

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
}: {
  onCommit: (next: unknown) => void;
  onAnchor: (anchor: unknown) => void;
  onActions: (actions: InlineFormatAction[]) => void;
  onEditor: (editor: Editor) => void;
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
    />
  );
}

function mount() {
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
  it('reports the FR-006 actions for a non-empty selection, [] for a collapsed one', () => {
    const { onActions, ed } = mount();
    // Mount reports a defined initial state: no focus, no selection — no bubble.
    expect(lastActions(onActions)).toEqual([]);

    selectStart(ed);
    const actions = lastActions(onActions);
    expect(actions.map((action) => action.id)).toEqual(['bold', 'italic', 'link', 'clear']);
    expect(actions.map((action) => action.label)).toEqual([
      'Bold',
      'Italic',
      'Link',
      'Clear formatting',
    ]);
    // Toggles carry pressed; the one-shot carries NO pressed key at all.
    expect(actions[0]?.pressed).toBe(false);
    expect(actions[0]?.disabled).toBe(false);
    expect(Object.keys(actions[3] ?? {})).not.toContain('pressed');

    act(() => {
      ed.commands.setTextSelection({ from: 3, to: 3 });
    });
    expect(lastActions(onActions)).toEqual([]);
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

  it('unmount reports [] and null — never a stranded bubble', () => {
    const { onAnchor, onActions, ed, view } = mount();
    selectStart(ed);
    expect(lastActions(onActions).length).toBeGreaterThan(0);
    expect(onAnchor.mock.lastCall?.[0]).not.toBeNull();

    view.unmount();
    expect(lastActions(onActions)).toEqual([]);
    expect(onAnchor).toHaveBeenLastCalledWith(null);
  });
});
