import { useCallback, useEffect, useState } from 'react';

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
    /*
      A longer wait, not a weaker claim: the toolbar arrives through a real
      dynamic `import()`, so how long it takes is a function of machine load,
      not of the product. Under `pnpm verify`'s parallel run this resolved in
      1401ms and the default one-second patience failed it — a red suite that
      said nothing about the code.
    */
    expect(
      await screen.findByRole('button', { name: 'Bold' }, { timeout: 5000 }),
    ).toBeInTheDocument();
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
    /*
      The ACCESSIBLE NAME, not the raw text. The inspector's label now shows a
      humanised "Body" to the eye and carries the exact property key for
      assistive technology, so the element's `textContent` is "Bodybody" while
      what a screen reader announces is "body" — the visible half is
      `aria-hidden`. Reading `textContent` measured the wrong thing and would
      fail again the next time a label gains any decoration.
    */
    expect(surface).toHaveAccessibleName('body');
    const label = document.getElementById(labelledBy ?? '');
    expect(label?.querySelector('[aria-hidden="true"]')?.textContent).toBe('Body');

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

  it('e5: a non-string responsive bucket receives the generic breakpoint notice', () => {
    const onChange = vi.fn();
    render(
      <RichTextField
        schema={richText()}
        value={emptyRichText()}
        path={['responsive', 2, 'body']}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/no this breakpoint override yet/i)).toBeInTheDocument();
    expect(document.querySelector('.bldr-richtext-field__surface')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports externally stored content the editor cannot open without replacing it', () => {
    const onChange = vi.fn();
    render(
      <RichTextField
        schema={richText()}
        value={{ type: 'doc', content: [{ type: 'horizontalRule' }] }}
        path={['props', 'body']}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This content cannot be opened for editing — it was left untouched.',
    );
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
  it('keeps every toolbar button accessible name exactly unchanged', () => {
    const kernel = makeKernel();
    render(<FieldHarness kernel={kernel} onEditor={() => undefined} />);

    const expectedNames = [
      'Bold',
      'Italic',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Link',
      'Clear formatting',
    ] as const;
    const buttons = screen.getAllByRole('button');

    // Mutation guard: removing or changing `aria-label={label}` makes this
    // named test fail because every visible glyph is deliberately aria-hidden.
    expect(buttons).toHaveLength(expectedNames.length);
    expectedNames.forEach((name, index) => {
      expect(buttons[index]).toHaveAttribute('aria-label', name);
      expect(buttons[index]).toHaveAccessibleName(name);
    });
    expect(screen.getByRole('button', { name: 'Clear formatting' })).not.toHaveAttribute(
      'aria-pressed',
    );
  });

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
      expect(screen.getByRole('button', { name }), name).toHaveAttribute('aria-pressed', 'true');
    };

    for (const name of [
      'Bold',
      'Italic',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Link',
    ]) {
      expect(screen.getByRole('button', { name }), name).toHaveAttribute('aria-pressed', 'false');
    }

    clickCommits('Bold', '"bold"');
    selectAll();
    const beforeBoldOff = txCount(kernel);
    click('Bold');
    expect(txCount(kernel), 'Bold toggles off').toBe(beforeBoldOff + 1);
    expect(JSON.stringify(bodyOf(kernel)), 'Bold toggles off').not.toContain('"bold"');
    expect(screen.getByRole('button', { name: 'Bold' }), 'Bold toggles off').toHaveAttribute(
      'aria-pressed',
      'false',
    );
    clickCommits('Bold', '"bold"');
    clickCommits('Italic', '"italic"');
    clickCommits('Heading 2', '"level":2');
    clickCommits('Heading 3', '"level":3');
    expect(screen.getByRole('button', { name: 'Heading 2' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    clickCommits('Bulleted list', '"bulletList"');
    clickCommits('Numbered list', '"orderedList"');
    expect(screen.getByRole('button', { name: 'Bulleted list' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

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
    expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'false');
    vi.unstubAllGlobals();

    // Clear formatting strips marks and nodes back to paragraphs.
    selectAll();
    const beforeClear = txCount(kernel);
    click('Clear formatting');
    expect(txCount(kernel)).toBe(beforeClear + 1);
    const cleared = JSON.stringify(bodyOf(kernel));
    expect(cleared).not.toContain('"bold"');
    expect(cleared).not.toContain('"orderedList"');
    for (const name of [
      'Bold',
      'Italic',
      'Heading 2',
      'Heading 3',
      'Bulleted list',
      'Numbered list',
      'Link',
    ]) {
      expect(screen.getByRole('button', { name }), name).toHaveAttribute('aria-pressed', 'false');
    }
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

describe('B3c stale-echo protocol — two commits in one frame (009 field report)', () => {
  /**
   * The browser race jsdom's act() normally hides: TWO commits land before
   * React hands EITHER back, then the first echoes late as a NEW object with
   * the OLDER content. A reconcile that only remembers "the last emission"
   * reads that stale echo as an external write and re-seeds the editor
   * BACKWARDS — a caret teleport that eats the newest change. Deleting the
   * emission ring (back to a single string) must fail these tests.
   */
  const staleHarness = () => {
    const emissions: unknown[] = [];
    // A mutable cell, not a reassigned outer binding: the React compiler's lint
    // forbids the latter, and the test needs a handle on the host's setter.
    const handle: { editor: Editor | null; deliver: (next: unknown) => void } = {
      editor: null,
      deliver: () => undefined,
    };
    const seedValue = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Start' }] }],
    };
    function Host() {
      const [value, setValue] = useState<unknown>(seedValue);
      // Published from an EFFECT: writing to an outer binding during render is
      // what the React compiler's immutability rule forbids.
      useEffect(() => {
        handle.deliver = setValue;
      }, []);
      return (
        <RichTextField
          schema={richText()}
          value={value}
          path={['props', 'body']}
          onChange={(next) => {
            emissions.push(next);
          }}
          onEditorReady={(instance) => {
            handle.editor = instance;
          }}
        />
      );
    }
    render(<Host />);
    const ed = handle.editor;
    if (ed === null) {
      throw new Error('editor must mount');
    }
    const copyOf = (index: number) => JSON.parse(JSON.stringify(emissions[index])) as unknown;
    return {
      ed,
      emissions,
      deliver: (next: unknown) => {
        handle.deliver(next);
      },
      copyOf,
    };
  };

  it('a STALE echo of an older commit never re-seeds the editor backwards', () => {
    const h = staleHarness();
    act(() => {
      h.ed.chain().focus('end').insertContent(' one').run();
      h.ed.chain().focus('end').insertContent(' two').run();
      // The FIRST commit's echo arrives — late, and a NEW object.
      h.deliver(h.copyOf(0));
    });
    expect(h.emissions).toHaveLength(2);
    // THE GUARD: the newest change survives its predecessor's late echo.
    expect(h.ed.getText()).toBe('Start one two');

    act(() => {
      h.deliver(h.copyOf(1)); // the fresh echo settles everything
    });
    expect(h.ed.getText()).toBe('Start one two');
  });

  it('an external revert that RESEMBLES a stale echo still wins, one beat later', async () => {
    // A kernel undo landing between an emission and its echo produces the SAME
    // observable input as the stale echo. The protocol skips first (so typing
    // never teleports), then re-runs one beat later: the value is still there,
    // identity unchanged — now it is document truth, and it re-seeds.
    const h = staleHarness();
    act(() => {
      h.ed.chain().focus('end').insertContent(' one').run();
      h.ed.chain().focus('end').insertContent(' two').run();
      h.deliver(h.copyOf(0));
    });
    expect(h.ed.getText()).toBe('Start one two');
    await vi.waitFor(() => {
      expect(h.ed.getText()).toBe('Start one');
    });
  });
});
