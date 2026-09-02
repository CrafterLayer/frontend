import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot, customCodeElementAt, customCodeTreeKey } from './element-at';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'element-at-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'plain'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
        // The tree prop is NOT called `tree`, to prove the lookup reads the declaration.
        schema: defineBlockSchema({
          type: 'region',
          description: 'A composed region',
          props: z.object({
            label: z.string().default(''),
            layout: customCodeTree().default(emptyCustomCodeTree()),
          }),
          examples: [],
        }),
        render: NullRender,
      },
      {
        schema: defineBlockSchema({
          type: 'plain',
          description: 'An ordinary block',
          props: z.object({ tree: z.string().default('not a composition') }),
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
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'p1', 'broken'] } },
    r1: {
      id: 'r1',
      type: 'region',
      props: {
        label: 'CV header',
        layout: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [{ kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: 'A' } }],
            },
          ],
        },
      },
    },
    p1: { id: 'p1', type: 'plain', props: { tree: 'text' } },
    broken: { id: 'broken', type: 'region', props: { label: '', layout: 'junk' } },
  },
};

const kernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ea') },
  });

describe('customCodeTreeKey', () => {
  it('finds the tree prop by its declaration, whatever it is named', () => {
    expect(customCodeTreeKey(kernel(), 'region')).toBe('layout');
  });

  it('is undefined for a block with no tree declaration, even one with a prop CALLED tree', () => {
    expect(customCodeTreeKey(kernel(), 'plain')).toBeUndefined();
    expect(customCodeTreeKey(kernel(), 'ghost')).toBeUndefined();
  });
});

describe('customCodeElementAt', () => {
  it('resolves a focus to the element, its tree, and the prop the tree lives in', () => {
    const found = customCodeElementAt(kernel(), 'r1', [0, 0]);
    expect(found?.treeKey).toBe('layout');
    expect(found?.element).toEqual({
      kind: 'element',
      tag: 'img',
      attributes: { src: '/a.jpg', alt: 'A' },
    });
    expect(found?.tree.children).toHaveLength(1);
  });

  it('degrades to undefined for every way a focus can be stale', () => {
    const k = kernel();
    expect(customCodeElementAt(k, 'ghost', [0])).toBeUndefined(); // no such node
    expect(customCodeElementAt(k, 'p1', [0])).toBeUndefined(); // block declares no tree
    expect(customCodeElementAt(k, 'broken', [0])).toBeUndefined(); // stored value is not a tree
    expect(customCodeElementAt(k, 'r1', [0, 5])).toBeUndefined(); // path edited away
    expect(customCodeElementAt(k, 'r1', [])).toBeUndefined(); // the root is not an element
  });
});

describe('asCustomCodeRoot', () => {
  it('accepts only the root shape', () => {
    expect(asCustomCodeRoot({ kind: 'root', children: [] })).toBeDefined();
    expect(asCustomCodeRoot({ kind: 'root', children: 'x' })).toBeUndefined();
    expect(asCustomCodeRoot({ kind: 'element', tag: 'div' })).toBeUndefined();
    expect(asCustomCodeRoot(null)).toBeUndefined();
  });
});
