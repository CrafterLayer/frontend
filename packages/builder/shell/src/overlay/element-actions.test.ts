import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { performBlockAction, resolveBlockActions } from './block-actions';
import {
  createMemoryStyleClipboard,
  performElementAction,
  resolveElementActions,
  shiftAfterInsert,
} from './element-actions';
import { permissiveUtilityOracle, storedTree, treeKernel } from './tree-test-kit';

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'p-4',
      children: [
        { kind: 'element', tag: 'h2', className: 'text-2xl text-accent', text: 'Our story' },
        { kind: 'element', tag: 'p', className: 'text-base', text: 'Body' },
        { kind: 'element', tag: 'p', text: 'Tail' },
      ],
    },
  ],
};

const texts = (tree: CustomCodeRoot) =>
  (tree.children[0]?.kind === 'element' ? (tree.children[0].children ?? []) : []).map((node) =>
    node.kind === 'element' ? node.text : node.kind,
  );

describe('element actions (DESIGN §A.6 — the region bug)', () => {
  it('Delete with an element focused removes ONLY the element, in one transaction', () => {
    const kernel = treeKernel([TREE]);
    kernel.focusElement('r1', [0, 0]);
    const before = kernel.transactions().length;
    const result = performBlockAction(kernel, 'r1', 'delete');
    expect(result.ok).toBe(true);
    // The region survives; only the heading went.
    expect(kernel.getDocument().nodes['r1']).toBeDefined();
    expect(texts(storedTree(kernel))).toEqual(['Body', 'Tail']);
    expect(kernel.transactions().length - before).toBe(1);
    // Focus lands on the sibling that took the seat.
    expect(kernel.context.store.getState().elementFocus).toEqual({ id: 'r1', path: [0, 0] });
  });

  it('resolves the block bar to element gates while an element is focused', () => {
    const kernel = treeKernel([TREE]);
    kernel.focusElement('r1', [0, 0]);
    const actions = resolveBlockActions(kernel, 'r1');
    expect(actions.find((action) => action.id === 'moveEarlier')?.enabled).toBe(false);
    expect(actions.find((action) => action.id === 'moveLater')?.enabled).toBe(true);
    expect(actions.find((action) => action.id === 'delete')?.enabled).toBe(true);
  });

  it('duplicates and focuses the copy', () => {
    const kernel = treeKernel([TREE]);
    kernel.focusElement('r1', [0, 1]);
    performElementAction(kernel, [{ kind: 'tree', nodeId: 'r1', path: [0, 1] }], 'duplicate');
    expect(texts(storedTree(kernel))).toEqual(['Our story', 'Body', 'Body', 'Tail']);
    expect(kernel.context.store.getState().elementFocus?.path).toEqual([0, 2]);
  });

  it('applies a multi-selection delete as one transaction', () => {
    const kernel = treeKernel([TREE]);
    kernel.focusElement('r1', [0, 0]);
    const before = kernel.transactions().length;
    performElementAction(
      kernel,
      [
        { kind: 'tree', nodeId: 'r1', path: [0, 0] },
        { kind: 'tree', nodeId: 'r1', path: [0, 2] },
      ],
      'delete',
    );
    expect(texts(storedTree(kernel))).toEqual(['Body']);
    expect(kernel.transactions().length - before).toBe(1);
  });

  it('moves later and keeps the element focused at its new seat', () => {
    const kernel = treeKernel([TREE]);
    kernel.focusElement('r1', [0, 0]);
    performElementAction(kernel, [{ kind: 'tree', nodeId: 'r1', path: [0, 0] }], 'moveLater');
    expect(texts(storedTree(kernel))).toEqual(['Body', 'Our story', 'Tail']);
    expect(kernel.context.store.getState().elementFocus?.path).toEqual([0, 1]);
  });

  it('wraps contiguous siblings and refuses scattered ones', () => {
    const kernel = treeKernel([TREE]);
    const scattered = resolveElementActions(kernel, [
      { kind: 'tree', nodeId: 'r1', path: [0, 0] },
      { kind: 'tree', nodeId: 'r1', path: [0, 2] },
    ]);
    expect(scattered.find((action) => action.id === 'wrap')?.enabled).toBe(false);
    performElementAction(
      kernel,
      [
        { kind: 'tree', nodeId: 'r1', path: [0, 0] },
        { kind: 'tree', nodeId: 'r1', path: [0, 1] },
      ],
      'wrap',
    );
    const section = storedTree(kernel).children[0];
    expect(section?.kind === 'element' ? section.children?.length : 0).toBe(2);
  });

  it('copies a style and pastes it onto another element', () => {
    const kernel = treeKernel([TREE]);
    const clipboard = createMemoryStyleClipboard();
    performElementAction(kernel, [{ kind: 'tree', nodeId: 'r1', path: [0, 0] }], 'copyStyle', {
      styleClipboard: clipboard,
    });
    expect(clipboard.read()).toContain('text-accent');
    performElementAction(kernel, [{ kind: 'tree', nodeId: 'r1', path: [0, 2] }], 'pasteStyle', {
      styleClipboard: clipboard,
    });
    const tail = storedTree(kernel).children[0];
    const node = tail?.kind === 'element' ? tail.children?.[2] : undefined;
    expect(node?.kind === 'element' ? node.className : '').toContain('text-accent');
  });

  it('hides on the mobile bucket with max-md:hidden and shows again', () => {
    const kernel = treeKernel([TREE]);
    const target = [{ kind: 'tree' as const, nodeId: 'r1', path: [0, 1] }];
    performElementAction(kernel, target, 'hideOnBucket', { bucket: 'mobile' });
    const body = () => {
      const section = storedTree(kernel).children[0];
      const node = section?.kind === 'element' ? section.children?.[1] : undefined;
      return node?.kind === 'element' ? (node.className ?? '') : '';
    };
    expect(body()).toContain('max-md:hidden');
    expect(resolveElementActions(kernel, target, { bucket: 'mobile' }).find((a) => a.id === 'hideOnBucket')?.pressed).toBe(true);
    performElementAction(kernel, target, 'hideOnBucket', { bucket: 'mobile' });
    expect(body()).not.toContain('hidden');
  });

  it('shifts paths after an insert only for later siblings', () => {
    expect(shiftAfterInsert([0, 2], [0, 1])).toEqual([0, 3]);
    expect(shiftAfterInsert([0, 0], [0, 1])).toEqual([0, 0]);
    expect(shiftAfterInsert([1, 0], [0, 1])).toEqual([1, 0]);
  });
});
