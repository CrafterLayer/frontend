import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  BuilderError,
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { builderCustomCode } from '../index';
import { TREE_NODE_COMMAND_NAMES, treeNodeStep } from './tree-node-args';

const NullRender: BlockRenderComponent = () => null;

const PAGE: TrustedExtensionManifest = {
  tier: 1,
  name: 'tree-commands-test-page',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Page',
          props: z.object({}),
          slots: { default: { allow: ['customCode', 'plain'] } },
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

function regionA(): CustomCodeRoot {
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        className: 'p-4',
        children: [
          { kind: 'element', tag: 'h2', text: 'Our story' },
          { kind: 'element', tag: 'p', className: 'text-sm', text: 'Hello brave world' },
          { kind: 'element', tag: 'p', className: 'text-sm', text: 'Second' },
          { kind: 'icon', name: 'mail' },
        ],
      },
    ],
  };
}

function regionB(): CustomCodeRoot {
  return { kind: 'root', children: [{ kind: 'element', tag: 'div', className: 'grid' }] };
}

function documentFixture(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['a', 'b', 'p'] } },
      a: { id: 'a', type: 'customCode', props: { label: 'A', tree: regionA(), css: '' } },
      b: { id: 'b', type: 'customCode', props: { label: 'B', tree: regionB(), css: '' } },
      p: { id: 'p', type: 'plain', props: { tree: 'text' } },
    },
  } as unknown as BuilderDocument;
}

const kernel = (): BuilderKernel =>
  createBuilder({
    document: documentFixture(),
    extensions: [PAGE, builderCustomCode],
    ports: { clock: fixedClock(), ids: seededIds('tc') },
  });

const treeOf = (k: BuilderKernel, id: string): CustomCodeRoot =>
  k.getDocument().nodes[id]?.props['tree'] as unknown as CustomCodeRoot;

