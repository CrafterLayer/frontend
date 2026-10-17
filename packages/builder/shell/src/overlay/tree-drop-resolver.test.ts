import { afterEach, describe, expect, it } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { tryDispatchTreeEdits } from '../custom-code/element-target';
import { storedTree, treeKernel } from './tree-test-kit';
import {
  resolveTreeDropTarget,
  treeDropSteps,
  treeParentAccepts,
  type Box,
  type LayoutAxis,
  type TreeDropPorts,
} from './tree-drop-resolver';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'div',
      className: 'flex flex-row',
      children: [
        { kind: 'element', tag: 'p', text: 'A' },
        { kind: 'element', tag: 'p', text: 'B' },
        { kind: 'element', tag: 'p', text: 'C' },
      ],
    },
  ],
};

/**
 * A hand-built canvas: the region wrapper, the custom-code root, a flex row
 * and its three cards laid out in the PAGE direction (RTL: the first card is
 * the rightmost).
 */
function canvas(dir: 'ltr' | 'rtl') {
  document.body.innerHTML = `
    <div data-bldr-node="r1">
      <div data-ck-custom-code>
        <div data-ck-path="0">
          <p data-ck-path="0.0">A</p><p data-ck-path="0.1">B</p><p data-ck-path="0.2">C</p>
        </div>
      </div>
    </div>`;
  const q = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const region = q('[data-ck-custom-code]');
  const row = q('[data-ck-path="0"]');
  const cards = [q('[data-ck-path="0.0"]'), q('[data-ck-path="0.1"]'), q('[data-ck-path="0.2"]')];
  const xs = dir === 'rtl' ? [200, 100, 0] : [0, 100, 200];
  const boxes = new Map<Element, Box>([
    [region, { x: 0, y: 0, width: 300, height: 100 }],
    [row, { x: 0, y: 0, width: 300, height: 100 }],
    ...cards.map((card, at): [Element, Box] => [card, { x: xs[at] ?? 0, y: 0, width: 100, height: 100 }]),
  ]);
  const axes = new Map<Element, LayoutAxis>([
    [row, { axis: 'inline', reverse: false }],
    [region, { axis: 'block', reverse: false }],
  ]);
  const ports: TreeDropPorts = {
    hitTest: (_doc, x) => {
      const card = cards.find((element) => {
        const box = boxes.get(element);
        return box !== undefined && x >= box.x && x < box.x + box.width;
      });
      return card ?? row;
    },
    measure: (element) => boxes.get(element) ?? { x: 0, y: 0, width: 0, height: 0 },
    axisOf: (element) => axes.get(element) ?? { axis: 'block', reverse: false },
  };
  return ports;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('tree drop resolution (DESIGN §E, RTL-aware)', () => {
  it('in RTL, the LEFT half of a card in a flex row is AFTER it', () => {
    const kernel = treeKernel([TREE], 'rtl');
    const ports = canvas('rtl');
    // Card B spans x 100–200; x = 120 is its left half: in RTL that is its end.
    const target = resolveTreeDropTarget({
      kernel,
      frameDocument: document,
      payload: { kind: 'tree-insert', node: { kind: 'element', tag: 'p', text: 'New' }, label: 'Text' },
      x: 120,
      y: 50,
      dir: 'rtl',
      ports,
    });
    expect(target).toMatchObject({ regionId: 'r1', parent: [0], index: 2 });
    // The insertion line sits on B's physical LEFT edge — its inline end.
    expect(target?.indicatorRect.x).toBe(99);
  });

  it('in LTR, the same left half is BEFORE the card', () => {
    const kernel = treeKernel([TREE], 'ltr');
    const ports = canvas('ltr');
    const target = resolveTreeDropTarget({
      kernel,
      frameDocument: document,
      payload: { kind: 'tree-insert', node: { kind: 'element', tag: 'p', text: 'New' }, label: 'Text' },
      x: 120,
      y: 50,
      dir: 'ltr',
      ports,
    });
    expect(target).toMatchObject({ parent: [0], index: 1 });
  });

  it('reports a same-parent move in post-removal terms and commits one move', () => {
    const kernel = treeKernel([TREE], 'rtl');
    const ports = canvas('rtl');
    const payload = { kind: 'tree-move' as const, id: 'r1', path: [0, 0] };
    // Over C's right half (x 0–100, right half 50–100) in RTL: before C → raw 2, post-removal 1.
    const target = resolveTreeDropTarget({ kernel, frameDocument: document, payload, x: 70, y: 50, dir: 'rtl', ports });
    expect(target).toMatchObject({ parent: [0], index: 1 });
    const plan = target === null ? undefined : treeDropSteps(payload, target);
    expect(plan).toBeDefined();
    const before = kernel.transactions().length;
    tryDispatchTreeEdits(kernel, plan?.steps ?? [], 'Move · A');
    expect(kernel.transactions().length - before).toBe(1);
    const row = storedTree(kernel).children[0];
    const order = row?.kind === 'element' ? row.children?.map((n) => (n.kind === 'element' ? n.text : '')) : [];
    expect(order).toEqual(['B', 'A', 'C']);
    expect(plan?.focus).toEqual({ id: 'r1', path: [0, 1] });
  });

  it('a drop onto the element’s own seat changes nothing', () => {
    const kernel = treeKernel([TREE], 'ltr');
    const ports = canvas('ltr');
    const payload = { kind: 'tree-move' as const, id: 'r1', path: [0, 1] };
    const target = resolveTreeDropTarget({ kernel, frameDocument: document, payload, x: 110, y: 50, dir: 'ltr', ports });
    expect(target === null ? 'none' : treeDropSteps(payload, target)).toBeUndefined();
  });

  it('is null outside any custom-code region', () => {
    const kernel = treeKernel([TREE]);
    document.body.innerHTML = '<div id="plain"></div>';
    const target = resolveTreeDropTarget({
      kernel,
      frameDocument: document,
      payload: { kind: 'tree-insert', node: { kind: 'element', tag: 'p', text: 'x' }, label: 'Text' },
      x: 5,
      y: 5,
      dir: 'ltr',
      ports: { hitTest: () => document.getElementById('plain') },
    });
    expect(target).toBeNull();
  });
});

describe('tree drops follow the HTML content model (fix pass 2026-10-06)', () => {
  const tree: CustomCodeRoot = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'div',
        children: [
          {
            kind: 'element',
            tag: 'p',
            children: [{ kind: 'element', tag: 'a', attributes: { href: '#x' }, children: [] }],
          },
          { kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: '' } },
        ],
      },
    ],
  };

  it('refuses a heading in a paragraph, even through a link inside it', () => {
    expect(treeParentAccepts(tree, [0, 0], 'h2')).toBe(false);
    expect(treeParentAccepts(tree, [0, 0, 0], 'h2')).toBe(false);
    expect(treeParentAccepts(tree, [0, 0], 'strong')).toBe(true);
    expect(treeParentAccepts(tree, [0], 'h2')).toBe(true);
    expect(treeParentAccepts(tree, [], 'h2')).toBe(true);
  });

  it('refuses anything inside a void element and a link inside a link', () => {
    expect(treeParentAccepts(tree, [0, 1], 'span')).toBe(false);
    expect(treeParentAccepts(tree, [0, 0, 0], 'a')).toBe(false);
  });

  it('a heading dropped over a paragraph lands beside it, never inside it', () => {
    const paragraphTree: CustomCodeRoot = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'div',
          className: 'flex flex-row',
          children: [
            { kind: 'element', tag: 'p', children: [{ kind: 'element', tag: 'span', text: 'A' }] },
            { kind: 'element', tag: 'p', text: 'B' },
            { kind: 'element', tag: 'p', text: 'C' },
          ],
        },
      ],
    };
    const kernel = treeKernel([paragraphTree], 'ltr');
    const ports = canvas('ltr');
    const target = resolveTreeDropTarget({
      kernel,
      frameDocument: document,
      payload: { kind: 'tree-insert', node: { kind: 'element', tag: 'h2', text: 'H' }, label: 'Heading' },
      x: 50,
      y: 50,
      dir: 'ltr',
      ports,
    });
    expect(target?.parent).toEqual([0]);
  });
});
