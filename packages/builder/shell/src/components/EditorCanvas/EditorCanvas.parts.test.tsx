import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { lightTheme } from '@craftkit/builder-renderer';

import type { PartTarget } from '../../overlay/part-target';
import { promoKernel, promoProps } from '../../overlay/part-test-kit';
import { permissiveUtilityOracle } from '../../overlay/tree-test-kit';
import type { GeometryPorts } from '../../rects';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { ELEMENT_QUICK_BAR_LABELS_AR } from '../ElementQuickBar';
import { EditorCanvas } from './EditorCanvas';
import { EDITOR_CANVAS_LABELS_AR } from './EditorCanvas.labels';

/*
  Block parts on the real canvas (block-parts DESIGN §2.6, §2.7, §2.14): every
  inner element of a registered block is selectable and editable in place —
  the GrapesJS idea — through one fixture block that declares text, link,
  image, list and item parts, with a nested child block of its own.
*/

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

function harness(options: { dir?: 'ltr' | 'rtl'; arabic?: boolean } = {}) {
  const dir = options.dir ?? 'ltr';
  const kernel = promoKernel(dir);
  const queue: (() => void)[] = [];
  let hitTarget: Element | null = null;
  const ports: Partial<GeometryPorts> = {
    measure: (element) =>
      element.hasAttribute('data-ck-part')
        ? { x: 20, y: 80, width: 120, height: 24 }
        : { x: 5, y: 60, width: 400, height: 300 },
    hitTest: () => hitTarget,
    viewport: () => ({ width: 800, height: 600 }),
    schedule: (callback) => {
      queue.push(callback);
      return () => {
        const at = queue.indexOf(callback);
        if (at >= 0) queue.splice(at, 1);
      };
    },
  };
  const floatingPorts = { measure: () => ({ width: 160, height: 32 }), observe: () => () => undefined };
  const onReplacePartImage = vi.fn<(target: PartTarget) => void>();
  const onOpenPartStyle = vi.fn();
  const onEditWithAiPart = vi.fn<(target: PartTarget) => void>();
  const view = render(
    <EditorCanvas
      kernel={kernel}
      theme={lightTheme}
      geometryPorts={ports}
      floatingPorts={floatingPorts}
      editable
      onReplacePartImage={onReplacePartImage}
      onOpenPartStyle={onOpenPartStyle}
      onEditWithAiPart={onEditWithAiPart}
      {...(options.arabic === true
        ? { canvasLabels: EDITOR_CANVAS_LABELS_AR, quickBarLabels: ELEMENT_QUICK_BAR_LABELS_AR, editorDir: 'rtl' as const }
        : {})}
    />,
  );
  const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
  frame.getBoundingClientRect = () => ({ x: 0, y: 0, width: 800, height: 600 }) as DOMRect;
  const frameDocument = frame.contentDocument!;
  const tick = () => {
    act(() => {
      for (const callback of queue.splice(0)) callback();
    });
  };
  const inFrame = (selector: string) => frameDocument.querySelector<HTMLElement>(selector);
  const part = (name: string, index?: number) =>
    inFrame(`[data-ck-part="${name}"]${index === undefined ? ':not([data-ck-part-index])' : `[data-ck-part-index="${String(index)}"]`}`);
  const at = (target: Element | null) => {
    hitTarget = target;
  };
  const click = (target: Element | null) => {
    at(target);
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1 }));
    });
    tick();
  };
  const doubleClick = (target: Element | null) => {
    at(target);
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX: 1, clientY: 1 }));
    });
    tick();
  };
  const pointerMove = (target: Element | null) => {
    at(target);
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('pointermove', { clientX: 1, clientY: 1 }));
    });
    tick();
  };
  const host = () => screen.getByRole('region', { name: 'Editor canvas' });
  const key = (init: KeyboardEventInit) => {
    fireEvent.keyDown(host(), init);
    tick();
  };
  const outline = (kind: 'hover' | 'selection') =>
    view.container.querySelector<HTMLElement>(`.bldr-outline--${kind}`);
  const state = () => kernel.context.store.getState();
  const surface = () => frameDocument.querySelector<HTMLElement>('.bldr-inline-text');
  return {
    kernel,
    view,
    frameDocument,
    tick,
    inFrame,
    part,
    click,
    doubleClick,
    pointerMove,
    host,
    key,
    outline,
    state,
    surface,
    onReplacePartImage,
    onOpenPartStyle,
    onEditWithAiPart,
  };
}

const titles = (kernel: ReturnType<typeof promoKernel>) => promoProps(kernel).items.map((item) => item.title);

