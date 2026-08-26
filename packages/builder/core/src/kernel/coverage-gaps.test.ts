import type { ComponentType } from 'react';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  BuilderError,
  defineBlockSchema,
  type BlockRenderComponent,
} from '@craftkit/builder-schema';

import { fakeExtension } from '../testing/fake-extension';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture, stressDocument } from '../testing/fixtures';
import { createMemoryPersistence } from '../testing/memory-persistence';
import { createBuilder } from './create-builder';
import { openDocument } from './open-document';

const NullRender: BlockRenderComponent = () => null;

function testKernel(document = landingFixture()) {
  return createBuilder({
    document,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('g') },
  });
}

describe('open-document failure paths (never half-open)', () => {
  it('rejects a structurally broken stored document', async () => {
    const adapter = createMemoryPersistence();
    const broken = landingFixture();
    broken.nodes['orphan'] = { id: 'orphan', type: 'text', props: {} };
    adapter.seed('bad-1', broken);
    await expect(
      openDocument(adapter, 'bad-1', { extensions: [fixtureBlocks] }),
    ).rejects.toMatchObject({
      code: 'doc/orphan',
    });
  });

  it('rejects a document whose types are unknown to the active registry', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('bad-2', landingFixture());
    // No extensions: every fixture type is unknown in the registry-aware pass.
    await expect(openDocument(adapter, 'bad-2', {})).rejects.toMatchObject({
      code: 'doc/unknown-type',
    });
  });
});

describe('memory persistence guard paths', () => {
  it('load and append reject unknown documents', async () => {
    const adapter = createMemoryPersistence();
    await expect(adapter.load('nope')).rejects.toThrow(/Unknown document/);
    await expect(adapter.append('nope', [], 0)).rejects.toThrow(/Unknown document/);
  });

  it('a failed auto-flush is swallowed off the typing path and surfaces on the explicit flush', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-af', landingFixture());
    const kernel = await openDocument(adapter, 'doc-af', {
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('af') },
      coalesceEvery: 1,
    });
    // Advance the store behind the kernel's back → the auto-flush conflicts.
    const rival = await openDocument(adapter, 'doc-af', {
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('rv') },
    });
    rival.dispatch('setProp', { id: 'p1', key: 'content', value: 'rival' });
    await rival.flush();

    expect(() =>
      kernel.dispatch('setProp', { id: 'hero1', key: 'heading', value: 'mine' }),
    ).not.toThrow();
    await expect(kernel.flush()).rejects.toMatchObject({ code: 'persist/seq-conflict' });
  });
});

describe('registry filter and unregister paths', () => {
  it('filters blocks by surface and clears keymaps/opaque buckets on dispose', () => {
    const kernel = testKernel();
    kernel.extensions.register({
      tier: 1,
      name: 'surfacey',
      version: '0.0.1',
      contributes: {
        blocks: [
          {
            schema: defineBlockSchema({
              type: 'store-only',
              description: 'Store-only block.',
              surfaces: ['store'],
              props: z.object({}),
              examples: [],
            }),
            render: NullRender,
          },
        ],
        keymaps: [{ combo: 'mod+k', command: 'fake.tag' }],
        panels: [
          {
            id: 'panel-1',
            slot: 'left',
            title: 'panel',
            load: () =>
              Promise.resolve({
                default: (() => null) as ComponentType<Record<string, unknown>>,
              }),
          },
        ],
      },
    });

    const registry = kernel.context.registry;
    expect(registry.blocks('store').some((entry) => entry.schema.type === 'store-only')).toBe(true);
    expect(registry.blocks('docs').some((entry) => entry.schema.type === 'store-only')).toBe(false);
    expect(registry.blocks().length).toBeGreaterThan(6);
    expect(registry.keymaps()).toHaveLength(1);

    kernel.extensions.dispose('surfacey');
    expect(registry.keymaps()).toHaveLength(0);
    expect(registry.block('store-only')).toBeUndefined();
  });

  it('hydrates a skins-only declarative manifest', () => {
    const kernel = testKernel();
    const subtree = { rootId: 'r', nodes: { r: { id: 'r', type: 'text', props: {} } } };
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'skins-only',
      version: '1.0.0',
      contributes: {
        skins: [
          {
            id: 'flat',
            version: 1,
            states: { loading: subtree, empty: subtree, error: subtree, success: subtree },
          },
        ],
      },
    });
    expect(kernel.extensions.has('skins-only')).toBe(true);
  });
});

