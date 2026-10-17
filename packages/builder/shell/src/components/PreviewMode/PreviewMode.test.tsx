import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { lightTheme } from '@craftkit/builder-renderer';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { PreviewMode } from './PreviewMode';
import { PREVIEW_MODE_LABELS_AR } from './PreviewMode.labels';

const TextRender = ((props: BlockRenderProps<{ content: string }>) => (
  <p data-testid={`text-${props.node.id}`}>{props.props.content}</p>
)) as unknown as BlockRenderComponent;
const SlotRender = ((props: BlockRenderProps) => (
  <div>{props.slots['default']}</div>
)) as unknown as BlockRenderComponent;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'preview-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['text'] } },
          examples: [],
        }),
        render: SlotRender,
      },
      {
        schema: defineBlockSchema({
          type: 'text',
          description: 'Text',
          props: z.object({ content: z.string().default('') }),
          examples: [],
        }),
        render: TextRender,
      },
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['t1'] } },
    t1: { id: 't1', type: 'text', props: { content: 'Visitors see this.' } },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pv') },
  });

const frameDoc = () => {
  const frame = screen.getByTitle<HTMLIFrameElement>('Preview');
  const doc = frame.contentDocument;
  if (doc === null) {
    throw new Error('preview frame must expose a document in jsdom');
  }
  return doc;
};

describe('US4 — preview mode (007 contract §5)', () => {
  it('renders at the requested viewport width and rejects collapsing invalid widths', () => {
    const kernel = makeKernel();
    const view = render(
      <PreviewMode kernel={kernel} theme={lightTheme} frameWidth={390} onExit={vi.fn()} />,
    );
    const frameShell = view.container.querySelector<HTMLElement>('.bldr-preview__frame');

    expect(frameShell).toHaveStyle({ inlineSize: '390px', maxInlineSize: '100%' });

    view.rerender(
      <PreviewMode kernel={kernel} theme={lightTheme} frameWidth={0} onExit={vi.fn()} />,
    );
    expect(frameShell?.style.inlineSize).toBe('');
    expect(frameShell?.style.maxInlineSize).toBe('');
  });

  it('p1: renders the publish-safe path — content live, ZERO editing chrome', () => {
    const kernel = makeKernel();
    const { container } = render(
      <PreviewMode kernel={kernel} theme={lightTheme} onExit={vi.fn()} />,
    );
    const doc = frameDoc();
    expect(doc.querySelector('[data-testid="text-t1"]')?.textContent).toBe('Visitors see this.');
    // No chrome of any kind: no overlay layer, no attachment wrappers.
    expect(container.querySelector('.bldr-overlay')).toBeNull();
    expect(doc.querySelector('[data-bldr-node]')).toBeNull();

    // Content is LIVE: an external document change renders through.
    act(() => {
      kernel.dispatch('setProp', { id: 't1', key: 'content', value: 'Updated live.' }, 'user');
    });
    expect(doc.querySelector('[data-testid="text-t1"]')?.textContent).toBe('Updated live.');
  });

  it('p2: the direction override flips ONLY the frame — document reference-identical, zero tx', () => {
    const kernel = makeKernel();
    const docBefore = kernel.getDocument();
    const txBefore = kernel.transactions().length;
    const { rerender } = render(
      <PreviewMode kernel={kernel} theme={lightTheme} dirOverride={null} onExit={vi.fn()} />,
    );
    expect(frameDoc().documentElement.getAttribute('dir')).toBe('ltr');

    rerender(<PreviewMode kernel={kernel} theme={lightTheme} dirOverride="rtl" onExit={vi.fn()} />);
    expect(frameDoc().documentElement.getAttribute('dir')).toBe('rtl');
    expect(kernel.getDocument()).toBe(docBefore); // untouched — pure view state
    expect(kernel.transactions().length).toBe(txBefore);

    rerender(
      <PreviewMode kernel={kernel} theme={lightTheme} dirOverride={null} onExit={vi.fn()} />,
    );
    expect(frameDoc().documentElement.getAttribute('dir')).toBe('ltr');
    expect(kernel.getDocument()).toBe(docBefore);
    expect(kernel.transactions().length).toBe(txBefore);
  });

  it('p3: Escape exits from the HOST and from inside the FRAME; the exit control works too', async () => {
    const kernel = makeKernel();
    const onExit = vi.fn();
    const user = userEvent.setup();
    render(<PreviewMode kernel={kernel} theme={lightTheme} onExit={onExit} />);

    const region = screen.getByRole('region', { name: 'Preview' });
    region.focus();
    await user.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalledTimes(1);

    act(() => {
      frameDoc().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onExit).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Exit preview' }));
    expect(onExit).toHaveBeenCalledTimes(3);
  });

  it('selection survives the whole preview round trip (the kernel was never touched)', () => {
    const kernel = makeKernel();
    kernel.setSelection(['t1']);
    const txBefore = kernel.transactions().length;
    const { unmount } = render(<PreviewMode kernel={kernel} theme={lightTheme} onExit={vi.fn()} />);
    unmount();
    expect(kernel.context.store.getState().selection).toEqual(['t1']);
    expect(kernel.transactions().length).toBe(txBefore);
  });
});

describe('review fixes (007 §10)', () => {
  it('H1: Escape exits WITHOUT any pre-focusing — entry must not depend on focus landing', async () => {
    const kernel = makeKernel();
    const onExit = vi.fn();
    const user = userEvent.setup();
    render(<PreviewMode kernel={kernel} theme={lightTheme} onExit={onExit} />);

    // Focus moved into the region on mount (modal-surface law)…
    expect(screen.getByRole('region', { name: 'Preview' })).toHaveFocus();

    // …and even if it had NOT (body focus — the real entry state when the
    // trigger button unmounts), the host-document listener still exits.
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Escape}');
    expect(onExit).toHaveBeenCalled();
  });

  it('M3: entry is ANNOUNCED as a post-mount mutation of the polite region', async () => {
    const kernel = makeKernel();
    render(<PreviewMode kernel={kernel} theme={lightTheme} onExit={vi.fn()} />);
    const region = screen.getByRole('status', { name: 'Preview messages' });
    await vi.waitFor(() => {
      expect(region).toHaveTextContent('Preview — press Escape to return to editing.');
    });
  });
});

