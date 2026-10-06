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
  type CustomCodeNode,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import {
  ELEMENT_NAME_WORDS_AR,
  clipHistoryLabel,
  dispatchTreeEdits,
  elementTargetKey,
  resolveElementTarget,
  sameElementTarget,
  treeNodeDisplayName,
  tryDispatchTreeEdits,
} from './element-target';

const NullRender: BlockRenderComponent = () => null;

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'element-target-test',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['region', 'heroSplit'] } },
          examples: [],
        }),
        render: NullRender,
      },
      {
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
          type: 'heroSplit',
          description: 'A registered block',
          props: z.object({ title: z.string().default('') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

const DOC = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['r1', 'h1'] } },
    r1: {
      id: 'r1',
      type: 'region',
      props: {
        label: 'Story',
        layout: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [
                { kind: 'element', tag: 'h2', text: 'Our story' },
                { kind: 'icon', name: 'mail' },
              ],
            },
          ],
        },
      },
    },
    h1: { id: 'h1', type: 'heroSplit', props: { title: 'Hi' } },
  },
} as unknown as BuilderDocument;

const kernel = () =>
  createBuilder({ document: DOC, extensions: [VOCAB], ports: { clock: fixedClock(), ids: seededIds('et') } });

describe('resolveElementTarget', () => {
  it('resolves a tree target to its node, tree key and a display name', () => {
    const found = resolveElementTarget(kernel(), { kind: 'tree', nodeId: 'r1', path: [0, 0] });
    expect(found?.kind).toBe('tree');
    if (found?.kind !== 'tree') return;
    expect(found.treeKey).toBe('layout');
    expect(found.node).toEqual({ kind: 'element', tag: 'h2', text: 'Our story' });
    expect(found.displayName).toBe('Heading “Our story”');
  });

  it('names a section by its first text, and a block by its label or type', () => {
    const k = kernel();
    expect(resolveElementTarget(k, { kind: 'tree', nodeId: 'r1', path: [0] })?.displayName).toBe(
      'Section “Our story”',
    );
    expect(resolveElementTarget(k, { kind: 'block', nodeId: 'r1' })?.displayName).toBe('Story');
    expect(resolveElementTarget(k, { kind: 'block', nodeId: 'h1' })?.displayName).toBe('Hero split');
  });

  it('is undefined for stale targets', () => {
    const k = kernel();
    expect(resolveElementTarget(k, { kind: 'tree', nodeId: 'r1', path: [3] })).toBeUndefined();
    expect(resolveElementTarget(k, { kind: 'tree', nodeId: 'h1', path: [0] })).toBeUndefined();
    expect(resolveElementTarget(k, { kind: 'block', nodeId: 'ghost' })).toBeUndefined();
  });
});

describe('treeNodeDisplayName', () => {
  it('prefers the editor label, then the kind word plus a clipped preview', () => {
    const labelled = { kind: 'element', tag: 'h2', text: 'x', label: 'Hero title' } as unknown as CustomCodeNode;
    expect(treeNodeDisplayName(labelled)).toBe('Hero title');
    expect(treeNodeDisplayName({ kind: 'icon', name: 'mail', label: 'Email us' })).toBe('Icon mail');
    expect(treeNodeDisplayName({ kind: 'component', component: 'pricing' })).toBe('Component pricing');
    expect(treeNodeDisplayName({ kind: 'element', tag: 'img' })).toBe('Image');
    expect(treeNodeDisplayName({ kind: 'element', tag: 'p', text: 'A very long paragraph of words here' })).toBe(
      'Text “A very long paragraph o…”',
    );
    expect(treeNodeDisplayName({ kind: 'element', tag: 'h2', text: 'قصتنا' }, ELEMENT_NAME_WORDS_AR)).toBe(
      'عنوان “قصتنا”',
    );
  });
});

describe('target identity', () => {
  it('compares and keys targets', () => {
    expect(sameElementTarget({ kind: 'tree', nodeId: 'a', path: [0, 1] }, { kind: 'tree', nodeId: 'a', path: [0, 1] })).toBe(true);
    expect(sameElementTarget({ kind: 'tree', nodeId: 'a', path: [0] }, { kind: 'tree', nodeId: 'a', path: [0, 1] })).toBe(false);
    expect(sameElementTarget({ kind: 'block', nodeId: 'a' }, { kind: 'tree', nodeId: 'a', path: [] })).toBe(false);
    expect(elementTargetKey({ kind: 'tree', nodeId: 'a', path: [0, 1] })).toBe('tree:a:0.1');
    expect(elementTargetKey({ kind: 'block', nodeId: 'a' })).toBe('block:a');
  });
});

describe('dispatchTreeEdits', () => {
  it('commits every step as ONE labelled transaction with its author', () => {
    const k = kernel();
    const tx = dispatchTreeEdits(
      k,
      [
        { command: 'setProp', args: { id: 'h1', key: 'title', value: 'A' } },
        { command: 'setProp', args: { id: 'r1', key: 'label', value: 'B' } },
      ],
      '  Rename ·   two things ',
      'ai',
    );
    expect(tx.command).toBe('Rename · two things');
    expect(tx.author).toBe('ai');
    expect(k.transactions()).toHaveLength(1);
    k.undo();
    expect(k.getDocument().nodes['h1']?.props['title']).toBe('Hi');
  });

  it('clips long labels to the kernel ceiling', () => {
    expect(clipHistoryLabel('x'.repeat(300))).toHaveLength(160);
  });

  it('tryDispatchTreeEdits reports a refusal instead of throwing, and writes nothing', () => {
    const k = kernel();
    const result = tryDispatchTreeEdits(k, [{ command: 'setProp', args: { id: 'ghost', key: 'x', value: 1 } }], 'Bad');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toMatch(/ghost/u);
    expect(k.transactions()).toHaveLength(0);
  });
});
