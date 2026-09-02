import { describe, expect, it } from 'vitest';

import {
  customCodeNodeAtPath,
  formatCustomCodePath,
  parseCustomCodePath,
  replaceCustomCodeNodeAtPath,
} from './custom-code-path';
import type { CustomCodeNode, CustomCodeRoot } from './custom-code-tree';

const portrait: CustomCodeNode = {
  kind: 'element',
  tag: 'img',
  className: 'h-40 w-40 rounded-full',
  attributes: { src: 'https://example.com/a.jpg', alt: 'Portrait' },
};

const tree: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'grid gap-8',
      children: [
        portrait,
        {
          kind: 'element',
          tag: 'div',
          children: [
            { kind: 'element', tag: 'h1', text: 'Reem Haddad' },
            { kind: 'icon', name: 'mail' },
            { kind: 'component', component: 'hero', props: { heading: 'Hi' } },
          ],
        },
      ],
    },
  ],
};

describe('custom-code element paths', () => {
  it('formats and parses a path as the dotted child-index string the renderer stamps', () => {
    expect(formatCustomCodePath([0, 1, 2])).toBe('0.1.2');
    expect(formatCustomCodePath([])).toBe('');
    expect(parseCustomCodePath('0.1.2')).toEqual([0, 1, 2]);
    expect(parseCustomCodePath('7')).toEqual([7]);
  });

  it('refuses a path string that is not a sequence of non-negative integers', () => {
    expect(parseCustomCodePath('')).toBeUndefined();
    expect(parseCustomCodePath('0..1')).toBeUndefined();
    expect(parseCustomCodePath('a.b')).toBeUndefined();
    expect(parseCustomCodePath('-1')).toBeUndefined();
    expect(parseCustomCodePath('0.1.')).toBeUndefined();
    expect(parseCustomCodePath('0 1')).toBeUndefined();
  });

  it('reads the node at a path, for every node kind', () => {
    expect(customCodeNodeAtPath(tree, [0, 0])).toBe(portrait);
    expect(customCodeNodeAtPath(tree, [0, 1, 0])).toEqual({
      kind: 'element',
      tag: 'h1',
      text: 'Reem Haddad',
    });
    expect(customCodeNodeAtPath(tree, [0, 1, 1])).toEqual({ kind: 'icon', name: 'mail' });
    expect(customCodeNodeAtPath(tree, [0, 1, 2])?.kind).toBe('component');
  });

  it('reads tolerantly: a missing branch, a leaf, or junk input yields undefined rather than throwing', () => {
    expect(customCodeNodeAtPath(tree, [3])).toBeUndefined();
    expect(customCodeNodeAtPath(tree, [0, 0, 0])).toBeUndefined(); // an img has no children
    expect(customCodeNodeAtPath(tree, [0, 1, 1, 0])).toBeUndefined(); // icons are leaves
    expect(customCodeNodeAtPath(tree, [])).toBeUndefined(); // the root is not an element
    expect(customCodeNodeAtPath(null, [0])).toBeUndefined();
    expect(customCodeNodeAtPath('tree', [0])).toBeUndefined();
    expect(customCodeNodeAtPath({ kind: 'root', children: 'nope' }, [0])).toBeUndefined();
    expect(customCodeNodeAtPath({ kind: 'root', children: [42] }, [0])).toBeUndefined();
  });

  it('replaces the node at a path without mutating the input and with structural sharing elsewhere', () => {
    const next: CustomCodeNode = {
      ...portrait,
      attributes: { ...portrait.attributes, alt: 'Reem at work' },
    };
    const replaced = replaceCustomCodeNodeAtPath(tree, [0, 0], next);

    expect(replaced).not.toBe(tree);
    expect(customCodeNodeAtPath(replaced, [0, 0])).toBe(next);
    expect(customCodeNodeAtPath(tree, [0, 0])).toBe(portrait); // input untouched
    // The sibling branch is the SAME reference: only the spine to the path is rebuilt.
    const before = customCodeNodeAtPath(tree, [0, 1]);
    const after = customCodeNodeAtPath(replaced, [0, 1]);
    expect(after).toBe(before);
  });

  it('returns the input tree by reference when the path does not resolve', () => {
    expect(replaceCustomCodeNodeAtPath(tree, [9], portrait)).toBe(tree);
    expect(replaceCustomCodeNodeAtPath(tree, [], portrait)).toBe(tree);
    expect(replaceCustomCodeNodeAtPath(tree, [0, 0, 0], portrait)).toBe(tree);
  });
});
