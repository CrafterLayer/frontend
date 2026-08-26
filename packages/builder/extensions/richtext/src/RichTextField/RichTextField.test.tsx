import { useCallback } from 'react';

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { z } from 'zod';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Editor } from '@tiptap/react';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  BuilderError,
  defineBlockSchema,
  emptyRichText,
  isRichTextSchema,
  richText,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
import { useKernelSelector } from '@craftkit/builder-renderer';
import { Inspector } from '@craftkit/builder-shell';

import { richTextExtension } from '../index';
import { RichTextField } from './RichTextField';

// ProseMirror measures selection geometry jsdom does not implement — inert
// stubs keep the EDITING logic (the part under test) fully real.
beforeAll(() => {
  Range.prototype.getClientRects = function getClientRectsStub() {
    return [] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
    return new DOMRect(0, 0, 0, 0);
  };
});

afterEach(cleanup);

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'richtext-test-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'article',
          description: 'Article',
          props: z.object({
            title: z.string().default(''),
            body: richText().default(emptyRichText() as never),
          }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'a1',
  nodes: {
    a1: {
      id: 'a1',
      type: 'article',
      props: {
        title: 'Hello',
        body: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start' }] }],
        },
      },
    },
  },
};

const makeKernel = (extensions: TrustedExtensionManifest[] = [VOCAB, richTextExtension]) =>
  createBuilder({
    document: DOC,
    extensions,
    ports: { clock: fixedClock(), ids: seededIds('rt') },
  });

/** Mimics InspectorRow's wiring: document-truth value + one guarded dispatch. */
function FieldHarness({
  kernel,
  onEditor,
}: {
  kernel: BuilderKernel;
  onEditor: (editor: Editor) => void;
}) {
  const value = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) =>
        state.doc.nodes['a1']?.props['body'],
      [],
    ),
  );
  return (
    <RichTextField
      schema={richText()}
      value={value}
      path={['props', 'body']}
      onChange={(next) => {
        kernel.dispatch('setProp', { id: 'a1', key: 'body', value: next }, 'user');
      }}
      onEditorReady={onEditor}
    />
  );
}

const bodyOf = (kernel: BuilderKernel) => kernel.getDocument().nodes['a1']?.props['body'];
const txCount = (kernel: BuilderKernel) => kernel.transactions().length;

