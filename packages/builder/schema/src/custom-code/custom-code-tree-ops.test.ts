import { describe, expect, it } from 'vitest';

import type { CustomCodeNode, CustomCodeRoot } from './custom-code-tree';
import {
  adjustAfterRemoval,
  duplicateNodeAt,
  extractNodeAt,
  formatTextRange,
  insertNodeAt,
  moveNode,
  patchNodeAt,
  removeNodeAt,
  setNodeAt,
  similarSiblings,
  treeNodeAt,
  unwrapNodeAt,
  wrapNodesAt,
} from './custom-code-tree-ops';

const el = (tag: string, extra: Partial<Record<string, unknown>> = {}): CustomCodeNode =>
  ({ kind: 'element', tag, ...extra }) as CustomCodeNode;

function sample(): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      el('section', {
        className: 'p-4',
        children: [
          el('h2', { text: 'Our story' }),
          el('p', { className: 'text-sm mt-2', text: 'One' }),
          el('p', { className: 'mt-2 text-sm', text: 'Two' }),
          el('p', { className: 'text-lg', text: 'Three' }),
          { kind: 'icon', name: 'mail' },
        ],
      }),
      el('footer', { text: 'End' }),
    ],
  };
}

const frozen = (): CustomCodeRoot => {
  const tree = sample();
  return JSON.parse(JSON.stringify(tree)) as CustomCodeRoot;
};