describe('EditorCanvas — block parts', () => {
  it('a click focuses the part under the pointer, selects its block, and names it on the chip and aloud', () => {
    const h = harness();
    h.tick();
    h.click(h.part('heading'));
    expect(h.state().selection).toEqual(['promo']);
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'heading', index: [] });
    expect(h.outline('selection')?.textContent).toBe('Heading · Promo');
    expect(h.outline('selection')).toHaveAttribute('data-part');
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent('Heading in Promo selected');
    // A repeated part is addressed with its index.
    h.click(h.part('item.title', 1));
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'item.title', index: [1] });
    expect(screen.getByRole('status', { name: 'Selection' })).toHaveTextContent('Feature title 2 in Promo selected');
  });

  it('a click on the block body outside any part selects the whole block and clears the part', () => {
    const h = harness();
    h.tick();
    h.click(h.part('heading'));
    h.click(h.inFrame('[data-bldr-node="promo"]'));
    expect(h.state().selection).toEqual(['promo']);
    expect(h.state().partFocus ?? null).toBeNull();
    expect(h.outline('selection')).not.toHaveAttribute('data-part');
  });

  it('hover outlines the part with its chip, and never crosses into a nested node', () => {
    const h = harness();
    h.tick();
    h.pointerMove(h.part('cta'));
    expect(h.outline('hover')?.textContent).toBe('Button · Promo');
    // The chip block nested in the promo's slot owns its own part.
    h.pointerMove(h.inFrame('[data-bldr-node="chip"] [data-ck-part="label"]'));
    expect(h.outline('hover')?.textContent).toBe('Label · Chip');
    h.pointerMove(h.inFrame('[data-bldr-node="chip"]'));
    expect(h.outline('hover')?.textContent).toBe('Chip');
    expect(h.state().partFocus ?? null).toBeNull(); // hover never enters the kernel
  });

  it('a double-click edits the part in place; ONE commit is ONE transaction and ONE Undo', () => {
    const h = harness();
    h.tick();
    h.doubleClick(h.part('heading'));
    const editable = h.surface();
    expect(editable).not.toBeNull();
    expect(h.part('heading')?.contains(editable)).toBe(true);
    expect(editable).toHaveAttribute('aria-label', 'Heading');
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'heading', index: [] });
    const before = h.kernel.transactions().length;
    act(() => {
      editable!.textContent = 'Hello there';
      editable!.dispatchEvent(new Event('input', { bubbles: true }));
      editable!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(h.kernel.transactions().length).toBe(before + 1);
    expect(promoProps(h.kernel).heading).toBe('Hello there');
    act(() => {
      h.kernel.undo();
    });
    expect(promoProps(h.kernel).heading).toBe('Welcome');
  });

  it('a nested text part commits at its own path, leaving its siblings alone', () => {
    const h = harness();
    h.tick();
    h.doubleClick(h.part('item.title', 2));
    const editable = h.surface();
    expect(editable).not.toBeNull();
    act(() => {
      editable!.textContent = 'Simpler';
      editable!.dispatchEvent(new Event('input', { bubbles: true }));
      editable!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(titles(h.kernel)).toEqual(['Fast', 'Safe', 'Simpler']);
    expect(h.kernel.history?.().entries().at(-1)?.label).toBe('Edit text · Promo feature title 3');
  });

  it('a double-click on an image part asks the host for its asset picker', () => {
    const h = harness();
    h.tick();
    h.doubleClick(h.part('image'));
    expect(h.onReplacePartImage).toHaveBeenCalledWith({ kind: 'part', nodeId: 'promo', part: 'image', index: [] });
    expect(h.surface()).toBeNull();
  });

  it('Escape takes the layers in order: inline edit, part, block, parent, nothing', async () => {
    const h = harness();
    h.tick();
    h.doubleClick(h.part('heading'));
    const editable = h.surface()!;
    await act(async () => {
      editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });
    expect(h.surface()).toBeNull();
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'heading', index: [] });
    h.key({ key: 'Escape' });
    expect(h.state().partFocus ?? null).toBeNull();
    expect(h.state().selection).toEqual(['promo']);
    h.key({ key: 'Escape' });
    expect(h.state().selection).toEqual(['root']);
    h.key({ key: 'Escape' });
    expect(h.state().selection).toEqual([]);
  });

  it('Enter opens the focused text part; Tab and Shift+Tab walk the parts and leave at the ends', () => {
    const h = harness();
    h.tick();
    h.click(h.part('heading'));
    h.key({ key: 'Tab' });
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'cta', index: [] });
    h.key({ key: 'Tab', shiftKey: true });
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'heading', index: [] });
    // At the first part Shift+Tab is NOT claimed: the keyboard can leave the canvas.
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => {
      h.host().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    h.key({ key: 'Enter' });
    expect(h.surface()).not.toBeNull();
  });

  it('with an item focused, Delete removes it and Alt+↑ moves it — each ONE Undo, the focus following', () => {
    const h = harness();
    h.tick();
    h.click(h.part('item', 1));
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'item', index: [1] });
    const before = h.kernel.transactions().length;
    h.key({ key: 'Delete' });
    expect(titles(h.kernel)).toEqual(['Fast', 'Simple']);
    expect(h.kernel.transactions().length).toBe(before + 1);
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'item', index: [1] });
    expect(screen.getByRole('status', { name: 'Gesture' })).toHaveTextContent('Remove item · Feature 2');
    h.key({ key: 'ArrowUp', altKey: true });
    expect(titles(h.kernel)).toEqual(['Simple', 'Fast']);
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'item', index: [0] });
    // The block itself never moved.
    expect(h.kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['promo']);
    act(() => {
      h.kernel.undo();
    });
    expect(titles(h.kernel)).toEqual(['Fast', 'Simple']);
  });

  it('the part quick bar replaces the block bar; its style write lands in partStyles as ONE transaction', async () => {
    const h = harness();
    h.tick();
    h.click(h.part('heading'));
    const toolbar = screen.getByRole('toolbar', { name: /Heading · Promo/u });
    expect(toolbar).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: /^Actions for/u })).toBeNull();
    // Attribute-only groups are not offered on a part.
    expect(toolbar.querySelector('[data-group="direction"]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Alignment' }));
    const before = h.kernel.transactions().length;
    await userEvent.click(await screen.findByRole('radio', { name: 'Centre' }));
    expect(h.kernel.transactions().length - before).toBe(1);
    expect(promoProps(h.kernel).partStyles).toEqual({ heading: { className: 'text-center' } });
    expect(h.part('heading')?.className).toContain('text-center');
    // Direction is a part action: the override lands on the element itself.
    fireEvent.click(screen.getByRole('button', { name: 'Left to right' }));
    expect(promoProps(h.kernel).partStyles).toEqual({ heading: { className: 'text-center', dir: 'ltr' } });
    expect(h.part('heading')).toHaveAttribute('dir', 'ltr');
  });

  it('More and Edit with AI reach the host with the part target', () => {
    const h = harness();
    h.tick();
    h.click(h.part('cta'));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(h.onOpenPartStyle).toHaveBeenCalledWith(expect.any(String), {
      kind: 'part',
      nodeId: 'promo',
      part: 'cta',
      index: [],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit with AI' }));
    expect(h.onEditWithAiPart).toHaveBeenCalledWith({ kind: 'part', nodeId: 'promo', part: 'cta', index: [] });
  });

  it('the bar never covers an open inline editor', () => {
    const h = harness();
    h.tick();
    h.doubleClick(h.part('heading'));
    expect(h.surface()).not.toBeNull();
    expect(screen.queryByRole('toolbar', { name: /Heading · Promo/u })).toBeNull();
  });

  // ── block-parts (2026-10-06) ──
  it('a click on a link part selects it and never navigates the canvas', () => {
    const h = harness();
    h.tick();
    const link = h.part('cta')!;
    expect(link.tagName).toBe('A');
    h.pointerMove(link); // the hit test now answers with the link
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 1, clientY: 1 });
    act(() => {
      link.dispatchEvent(event);
    });
    h.tick();
    expect(event.defaultPrevented).toBe(true);
    expect(h.frameDocument.defaultView?.location.href).toBe('about:blank');
    expect(h.state().partFocus).toEqual({ id: 'promo', part: 'cta', index: [] });
  });

  // ── /block-parts ──
  it('an RTL page speaks Arabic, and English text keeps its own direction', () => {
    const h = harness({ dir: 'rtl', arabic: true });
    h.tick();
    expect(h.part('cta')).toHaveAttribute('dir', 'auto');
    h.click(h.part('heading'));
    expect(screen.getByRole('status', { name: 'التحديد' })).toHaveTextContent('حُدِّد العنوان في Promo');
    expect(h.outline('selection')?.textContent).toBe('العنوان · Promo');
    h.click(h.part('item', 0));
    expect(screen.getByRole('toolbar', { name: /ميزة 1/u })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إزالة العنصر' }));
    expect(titles(h.kernel)).toEqual(['Safe', 'Simple']);
    expect(screen.getByRole('status', { name: 'الإيماءة' })).toHaveTextContent('إزالة العنصر · ميزة 1');
  });
});