describe('US1 — rich text through the field road (008 contract §3)', () => {
  it('AC2: every editor commit is exactly ONE projected transaction — and MOUNTING is zero', () => {
    const kernel = makeKernel();
    const mountBaseline = txCount(kernel);
    let editor: Editor | null = null;
    render(
      <FieldHarness
        kernel={kernel}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    expect(editor).not.toBeNull();
    const ed = editor as unknown as Editor;
    // Regression (found by the playground counter): editor creation and the
    // editable-state effect must never emit a phantom commit.
    expect(txCount(kernel)).toBe(mountBaseline);

    const before = txCount(kernel);
    act(() => {
      ed.chain().focus('end').insertContent(' more').run();
    });
    expect(txCount(kernel)).toBe(before + 1);
    expect(JSON.stringify(bodyOf(kernel))).toContain('Start more');

    act(() => {
      ed.chain().selectAll().toggleBold().run();
    });
    expect(txCount(kernel)).toBe(before + 2);
    expect(JSON.stringify(bodyOf(kernel))).toContain('"bold"');

    act(() => {
      ed.chain().selectAll().toggleHeading({ level: 2 }).run();
    });
    expect(txCount(kernel)).toBe(before + 3);
    expect(JSON.stringify(bodyOf(kernel))).toContain('"heading"');

    act(() => {
      ed.chain().selectAll().toggleBulletList().run();
    });
    expect(txCount(kernel)).toBe(before + 4);
    expect(JSON.stringify(bodyOf(kernel))).toContain('"bulletList"');

    act(() => {
      ed.chain().selectAll().setLink({ href: 'https://example.com' }).run();
    });
    expect(txCount(kernel)).toBe(before + 5);
    const stored = JSON.stringify(bodyOf(kernel));
    expect(stored).toContain('"link"');
    expect(stored).toContain('https://example.com');
    // The projection stripped the engine's extra link attrs — the STRICT door
    // accepted every one of these writes (they are in the log).
    expect(stored).not.toContain('"target"');
  });

  it('AC3: undo re-seeds the editor (document truth over the engine state)', () => {
    const kernel = makeKernel();
    let editor: Editor | null = null;
    render(
      <FieldHarness
        kernel={kernel}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    act(() => {
      ed.chain().focus('end').insertContent(' typed').run();
    });
    expect(ed.getText()).toContain('Start typed');

    act(() => {
      kernel.undo();
    });
    expect(ed.getText()).toBe('Start');
    expect(JSON.stringify(bodyOf(kernel))).not.toContain('typed');

    act(() => {
      kernel.redo();
    });
    expect(ed.getText()).toContain('Start typed');
  });

  it('AC4: a hostile write is rejected at the door with zero change', () => {
    const kernel = makeKernel();
    const before = kernel.getDocument();
    expect(() =>
      kernel.dispatch(
        'setProp',
        {
          id: 'a1',
          key: 'body',
          value: { type: 'doc', content: [{ type: 'script', src: 'x' }] },
        },
        'user',
      ),
    ).toThrow(BuilderError);
    expect(kernel.getDocument()).toBe(before);
  });

  it('AC1/AC5: resolves through the Inspector with zero panel code; disposal restores the fallback', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['a1']);
    render(<Inspector kernel={kernel} />);

    // Lazy load resolves in a microtask; the toolbar proves the CONTRIBUTED
    // editor mounted for the marked prop (title stays a plain text field).
    expect(await screen.findByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Formatting' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'title' })).toHaveValue('Hello');
    // H1 (§10 review): the CONTENTEDITABLE itself is named and described —
    // EditorContent's wrapper div is not a labelable element, so the row's
    // <label htmlFor> can never name it.
    const surface = document.querySelector('.bldr-richtext-field__surface');
    expect(surface).not.toBeNull();
    expect(surface).toHaveAttribute('role', 'textbox');
    expect(surface).toHaveAttribute('aria-multiline', 'true');
    expect(surface).toHaveAttribute('dir', 'auto');
    const labelledBy = surface?.getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBe('body');

    act(() => {
      kernel.extensions.dispose('craftkit.rich-text');
    });
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
    // The unmatched rich schema falls back to the accessible read-only display.
    const fallback = screen.getByRole('textbox', { name: 'body' });
    expect(fallback).toHaveAttribute('readonly');
  });

  it('e5: under a responsive path the field refuses with a notice, never writes', () => {
    const onChange = vi.fn();
    render(
      <RichTextField
        schema={richText()}
        value={emptyRichText()}
        path={['responsive', 'tablet', 'body']}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/switch to desktop to edit the base value/i)).toBeInTheDocument();
    expect(screen.getByText(/tablet override/i)).toBeInTheDocument();
    expect(document.querySelector('.bldr-richtext-field__surface')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('US3 — containment (008 contract §3 e1)', () => {
  it('SC-003: the loader is invoked 0× without a rich edit, 1× with (cached after)', async () => {
    let loads = 0;
    const countingManifest: TrustedExtensionManifest = {
      tier: 1,
      name: 'counting-richtext',
      version: '1.0.0',
      contributes: {
        fieldTypes: [
          {
            id: 'counting-richtext-field',
            match: (schema) => (isRichTextSchema(schema) ? 200 : 0),
            load: () => {
              loads += 1;
              return Promise.resolve({ default: () => null });
            },
          },
        ],
      },
    };
    const kernel = makeKernel([VOCAB, countingManifest]);
    const view = render(<Inspector kernel={kernel} />);
    expect(loads).toBe(0); // mounted, nothing selected — no engine

    kernel.setSelection(['a1']);
    view.rerender(<Inspector kernel={kernel} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(loads).toBe(1); // the rich prop is on screen — exactly one load

    kernel.setSelection([]);
    view.rerender(<Inspector kernel={kernel} />);
    kernel.setSelection(['a1']);
    view.rerender(<Inspector kernel={kernel} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(loads).toBe(1); // per-def cache: never re-fetched
  });
});

describe('toolbar interactions (FR-007 — every control commits through the door)', () => {
  it('each labeled button applies its format as ONE commit; link prompts and unsets', () => {
    const kernel = makeKernel();
    let editor: Editor | null = null;
    render(
      <FieldHarness
        kernel={kernel}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    const selectAll = () => {
      act(() => {
        ed.chain().selectAll().run();
      });
    };
    const click = (name: string) => {
      act(() => {
        fireEvent.click(screen.getByRole('button', { name }));
      });
    };
    const clickCommits = (name: string, marker: string) => {
      selectAll();
      const before = txCount(kernel);
      click(name);
      expect(txCount(kernel), name).toBe(before + 1);
      expect(JSON.stringify(bodyOf(kernel)), name).toContain(marker);
    };

    clickCommits('Bold', '"bold"');
    clickCommits('Italic', '"italic"');
    clickCommits('Heading 2', '"level":2');
    clickCommits('Heading 3', '"level":3');
    clickCommits('Bulleted list', '"bulletList"');
    clickCommits('Numbered list', '"orderedList"');

    // aria-pressed mirrors editor state on the active formats.
    selectAll();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');

    // Link: prompt flow applies, second activation unsets.
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'https://example.com/docs'),
    );
    selectAll();
    const beforeLink = txCount(kernel);
    click('Link');
    expect(txCount(kernel)).toBe(beforeLink + 1);
    expect(JSON.stringify(bodyOf(kernel))).toContain('https://example.com/docs');
    selectAll();
    click('Link');
    expect(txCount(kernel)).toBe(beforeLink + 2);
    expect(JSON.stringify(bodyOf(kernel))).not.toContain('https://example.com/docs');
    vi.unstubAllGlobals();

    // Clear formatting strips marks and nodes back to paragraphs.
    selectAll();
    const beforeClear = txCount(kernel);
    click('Clear formatting');
    expect(txCount(kernel)).toBe(beforeClear + 1);
    const cleared = JSON.stringify(bodyOf(kernel));
    expect(cleared).not.toContain('"bold"');
    expect(cleared).not.toContain('"orderedList"');
  });

  it('a cancelled link prompt commits nothing', () => {
    const kernel = makeKernel();
    let editor: Editor | null = null;
    render(
      <FieldHarness
        kernel={kernel}
        onEditor={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    act(() => {
      ed.chain().selectAll().run();
    });
    vi.stubGlobal(
      'prompt',
      vi.fn(() => null),
    );
    const before = txCount(kernel);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    });
    expect(txCount(kernel)).toBe(before);
    vi.unstubAllGlobals();
  });

  it('disabled mirrors into the engine editable state without a phantom commit', () => {
    let editor: Editor | null = null;
    const onChange = vi.fn();
    const view = render(
      <RichTextField
        schema={richText()}
        value={emptyRichText()}
        path={['props', 'body']}
        onChange={onChange}
        disabled
        onEditorReady={(instance) => {
          editor = instance;
        }}
      />,
    );
    const ed = editor as unknown as Editor;
    expect(ed.isEditable).toBe(false);
    view.rerender(
      <RichTextField
        schema={richText()}
        value={emptyRichText()}
        path={['props', 'body']}
        onChange={onChange}
        onEditorReady={() => undefined}
      />,
    );
    expect(ed.isEditable).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('§11 convergence fixes — the rejection path is real, not assumed', () => {
  /**
   * A door that refuses THIS field's own emission. The reconcile effect must
   * snap the editor back to document truth: the value prop is referentially
   * unchanged by a rejection, so only the per-emission dependency can trigger
   * it — deleting that dependency must fail this test (it previously did not).
   */
  it('a REJECTED commit re-seeds the editor back to the stored document', () => {
    const kernel = makeKernel();
    let editor: Editor | null = null;
    let reject = false;

    function RejectingHarness() {
      const value = useKernelSelector(
        kernel,
        useCallback(
          (state: ReturnType<BuilderKernel['context']['store']['getState']>) =>
            state.doc.nodes['a1']?.props['body'],
          [],
        ),
      );
      return (
        <RichTextField
          schema={richText()}
          value={value}
          path={['props', 'body']}
          onChange={(next) => {
            if (reject) {
              return; // the door refused: NO dispatch, value unchanged
            }
            kernel.dispatch('setProp', { id: 'a1', key: 'body', value: next }, 'user');
          }}
          onEditorReady={(instance) => {
            editor = instance;
          }}
        />
      );
    }

    render(<RejectingHarness />);
    const ed = editor as unknown as Editor;
    expect(ed.getText()).toBe('Start');

    reject = true;
    const txBefore = txCount(kernel);
    act(() => {
      ed.chain().focus('end').insertContent(' refused').run();
    });

    // Zero document change…
    expect(txCount(kernel)).toBe(txBefore);
    expect(JSON.stringify(bodyOf(kernel))).not.toContain('refused');
    // …and the EDITOR is back on document truth, not stranded on the refusal.
    expect(ed.getText()).toBe('Start');
  });

  it('AC4 through the REAL surface: a refused edit shows a control-adjacent reason', async () => {
    // A door that refuses every change: any editor emission is rejected, so the
    // Inspector row's rejection channel must carry the reason to the editable
    // surface (§8 item 7 wiring, proven end to end rather than assumed).
    const seeded = JSON.stringify(DOC.nodes['a1']?.props['body']);
    const strictVocab: TrustedExtensionManifest = {
      tier: 1,
      name: 'strict-richtext-vocab',
      version: '1.0.0',
      contributes: {
        blocks: [
          {
            schema: defineBlockSchema({
              type: 'article',
              description: 'Article',
              props: z.object({
                title: z.string().default(''),
                body: richText().refine(
                  (doc) => JSON.stringify(doc) === seeded,
                  'This body is locked by policy.',
                ),
              }),
              examples: [],
            }),
            render: NullRender,
          },
        ],
      },
    };
    const kernel = createBuilder({
      document: DOC,
      extensions: [strictVocab, richTextExtension],
      ports: { clock: fixedClock(), ids: seededIds('rt-strict') },
    });
    kernel.setSelection(['a1']);
    render(<Inspector kernel={kernel} />);
    await screen.findByRole('button', { name: 'Bold' });

    const surface = document.querySelector('.bldr-richtext-field__surface');
    expect(surface).not.toBeNull();
    const before = kernel.transactions().length;
    const documentBefore = kernel.getDocument();

    // A real gesture through the real toolbar. "Bulleted list" changes the
    // STRUCTURE even with a collapsed caret, so it always produces a commit —
    // which this door refuses.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    });

    expect(kernel.transactions().length).toBe(before); // zero change…
    expect(kernel.getDocument()).toBe(documentBefore);
    // …and the reason is CONTROL-ADJACENT: described by the editable surface.
    const describedBy = surface?.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const reason = document.getElementById(describedBy?.split(' ')[0] ?? '');
    expect(reason?.textContent ?? '').toContain('locked by policy');
    // The editor is back on document truth, not stranded on the refused state.
    expect(surface?.textContent).toContain('Start');
  });
});