describe('insertNodeAt', () => {
  it('inserts at an index and leaves the input untouched', () => {
    const tree = sample();
    const before = JSON.stringify(tree);
    const result = insertNodeAt(tree, [0], 1, el('hr'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toEqual([0, 1]);
    expect(treeNodeAt(result.tree, [0, 1])).toEqual(el('hr'));
    expect(JSON.stringify(tree)).toBe(before);
    // Untouched branches are shared by reference.
    expect(result.tree.children[1]).toBe(tree.children[1]);
  });

  it('appends at the root and into an empty element', () => {
    const appended = insertNodeAt(sample(), [], 2, el('div'));
    expect(appended.ok && appended.path).toEqual([2]);
    const nested = insertNodeAt(sample(), [1], 0, el('span', { text: 'x' }));
    expect(nested.ok && treeNodeAt(nested.tree, [1, 0])).toEqual(el('span', { text: 'x' }));
  });

  it('refuses a bad index, a missing parent and an icon parent with repair-ready messages', () => {
    const range = insertNodeAt(sample(), [0], 9, el('hr'));
    expect(range).toMatchObject({ ok: false, code: 'index-out-of-range' });
    expect(!range.ok && range.message).toContain('send an index from 0 to 5');
    expect(insertNodeAt(sample(), [7], 0, el('hr'))).toMatchObject({ code: 'path-not-found' });
    const icon = insertNodeAt(sample(), [0, 4], 0, el('hr'));
    expect(icon).toMatchObject({ code: 'not-a-container' });
    expect(!icon.ok && icon.message).toMatch(/ · /u);
  });
});

describe('removeNodeAt / extractNodeAt', () => {
  it('removes and returns the node; an emptied element drops its children key', () => {
    const result = removeNodeAt(sample(), [0, 0]);
    expect(result.ok && result.removed).toEqual(el('h2', { text: 'Our story' }));
    const single: CustomCodeRoot = { kind: 'root', children: [el('div', { children: [el('br')] })] };
    const emptied = removeNodeAt(single, [0, 0]);
    expect(emptied.ok && emptied.tree.children[0]).toEqual(el('div'));
  });

  it('refuses the root and missing paths', () => {
    expect(removeNodeAt(sample(), [])).toMatchObject({ ok: false, code: 'path-not-found' });
    expect(extractNodeAt(sample(), [0, 9])).toMatchObject({ ok: false, code: 'path-not-found' });
  });
});

describe('moveNode', () => {
  it('reorders within a parent with post-removal index semantics', () => {
    const result = moveNode(sample(), [0, 0], [0], 4);
    expect(result.ok && result.path).toEqual([0, 4]);
    if (!result.ok) return;
    expect(treeNodeAt(result.tree, [0, 4])).toEqual(el('h2', { text: 'Our story' }));
    expect(treeNodeAt(result.tree, [0, 0])).toEqual(el('p', { className: 'text-sm mt-2', text: 'One' }));
  });

  it('reads the destination in pre-move coordinates when an earlier sibling moves', () => {
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [el('span', { text: 'a' }), el('div', { children: [el('br')] })],
    };
    // [1] is the div BEFORE the move; after taking out [0] it is [0].
    const result = moveNode(tree, [0], [1], 1);
    expect(result.ok && result.path).toEqual([0, 1]);
    expect(result.ok && result.tree.children).toHaveLength(1);
  });

  it('refuses moving into itself', () => {
    expect(moveNode(sample(), [0], [0, 1], 0)).toMatchObject({ code: 'into-itself' });
    expect(moveNode(sample(), [0], [0], 0)).toMatchObject({ code: 'into-itself' });
  });

  it('moves across trees as an extract + insert pair', () => {
    const a = sample();
    const b: CustomCodeRoot = { kind: 'root', children: [el('div')] };
    const taken = extractNodeAt(a, [0, 1]);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const placed = insertNodeAt(b, [0], 0, taken.removed);
    expect(placed.ok && treeNodeAt(placed.tree, [0, 0])).toEqual(
      el('p', { className: 'text-sm mt-2', text: 'One' }),
    );
    expect(treeNodeAt(taken.tree, [0, 1])).toEqual(el('p', { className: 'mt-2 text-sm', text: 'Two' }));
  });

  it('adjustAfterRemoval only shifts later siblings and their subtrees', () => {
    expect(adjustAfterRemoval([0, 3, 1], [0, 1])).toEqual([0, 2, 1]);
    expect(adjustAfterRemoval([0, 1], [0, 1])).toEqual([0, 1]);
    expect(adjustAfterRemoval([1, 3], [0, 1])).toEqual([1, 3]);
    expect(adjustAfterRemoval([], [0])).toEqual([]);
  });
});

describe('duplicateNodeAt', () => {
  it('inserts a deep copy after the original that shares nothing with it', () => {
    const result = duplicateNodeAt(sample(), [0]);
    expect(result.ok && result.path).toEqual([1]);
    if (!result.ok) return;
    expect(result.tree.children[1]).toEqual(result.tree.children[0]);
    expect(result.tree.children[1]).not.toBe(result.tree.children[0]);
    expect(duplicateNodeAt(sample(), [5])).toMatchObject({ code: 'path-not-found' });
  });
});

describe('wrapNodesAt / unwrapNodeAt', () => {
  it('round-trips: wrap contiguous siblings then unwrap restores the exact tree', () => {
    const original = frozen();
    const wrapped = wrapNodesAt(original, [[0, 2], [0, 1]], { tag: 'div', className: ' grid gap-2 ' });
    expect(wrapped.ok && wrapped.path).toEqual([0, 1]);
    if (!wrapped.ok) return;
    expect(treeNodeAt(wrapped.tree, [0, 1])).toMatchObject({
      tag: 'div',
      className: 'grid gap-2',
      children: [{ text: 'One' }, { text: 'Two' }],
    });
    const unwrapped = unwrapNodeAt(wrapped.tree, wrapped.path);
    expect(unwrapped.ok && unwrapped.paths).toEqual([
      [0, 1],
      [0, 2],
    ]);
    expect(unwrapped.ok && unwrapped.tree).toEqual(original);
  });

  it('refuses non-siblings, gaps, duplicates, empty input and unknown wrapper tags', () => {
    expect(wrapNodesAt(sample(), [[0, 1], [1]], { tag: 'div' })).toMatchObject({ code: 'not-siblings' });
    expect(wrapNodesAt(sample(), [[0, 1], [0, 3]], { tag: 'div' })).toMatchObject({ code: 'not-contiguous' });
    expect(wrapNodesAt(sample(), [[0, 1], [0, 1]], { tag: 'div' })).toMatchObject({ code: 'not-contiguous' });
    expect(wrapNodesAt(sample(), [], { tag: 'div' })).toMatchObject({ code: 'empty-selection' });
    expect(wrapNodesAt(sample(), [[0, 1]], { tag: 'blink' })).toMatchObject({ code: 'invalid-value' });
    expect(wrapNodesAt(sample(), [[]], { tag: 'div' })).toMatchObject({ code: 'path-not-found' });
  });

  it('refuses unwrapping what would lose content', () => {
    expect(unwrapNodeAt(sample(), [0, 0])).toMatchObject({ code: 'no-children' });
    expect(unwrapNodeAt(sample(), [0, 4])).toMatchObject({ code: 'not-an-element' });
    const texted: CustomCodeRoot = {
      kind: 'root',
      children: [el('p', { text: 'lead', children: [el('br')] })],
    };
    expect(unwrapNodeAt(texted, [0])).toMatchObject({ code: 'has-text' });
  });
});

describe('patchNodeAt', () => {
  it('sets fields and attributes; null and empty text delete; a bare attribute keeps ""', () => {
    const tree: CustomCodeRoot = {
      kind: 'root',
      children: [el('video', { className: 'w-full', attributes: { src: '/a.mp4', loop: '' } })],
    };
    const result = patchNodeAt(tree, [0], {
      set: { className: '', label: 'Hero video', locked: true },
      attributes: { muted: '', loop: null },
    });
    expect(result.ok && result.node).toEqual({
      kind: 'element',
      tag: 'video',
      label: 'Hero video',
      locked: true,
      attributes: { src: '/a.mp4', muted: '' },
    });
    if (!result.ok) return;
    const unlocked = patchNodeAt(result.tree, [0], {
      set: { locked: false, label: null },
      attributes: { src: null, muted: null },
    });
    expect(unlocked.ok && unlocked.node).toEqual({ kind: 'element', tag: 'video' });
  });

  it('refuses fields the node kind does not have', () => {
    expect(patchNodeAt(sample(), [0, 4], { set: { tag: 'div' } })).toMatchObject({ code: 'not-an-element' });
    expect(patchNodeAt(sample(), [0, 4], { set: { text: 'x' } })).toMatchObject({ code: 'not-an-element' });
    expect(patchNodeAt(sample(), [0, 4], { attributes: { id: 'x' } })).toMatchObject({ code: 'not-an-element' });
    const component: CustomCodeRoot = { kind: 'root', children: [{ kind: 'component', component: 'x' }] };
    expect(patchNodeAt(component, [0], { set: { className: 'p-2' } })).toMatchObject({
      code: 'not-an-element',
    });
    expect(patchNodeAt(sample(), [9], { set: { text: 'x' } })).toMatchObject({ code: 'path-not-found' });
  });

  it('an icon takes a className', () => {
    const result = patchNodeAt(sample(), [0, 4], { set: { className: 'size-4' } });
    expect(result.ok && result.node).toEqual({ kind: 'icon', name: 'mail', className: 'size-4' });
  });
});

describe('setNodeAt', () => {
  it('replaces a node and refuses a missing one', () => {
    const result = setNodeAt(sample(), [1], el('aside', { text: 'x' }));
    expect(result.ok && result.tree.children[1]).toEqual(el('aside', { text: 'x' }));
    expect(setNodeAt(sample(), [4], el('hr'))).toMatchObject({ code: 'path-not-found' });
  });
});

describe('formatTextRange', () => {
  const text = el('p', { className: 'text-lg', text: 'Hello brave world' });

  it('splits into span / mark / span runs', () => {
    const result = formatTextRange(text, 6, 11, 'strong', { className: 'text-accent' });
    expect(result.ok && result.element).toEqual({
      kind: 'element',
      tag: 'p',
      className: 'text-lg',
      children: [
        { kind: 'element', tag: 'span', text: 'Hello ' },
        { kind: 'element', tag: 'strong', text: 'brave', className: 'text-accent' },
        { kind: 'element', tag: 'span', text: ' world' },
      ],
    });
  });

  it('creates no empty edge runs at either edge', () => {
    const atStart = formatTextRange(text, 0, 5, 'em');
    expect(atStart.ok && atStart.element.children?.map((c) => (c.kind === 'element' ? c.tag : ''))).toEqual([
      'em',
      'span',
    ]);
    const atEnd = formatTextRange(text, 12, 17, 'mark');
    expect(atEnd.ok && atEnd.element.children?.map((c) => (c.kind === 'element' ? c.text : ''))).toEqual([
      'Hello brave ',
      'world',
    ]);
    const whole = formatTextRange(text, 0, 17, 'code');
    expect(whole.ok && whole.element.children).toEqual([{ kind: 'element', tag: 'code', text: 'Hello brave world' }]);
  });

  it('writes a link run with its href and refuses one without a safe href', () => {
    const link = formatTextRange(text, 0, 5, 'a', { href: 'https://example.com' });
    expect(link.ok && link.element.children?.[0]).toEqual({
      kind: 'element',
      tag: 'a',
      text: 'Hello',
      attributes: { href: 'https://example.com' },
    });
    expect(formatTextRange(text, 0, 5, 'a')).toMatchObject({ code: 'invalid-value' });
    expect(formatTextRange(text, 0, 5, 'a', { href: 'javascript:alert(1)' })).toMatchObject({
      code: 'invalid-value',
    });
  });

  it('writes underline as a vocabulary-safe run', () => {
    const result = formatTextRange(text, 0, 5, 'u');
    const run = result.ok ? result.element.children?.[0] : undefined;
    expect(run?.kind).toBe('element');
    expect(
      run?.kind === 'element' && ((run.tag as string) === 'u' || (run.tag === 'span' && run.className === 'underline')),
    ).toBe(true);
  });

  it('refuses bad ranges, non-elements and elements that already hold runs', () => {
    expect(formatTextRange(text, 5, 5, 'em')).toMatchObject({ code: 'invalid-range' });
    expect(formatTextRange(text, -1, 3, 'em')).toMatchObject({ code: 'invalid-range' });
    expect(formatTextRange(text, 0, 99, 'em')).toMatchObject({ code: 'invalid-range' });
    expect(formatTextRange({ kind: 'icon', name: 'mail' }, 0, 1, 'em')).toMatchObject({
      code: 'not-an-element',
    });
    expect(formatTextRange(el('p', { children: [el('br')] }), 0, 1, 'em')).toMatchObject({
      code: 'has-children',
    });
  });
});

describe('similarSiblings', () => {
  it('matches tag + sorted class set among siblings, including the node itself', () => {
    expect(similarSiblings(sample(), [0, 1])).toEqual([
      [0, 1],
      [0, 2],
    ]);
    expect(similarSiblings(sample(), [0, 3])).toEqual([[0, 3]]);
    expect(similarSiblings(sample(), [0, 4])).toEqual([[0, 4]]);
    expect(similarSiblings(sample(), [3])).toEqual([]);
    expect(similarSiblings(sample(), [])).toEqual([]);
  });
});
