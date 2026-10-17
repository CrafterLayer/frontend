import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { lightTheme } from '@craftkit/builder-renderer';
import type { CustomCodeRoot, StyleState } from '@craftkit/builder-schema';

import type { GeometryPorts } from '../../rects';
import { createElementSelection } from '../../selection/element-selection';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { permissiveUtilityOracle, storedTree, treeKernel } from '../../overlay/tree-test-kit';
import { EditorCanvas } from './EditorCanvas';
import { unlockedPath } from './element-canvas-helpers';

/*
  P7 canvas chrome, end to end through the real canvas: the element quick bar
  replaces the block action bar, its actions act on the ELEMENT (the region
  bug), locked elements pass clicks to their parent, Shift-click builds a
  multi-selection, the panel's state stamps the forced-state attribute, and
  Alt+F10 / double-click reach the bar and in-place text editing.
*/

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'flex gap-4',
      children: [
        { kind: 'element', tag: 'h2', className: 'text-2xl', text: 'Our story' },
        { kind: 'element', tag: 'p', text: 'Body', locked: true },
        { kind: 'element', tag: 'a', className: 'hover:bg-accent', text: 'Read more', attributes: { href: '#more' } },
      ],
    },
  ],
};

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

function harness(props: { styleState?: StyleState } = {}) {
  const kernel = treeKernel([TREE]);
  const selection = createElementSelection(kernel);
  const queue: (() => void)[] = [];
  let hitTarget: Element | null = null;
  const ports: Partial<GeometryPorts> = {
    measure: () => ({ x: 5, y: 60, width: 200, height: 40 }),
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
  const onOpenStyleSector = vi.fn();
  const element = (styleState: StyleState) => (
    <EditorCanvas
      kernel={kernel}
      theme={lightTheme}
      geometryPorts={ports}
      floatingPorts={floatingPorts}
      editable
      elementSelection={selection}
      styleState={styleState}
      onOpenStyleSector={onOpenStyleSector}
    />
  );
  const view = render(element(props.styleState ?? 'default'));
  const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
  // The floating hosts only show over a frame with a visible area.
  frame.getBoundingClientRect = () => ({ x: 0, y: 0, width: 800, height: 600 }) as DOMRect;
  const frameDocument = frame.contentDocument!;
  const tick = () => {
    act(() => {
      for (const callback of queue.splice(0)) callback();
    });
  };
  const inFrame = (selector: string) => frameDocument.querySelector<HTMLElement>(selector);
  const click = (target: Element | null, init: MouseEventInit = {}) => {
    hitTarget = target;
    act(() => {
      frameDocument.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 1, ...init }));
    });
    tick();
  };
  const state = () => kernel.context.store.getState();
  const host = () => screen.getByRole('region', { name: 'Editor canvas' });
  return {
    kernel,
    selection,
    view,
    frameDocument,
    tick,
    inFrame,
    click,
    state,
    host,
    onOpenStyleSector,
    rerender: (styleState: StyleState) => {
      view.rerender(element(styleState));
      tick();
    },
    setHit: (target: Element | null) => {
      hitTarget = target;
    },
  };
}

const headings = (tree: CustomCodeRoot) => {
  const section = tree.children[0];
  return section?.kind === 'element' ? (section.children ?? []).map((node) => (node.kind === 'element' ? node.tag : '')) : [];
};

describe('EditorCanvas — P7 element chrome', () => {
  it('with an element focused, the quick bar replaces the block bar and Delete removes ONLY the element', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0, 0] });
    expect(screen.getByRole('toolbar', { name: /Our story/u })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: /^Actions for/u })).toBeNull();
    const before = h.kernel.transactions().length;
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(h.kernel.transactions().length - before).toBe(1);
    // The region is still there; only the heading went.
    expect(h.kernel.getDocument().nodes['r1']).toBeDefined();
    expect(headings(storedTree(h.kernel))).toEqual(['p', 'a']);
  });

  it('a locked element passes the click to its parent', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('p'));
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0] });
    expect(unlockedPath(h.kernel, 'r1', [0, 1])).toEqual([0]);
    expect(unlockedPath(h.kernel, 'r1', [0, 0])).toEqual([0, 0]);
  });

  it('Shift-click adds an element to the multi-selection', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    h.click(h.inFrame('a'), { shiftKey: true });
    expect(h.selection.targets()).toEqual([
      { kind: 'tree', nodeId: 'r1', path: [0, 0] },
      { kind: 'tree', nodeId: 'r1', path: [0, 2] },
    ]);
    expect(screen.getByRole('toolbar', { name: /Our story/u })).toBeInTheDocument();
  });

  it('a forced Hover state stamps data-ck-state on the focused element and removes it again', () => {
    const h = harness({ styleState: 'hover' });
    h.tick();
    h.click(h.inFrame('a'));
    expect(h.inFrame('a')).toHaveAttribute('data-ck-state', 'hover');
    h.rerender('default');
    expect(h.inFrame('a')).not.toHaveAttribute('data-ck-state');
  });

  it('Alt+F10 moves focus into the quick bar; Escape there returns it to the canvas', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    fireEvent.keyDown(h.host(), { key: 'F10', altKey: true });
    const toolbar = screen.getByRole('toolbar', { name: /Our story/u });
    expect(toolbar.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(document.activeElement).toBe(h.host());
    // The element is still focused — Escape in the bar is not "leave the element".
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0, 0] });
  });

  it('double-click edits tree text in place; Escape abandons it without a write', () => {
    const h = harness();
    h.tick();
    const heading = h.inFrame('h2')!;
    h.setHit(heading);
    act(() => {
      h.frameDocument.dispatchEvent(new MouseEvent('dblclick', { clientX: 1, clientY: 1 }));
    });
    expect(heading).toHaveAttribute('contenteditable', 'plaintext-only');
    const before = h.kernel.transactions().length;
    (heading.firstChild as Text).data = 'Changed';
    act(() => {
      heading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(heading).not.toHaveAttribute('contenteditable');
    expect(h.kernel.transactions().length - before).toBe(0);
    expect(heading.textContent).toBe('Our story');
  });

  it('Enter on a focused text element edits it; Enter there commits one transaction', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    fireEvent.keyDown(h.host(), { key: 'Enter' });
    const heading = h.inFrame('h2')!;
    expect(heading).toHaveAttribute('contenteditable', 'plaintext-only');
    (heading.firstChild as Text).data = 'Our new story';
    const before = h.kernel.transactions().length;
    act(() => {
      heading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(h.kernel.transactions().length - before).toBe(1);
    expect(h.inFrame('h2')?.textContent).toBe('Our new story');
  });

  it('Shift+Enter steps to the parent element', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    fireEvent.keyDown(h.host(), { key: 'Enter', shiftKey: true });
    expect(h.state().elementFocus).toEqual({ id: 'r1', path: [0] });
  });

  it('clicking iframe text while editing keeps the caret session open', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    fireEvent.keyDown(h.host(), { key: 'Enter' });
    const heading = h.inFrame('h2')!;
    act(() => { heading.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(heading).toHaveAttribute('contenteditable', 'plaintext-only');
    expect(h.frameDocument.activeElement).toBe(heading);
    expect(h.kernel.transactions()).toHaveLength(0);
  });

  it('More opens the matching panel sector for the element', () => {
    const h = harness();
    h.tick();
    h.click(h.inFrame('h2'));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(h.onOpenStyleSector).toHaveBeenCalledWith('typography', { kind: 'tree', nodeId: 'r1', path: [0, 0] });
  });
});