describe('convergence fixes (007 §11)', () => {
  it('T024: an onExit identity change does NOT re-steal focus (mount-only focus)', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    const view = render(<PreviewMode kernel={kernel} theme={lightTheme} onExit={vi.fn()} />);
    // The region takes focus on entry; the user then moves to the exit button…
    const exit = screen.getByRole('button', { name: 'Exit preview' });
    await user.click(exit);
    exit.focus();
    expect(exit).toHaveFocus();

    // …and a composer re-render with a FRESH onExit closure must not yank it.
    view.rerender(<PreviewMode kernel={kernel} theme={lightTheme} onExit={vi.fn()} />);
    expect(exit).toHaveFocus();
  });
});

describe('the preview bar and its words (UX pass, 2026-10-13)', () => {
  it('a host toolbar puts its tools and Exit preview in a bar above the page, not over it', async () => {
    const onExit = vi.fn();
    const user = userEvent.setup();
    render(
      <PreviewMode
        kernel={makeKernel()}
        theme={lightTheme}
        onExit={onExit}
        toolbar={<button type="button">Flip direction</button>}
      />,
    );
    const exit = screen.getByRole('button', { name: 'Exit preview' });
    const flip = screen.getByRole('button', { name: 'Flip direction' });
    const frame = screen.getByTitle('Preview');
    // Both controls come before the page in the flow, so neither is drawn over it.
    expect(exit.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(flip.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(exit).toHaveTextContent('Esc');
    await user.click(exit);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('names, titles and announces Preview in the editor language', async () => {
    render(
      <PreviewMode
        kernel={makeKernel()}
        theme={lightTheme}
        onExit={vi.fn()}
        labels={PREVIEW_MODE_LABELS_AR}
      />,
    );
    expect(screen.getByRole('region', { name: 'معاينة' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'إنهاء المعاينة' })).toBeInTheDocument();
    expect(screen.getByTitle('معاينة')).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(screen.getByRole('status', { name: 'رسائل المعاينة' })).toHaveTextContent(
        'معاينة — اضغط Escape للعودة إلى التحرير.',
      );
    });
  });
});