describe('remaining command guard branches', () => {
  it('insertNode rejects disallowed and unregistered types, and honours explicit index 0', () => {
    const disallowed = testKernel();
    expect(() => disallowed.dispatch('insertNode', { type: 'alien', parentId: 'root' })).toThrow(
      /accepts \[/,
    );

    // A document may carry a node whose type is unknown to the registry —
    // inserting UNDER it hits the "not registered" schema-lookup guard.
    const withMystery = landingFixture();
    withMystery.nodes['mist'] = {
      id: 'mist',
      type: 'mystery',
      props: {},
    };
    withMystery.nodes['sec1']?.slots?.['default']?.push('mist');
    const kernel = testKernel(withMystery);
    expect(() => kernel.dispatch('insertNode', { type: 'text', parentId: 'mist' })).toThrow(
      /not registered/,
    );

    kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1', index: 0 });
    expect(kernel.getDocument().nodes['sec1']?.slots?.['default']?.[1]).toBe('p1');
  });

  it('moveNode rejects a missing target parent; duplicateNode protects the root', () => {
    const kernel = testKernel();
    expect(() => kernel.dispatch('moveNode', { id: 'p1', toParentId: 'ghost' })).toThrow(
      BuilderError,
    );
    expect(() => kernel.dispatch('duplicateNode', { id: 'root' })).toThrow(/root node/i);
  });

  it('setBinding/setResponsive clears are safe when nothing is set', () => {
    const kernel = testKernel();
    kernel.dispatch('setBinding', { id: 'p1', key: 'content', path: null });
    kernel.dispatch('setResponsive', {
      id: 'p1',
      breakpoint: 'mobile',
      key: 'content',
      value: null,
    });
    expect(kernel.transactions()).toHaveLength(0); // both were observable no-ops
  });

  it('wrapNode rejects an undeclared wrapper slot; groupNodes rejects unknown and duplicate ids', () => {
    const kernel = testKernel();
    expect(() =>
      kernel.dispatch('wrapNode', { id: 'p1', wrapperType: 'box', wrapperSlot: 'nope' }),
    ).toThrow(/does not declare slot/);
    expect(() => kernel.dispatch('groupNodes', { ids: ['ghost'], groupType: 'box' })).toThrow(
      BuilderError,
    );
    expect(() => kernel.dispatch('groupNodes', { ids: ['p1', 'p1'], groupType: 'box' })).toThrow(
      /distinct siblings/,
    );
  });

  it('fake.tag on a missing node is an observable no-op', () => {
    const kernel = testKernel();
    kernel.registerExtension(fakeExtension);
    const tx = kernel.dispatch('fake.tag', { id: 'ghost' });
    expect(tx.patches).toHaveLength(0);
  });
});

describe('remaining flow branches', () => {
  it('a second flush with nothing pending resolves at the same position', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-idle', landingFixture());
    const kernel = await openDocument(adapter, 'doc-idle', {
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('idle') },
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'Once.' });
    const first = await kernel.flush();
    const second = await kernel.flush();
    expect(second).toBe(first);
  });

  it('an out-of-range insert index clamps to the end of the slot', () => {
    const kernel = testKernel();
    kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1', index: 99 });
    const children = kernel.getDocument().nodes['sec1']?.slots?.['default'];
    expect(children?.[0]).toBe('p1');
    expect(children).toHaveLength(2);
  });

  it('registerAll silently skips manifests that are already active', () => {
    const kernel = testKernel();
    expect(() => {
      kernel.extensions.registerAll([fixtureBlocks]);
    }).not.toThrow();
    expect(kernel.extensions.has('fixture-blocks')).toBe(true);
  });
});