function refusalOf(run: () => unknown): BuilderError {
  try {
    run();
  } catch (error) {
    if (error instanceof BuilderError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

/** Every command, with args valid against the fixture. */
const VALID: readonly { command: string; args: unknown }[] = [
  { command: 'setTreeNode', args: { id: 'a', path: [0, 0], node: { kind: 'element', tag: 'h3', text: 'New' } } },
  { command: 'patchTreeNode', args: { id: 'a', path: [0, 1], set: { className: 'text-lg' }, attributes: { id: 'lead' } } },
  { command: 'insertTreeNode', args: { id: 'a', parent: [0], index: 0, node: { kind: 'element', tag: 'hr' } } },
  { command: 'removeTreeNode', args: { id: 'a', path: [0, 3] } },
  { command: 'moveTreeNode', args: { id: 'a', from: [0, 0], to: { parent: [0], index: 2 } } },
  { command: 'duplicateTreeNode', args: { id: 'a', path: [0, 1] } },
  { command: 'wrapTreeNode', args: { id: 'a', paths: [[0, 1], [0, 2]], wrapper: { tag: 'div', className: 'grid gap-2' } } },
  { command: 'unwrapTreeNode', args: { id: 'a', path: [0] } },
  { command: 'formatTreeText', args: { id: 'a', path: [0, 1], start: 6, end: 11, mark: 'strong' } },
];

describe('tree node commands — registration', () => {
  it('registers all nine names through the manifest', () => {
    const names = kernel().context.registry.commandNames();
    for (const name of TREE_NODE_COMMAND_NAMES) expect(names).toContain(name);
    expect(VALID.map((step) => step.command)).toEqual([...TREE_NODE_COMMAND_NAMES]);
  });
});

describe('tree node commands — one transaction, exact undo', () => {
  it.each(VALID)('$command is ONE transaction and undo restores the exact previous tree', ({ command, args }) => {
    const k = kernel();
    const before = structuredClone(treeOf(k, 'a'));
    const logBefore = k.transactions().length;
    const tx = k.dispatch(command, args, 'user');
    expect(tx.patches.length).toBeGreaterThan(0);
    expect(k.transactions().length).toBe(logBefore + 1);
    expect(treeOf(k, 'a')).not.toEqual(before);
    expect(k.undo()).toBe(true);
    expect(treeOf(k, 'a')).toEqual(before);
    expect(k.canUndo()).toBe(false);
  });

  it('applies what each command says', () => {
    const k = kernel();
    k.dispatch('patchTreeNode', { id: 'a', path: [0, 1], set: { className: 'text-lg' }, attributes: { id: 'lead' } });
    expect(treeOf(k, 'a').children[0]).toMatchObject({
      children: [{}, { className: 'text-lg', attributes: { id: 'lead' } }, {}, {}],
    });
    k.dispatch('formatTreeText', { id: 'a', path: [0, 1], start: 6, end: 11, mark: 'strong' });
    expect(treeOf(k, 'a').children[0]).toMatchObject({
      children: [
        {},
        {
          tag: 'p',
          children: [
            { tag: 'span', text: 'Hello ' },
            { tag: 'strong', text: 'brave' },
            { tag: 'span', text: ' world' },
          ],
        },
        {},
        {},
      ],
    });
  });

  it('a labelled group of tree commands is still one transaction and one undo', () => {
    const k = kernel();
    const before = structuredClone(treeOf(k, 'a'));
    const tx = k.dispatchGroup(
      [
        treeNodeStep('patchTreeNode', { id: 'a', path: [0, 1], set: { className: 'text-lg' } }),
        treeNodeStep('patchTreeNode', { id: 'a', path: [0, 2], set: { className: 'text-lg' } }),
        treeNodeStep('duplicateTreeNode', { id: 'a', path: [0, 0] }),
      ],
      { author: 'user', label: 'Font size · 2 paragraphs' },
    );
    expect(tx.command).toBe('Font size · 2 paragraphs');
    expect(k.transactions()).toHaveLength(1);
    k.undo();
    expect(treeOf(k, 'a')).toEqual(before);
  });
});

describe('tree node commands — cross-region move', () => {
  it('moves an element into another region as one transaction and one undo', () => {
    const k = kernel();
    const beforeA = structuredClone(treeOf(k, 'a'));
    const beforeB = structuredClone(treeOf(k, 'b'));
    k.dispatch('moveTreeNode', { id: 'a', from: [0, 1], to: { id: 'b', parent: [0], index: 0 } });
    expect(k.transactions()).toHaveLength(1);
    expect(treeOf(k, 'b').children[0]).toMatchObject({
      children: [{ tag: 'p', text: 'Hello brave world' }],
    });
    expect(treeOf(k, 'a').children[0]?.kind === 'element' && treeOf(k, 'a').children[0]).toMatchObject({
      children: [{ tag: 'h2' }, { text: 'Second' }, { kind: 'icon' }],
    });
    expect(k.undo()).toBe(true);
    expect(treeOf(k, 'a')).toEqual(beforeA);
    expect(treeOf(k, 'b')).toEqual(beforeB);
  });

  it('refuses a destination that is not a region, leaving both trees untouched', () => {
    const k = kernel();
    const error = refusalOf(() =>
      k.dispatch('moveTreeNode', { id: 'a', from: [0, 1], to: { id: 'p', parent: [], index: 0 } }),
    );
    expect(error.code).toBe('cmd/structural-violation');
    expect(error.path).toEqual(['to', 'id']);
    expect(k.transactions()).toHaveLength(0);
    expect(treeOf(k, 'a')).toEqual(regionA());
  });
});

describe('tree node commands — repair-ready refusals', () => {
  const cases: readonly { name: string; command: string; args: unknown; match: RegExp }[] = [
    { name: 'a missing region', command: 'removeTreeNode', args: { id: 'ghost', path: [0] }, match: /does not exist · send/u },
    { name: 'a block with no tree', command: 'removeTreeNode', args: { id: 'p', path: [0] }, match: /holds no element tree · send/u },
    { name: 'a missing path', command: 'removeTreeNode', args: { id: 'a', path: [4] }, match: /No element at \[4\] · send/u },
    { name: 'an out-of-range index', command: 'insertTreeNode', args: { id: 'a', parent: [0], index: 9, node: { kind: 'element', tag: 'hr' } }, match: /send an index from 0 to 4/u },
    { name: 'a tag outside the vocabulary', command: 'insertTreeNode', args: { id: 'a', parent: [0], index: 0, node: { kind: 'element', tag: 'script' } }, match: / · /u },
    { name: 'an attribute on the wrong tag', command: 'patchTreeNode', args: { id: 'a', path: [0, 0], attributes: { loop: '' } }, match: /loop belongs on <video>.*element \[0,0\]/u },
    { name: 'a non-contiguous wrap', command: 'wrapTreeNode', args: { id: 'a', paths: [[0, 0], [0, 2]], wrapper: { tag: 'div' } }, match: /not side by side .* · send/u },
    { name: 'an unwrap that loses text', command: 'unwrapTreeNode', args: { id: 'a', path: [0, 0] }, match: /wraps nothing · use removeTreeNode/u },
    { name: 'a link without href', command: 'formatTreeText', args: { id: 'a', path: [0, 1], start: 0, end: 5, mark: 'a' }, match: /needs an href · send/u },
    { name: 'an empty patch', command: 'patchTreeNode', args: { id: 'a', path: [0, 1] }, match: /changes nothing · send/u },
    { name: 'a move into itself', command: 'moveTreeNode', args: { id: 'a', from: [0], to: { parent: [0, 1], index: 0 } }, match: /into itself .* · send/u },
  ];

  it.each(cases)('refuses $name with "what is wrong · what to send instead"', ({ command, args, match }) => {
    const k = kernel();
    const error = refusalOf(() => k.dispatch(command, args));
    expect(error.message).toMatch(match);
    expect(error.message).toContain(' · ');
    expect(['cmd/structural-violation', 'cmd/invalid-args']).toContain(error.code);
    expect(k.transactions()).toHaveLength(0);
    expect(treeOf(k, 'a')).toEqual(regionA());
  });

  it('refuses unknown keys in args (strict objects)', () => {
    const error = refusalOf(() => kernel().dispatch('removeTreeNode', { id: 'a', path: [0], extra: 1 }));
    expect(error.code).toBe('cmd/invalid-args');
  });

  it('a failing step makes the whole group a no-op', () => {
    const k = kernel();
    expect(() =>
      k.dispatchGroup(
        [
          { command: 'patchTreeNode', args: { id: 'a', path: [0, 1], set: { className: 'text-lg' } } },
          { command: 'removeTreeNode', args: { id: 'a', path: [7] } },
        ],
        { label: 'Broken' },
      ),
    ).toThrow(BuilderError);
    expect(k.transactions()).toHaveLength(0);
    expect(treeOf(k, 'a')).toEqual(regionA());
  });
});