describe('last defensive branches', () => {
  it('two subscribers on one node share a listener set and clean up fully', () => {
    const kernel = testKernel();
    let calls = 0;
    const offA = kernel.context.store.subscribeNode('p1', () => {
      calls += 1;
    });
    const offB = kernel.context.store.subscribeNode('p1', () => {
      calls += 1;
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'both' });
    expect(calls).toBe(2);
    offA();
    offB();
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'silent' });
    expect(calls).toBe(2);
  });

  it('setResponsive reuses an existing breakpoint bucket', () => {
    const kernel = testKernel();
    kernel.dispatch('setResponsive', {
      id: 'hero1',
      breakpoint: 'tablet',
      key: 'tone',
      value: 'dark',
    });
    kernel.dispatch('setResponsive', {
      id: 'hero1',
      breakpoint: 'tablet',
      key: 'heading',
      value: 'T',
    });
    expect(kernel.getDocument().nodes['hero1']?.responsive?.tablet).toEqual({
      tone: 'dark',
      heading: 'T',
    });
  });

  it('Law J catches `undefined` written INSIDE a command (replace-with-undefined leak)', async () => {
    const { defineCommand } = await import('../commands/define-command');
    const kernel = testKernel();
    kernel.extensions.register({
      tier: 1,
      name: 'undef-maker',
      version: '0.0.1',
      contributes: {
        commands: {
          'undef.write': defineCommand({
            args: z.strictObject({ id: z.string() }),
            run: (args) => (draft) => {
              const node = draft.nodes[args.id];
              if (node !== undefined) {
                node.props['ghost'] = undefined as never;
              }
            },
          }),
        },
      },
    });
    const before = kernel.getDocument();
    expect(() => kernel.dispatch('undef.write', { id: 'p1' })).toThrow(
      expect.objectContaining({ code: 'doc/non-json-value' }) as Error,
    );
    expect(kernel.getDocument()).toBe(before);
  });

  it('Law J catches non-finite numbers produced INSIDE a command (beyond arg parsing)', async () => {
    const { defineCommand } = await import('../commands/define-command');
    const kernel = testKernel();
    kernel.extensions.register({
      tier: 1,
      name: 'nan-maker',
      version: '0.0.1',
      contributes: {
        commands: {
          'nan.write': defineCommand({
            args: z.strictObject({ id: z.string() }),
            run: (args) => (draft) => {
              const node = draft.nodes[args.id];
              if (node !== undefined) {
                node.props['ratio'] = Number.NaN;
              }
            },
          }),
        },
      },
    });
    const before = kernel.getDocument();
    expect(() => kernel.dispatch('nan.write', { id: 'p1' })).toThrow(
      expect.objectContaining({ code: 'doc/non-finite-number' }) as Error,
    );
    expect(kernel.getDocument()).toBe(before);
  });

  it('declarative widget-type clashes and partial disposals keep other owners intact', () => {
    const kernel = testKernel();
    const subtree = { rootId: 'r', nodes: { r: { id: 'r', type: 'text', props: {} } } };
    const widget = (type: string) => ({
      type,
      contract: {},
      binding: { source: 'mock', map: {} },
      skins: [
        {
          id: 's',
          version: 1,
          states: { loading: subtree, empty: subtree, error: subtree, success: subtree },
        },
      ],
      defaultSkin: 's',
    });
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'pack-a',
      version: '1',
      contributes: { widgetTypes: [widget('widget:a')] },
    });
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'pack-b',
      version: '1',
      contributes: { widgetTypes: [widget('widget:b')] },
    });
    expect(() =>
      kernel.extensions.hydrateDeclarative({
        tier: 2,
        name: 'pack-c',
        version: '1',
        contributes: { widgetTypes: [widget('widget:a')] },
      }),
    ).toThrow(/already registered/);

    kernel.extensions.dispose('pack-a');
    expect(kernel.context.registry.widgetType('widget:a')).toBeUndefined();
    expect(kernel.context.registry.widgetType('widget:b')).toBeDefined();
  });

  it('a snapshot at a stale position is ignored', async () => {
    const adapter = createMemoryPersistence();
    adapter.seed('doc-snap', landingFixture());
    const kernel = await openDocument(adapter, 'doc-snap', {
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('sn') },
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'v1' });
    await kernel.flush();
    await adapter.snapshot?.('doc-snap', kernel.getDocument(), 999);
    expect(adapter.dump('doc-snap')?.tail).toHaveLength(1); // untouched
  });
});

describe('fixture edge branches', () => {
  it('a tiny stress document has a section with no texts', () => {
    const doc = stressDocument(2);
    expect(Object.keys(doc.nodes)).toHaveLength(2);
    expect(doc.nodes['sec-1']?.slots).toBeUndefined();
  });
});
