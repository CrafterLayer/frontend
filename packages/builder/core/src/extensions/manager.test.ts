import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  type BuilderError,
  defineBlockSchema,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createBuilder } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';

const NullRender: BlockRenderComponent = () => null;

function blockManifest(
  name: string,
  blockType: string,
  dependencies?: string[],
): TrustedExtensionManifest {
  return {
    tier: 1,
    name,
    version: '0.0.1',
    ...(dependencies === undefined ? {} : { dependencies }),
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: blockType,
            description: `Test block ${blockType}.`,
            props: z.object({ label: z.string().default('x') }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
}

function testKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('m') },
  });
}

describe('US2 — extension lifecycle', () => {
  it('maintains an intrinsic monotonic catalog version across register/hydrate/dispose', () => {
    // View layers read this as a useSyncExternalStore snapshot; being intrinsic
    // (not listener-derived) is what makes pre-subscribe changes observable.
    const kernel = testKernel();
    const afterConstruction = kernel.extensions.version();
    expect(afterConstruction).toBeGreaterThanOrEqual(1); // fixtureBlocks counted

    kernel.extensions.register({ tier: 1, name: 'v-probe', version: '1.0.0' });
    expect(kernel.extensions.version()).toBe(afterConstruction + 1);

    kernel.extensions.dispose('v-probe');
    expect(kernel.extensions.version()).toBe(afterConstruction + 2);

    // A failed registration must NOT bump (no observable catalog change).
    expect(() => {
      kernel.extensions.register(fixtureBlocks);
    }).toThrow();
    expect(kernel.extensions.version()).toBe(afterConstruction + 2);
  });

  it('catalogs canvas tools sorted by order, removes them on disposal (005 §4)', () => {
    const kernel = testKernel();
    const tool = (id: string, order?: number) => ({
      id,
      on: 'selection' as const,
      ...(order === undefined ? {} : { order }),
      load: () => Promise.resolve({ default: () => () => undefined }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'tools-a',
      version: '1.0.0',
      contributes: { canvasTools: [tool('zeta'), tool('alpha', 10), tool('beta', 10)] },
    });
    expect(kernel.context.registry.canvasTools().map((entry) => entry.id)).toEqual([
      'alpha',
      'beta',
      'zeta', // no order sorts last
    ]);

    kernel.extensions.dispose('tools-a');
    expect(kernel.context.registry.canvasTools()).toEqual([]);
  });

  it('rejects a duplicate canvas-tool id all-or-nothing (no partial contributions)', () => {
    const kernel = testKernel();
    const tool = (id: string) => ({
      id,
      on: 'hover' as const,
      load: () => Promise.resolve({ default: () => () => undefined }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'tools-first',
      version: '1.0.0',
      contributes: { canvasTools: [tool('badge')] },
    });
    const clashing = blockManifest('tools-clash', 'fresh-clash-block');
    clashing.contributes = { ...clashing.contributes, canvasTools: [tool('badge')] };
    expect(() => {
      kernel.extensions.register(clashing);
    }).toThrow(/already registered/);
    // The clashing manifest must leave NOTHING behind — not even its valid block.
    expect(kernel.context.registry.block('fresh-clash-block')).toBeUndefined();
    expect(kernel.extensions.has('tools-clash')).toBe(false);
  });

  it('resolves an inline editor by kind — FIRST registration wins (009 §11)', () => {
    const kernel = testKernel();
    const editor = (id: string, kind: 'text' | 'rich') => ({
      id,
      kind,
      load: () => Promise.resolve({ default: () => null }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'inline-a',
      version: '1.0.0',
      contributes: { inlineEditors: [editor('rich-first', 'rich'), editor('plain', 'text')] },
    });
    kernel.extensions.register({
      tier: 1,
      name: 'inline-b',
      version: '1.0.0',
      contributes: { inlineEditors: [editor('rich-second', 'rich')] },
    });

    // Deterministic because extensions register in topological order — never
    // "whichever extension happened to load last".
    expect(kernel.context.registry.inlineEditor('rich')?.id).toBe('rich-first');
    expect(kernel.context.registry.inlineEditor('text')?.id).toBe('plain');
    expect(kernel.context.registry.inlineEditors()).toHaveLength(3);

    // LAZY BY CONTRACT: registering a manifest must not pull an editing engine
    // into the bundle — the def carries a loader, never a component.
    expect(typeof kernel.context.registry.inlineEditor('rich')?.load).toBe('function');

    kernel.extensions.dispose('inline-a');
    expect(kernel.context.registry.inlineEditor('rich')?.id).toBe('rich-second');
    expect(kernel.context.registry.inlineEditor('text')).toBeUndefined();

    kernel.extensions.dispose('inline-b');
    expect(kernel.context.registry.inlineEditors()).toEqual([]);
  });

  it('rejects a duplicate inline-editor id all-or-nothing', () => {
    const kernel = testKernel();
    const editor = (id: string) => ({
      id,
      kind: 'rich' as const,
      load: () => Promise.resolve({ default: () => null }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'inline-first',
      version: '1.0.0',
      contributes: { inlineEditors: [editor('rich')] },
    });
    const clashing = blockManifest('inline-clash', 'fresh-inline-block');
    clashing.contributes = { ...clashing.contributes, inlineEditors: [editor('rich')] };
    expect(() => {
      kernel.extensions.register(clashing);
    }).toThrow(/already registered/);
    expect(kernel.context.registry.block('fresh-inline-block')).toBeUndefined();
    expect(kernel.extensions.has('inline-clash')).toBe(false);
  });

  it('catalogs panels by id and slot, lazily, and removes them on disposal (011 §4)', () => {
    const kernel = testKernel();
    const panel = (id: string, slot: 'left' | 'right' | 'bottom' | 'modal') => ({
      id,
      slot,
      title: `panel.${id}`,
      load: () => Promise.resolve({ default: () => null }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'panels-a',
      version: '1.0.0',
      contributes: { panels: [panel('code-view', 'bottom'), panel('outline', 'left')] },
    });

    expect(kernel.context.registry.panel('code-view')?.slot).toBe('bottom');
    expect(kernel.context.registry.panels().map((entry) => entry.id)).toEqual([
      'code-view',
      'outline',
    ]);
    expect(kernel.context.registry.panels('left').map((entry) => entry.id)).toEqual(['outline']);

    // LAZY BY CONTRACT (SC-006): registering a panel must not pull its
    // implementation in — the contribution carries a loader, never a component.
    expect(typeof kernel.context.registry.panel('code-view')?.load).toBe('function');

    kernel.extensions.dispose('panels-a');
    expect(kernel.context.registry.panels()).toEqual([]);
  });

  it('rejects a duplicate panel id all-or-nothing', () => {
    const kernel = testKernel();
    const panel = (id: string) => ({
      id,
      slot: 'bottom' as const,
      title: `panel.${id}`,
      load: () => Promise.resolve({ default: () => null }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'panels-first',
      version: '1.0.0',
      contributes: { panels: [panel('code-view')] },
    });
    const clashing = blockManifest('panels-clash', 'fresh-panel-block');
    clashing.contributes = { ...clashing.contributes, panels: [panel('code-view')] };
    expect(() => {
      kernel.extensions.register(clashing);
    }).toThrow(/already registered/);
    expect(kernel.context.registry.block('fresh-panel-block')).toBeUndefined();
    expect(kernel.extensions.has('panels-clash')).toBe(false);
  });

  it('resolves projections by id and removes them on disposal (011 §1)', () => {
    // Declared since B0, first consumed by B4: the point must behave exactly
    // like the other typed catalogs — stable order, O(1) lookup, clean removal.
    const kernel = testKernel();
    const projection = (id: string) => ({
      id,
      project: () => '',
      parse: () => ({ ok: true as const, patches: [] }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'projections-a',
      version: '1.0.0',
      contributes: { projections: [projection('canonical-json'), projection('mdx')] },
    });

    expect(kernel.context.registry.projection('canonical-json')?.id).toBe('canonical-json');
    expect(kernel.context.registry.projections().map((entry) => entry.id)).toEqual([
      'canonical-json',
      'mdx',
    ]);
    expect(kernel.context.registry.projection('missing')).toBeUndefined();

    kernel.extensions.dispose('projections-a');
    expect(kernel.context.registry.projections()).toEqual([]);
  });

  it('rejects a duplicate projection id all-or-nothing', () => {
    const kernel = testKernel();
    const projection = (id: string) => ({
      id,
      project: () => '',
      parse: () => ({ ok: true as const, patches: [] }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'projections-first',
      version: '1.0.0',
      contributes: { projections: [projection('canonical-json')] },
    });
    const clashing = blockManifest('projections-clash', 'fresh-projection-block');
    clashing.contributes = {
      ...clashing.contributes,
      projections: [projection('canonical-json')],
    };
    expect(() => {
      kernel.extensions.register(clashing);
    }).toThrow(/already registered/);
    // NOTHING from the clashing manifest survives — not even its valid block.
    expect(kernel.context.registry.block('fresh-projection-block')).toBeUndefined();
    expect(kernel.extensions.has('projections-clash')).toBe(false);
  });

  it('catalogs field types in REGISTRATION ORDER, removes them on disposal (007 §2)', () => {
    // Insertion order is contractual: resolveField ties break by position.
    const kernel = testKernel();
    const field = (id: string, score: number) => ({
      id,
      match: () => score,
      load: () => Promise.resolve({ default: () => null }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'fields-a',
      version: '1.0.0',
      contributes: { fieldTypes: [field('zeta', 5), field('alpha', 5)] },
    });
    kernel.extensions.register({
      tier: 1,
      name: 'fields-b',
      version: '1.0.0',
      contributes: { fieldTypes: [field('beta', 5)] },
    });
    expect(kernel.context.registry.fieldTypes().map((entry) => entry.id)).toEqual([
      'zeta', // NOT sorted by id — registration order only
      'alpha',
      'beta',
    ]);

    kernel.extensions.dispose('fields-a');
    expect(kernel.context.registry.fieldTypes().map((entry) => entry.id)).toEqual(['beta']);
    kernel.extensions.dispose('fields-b');
    expect(kernel.context.registry.fieldTypes()).toEqual([]);
  });

  it('rejects a duplicate field-type id all-or-nothing (no partial contributions)', () => {
    const kernel = testKernel();
    const field = (id: string) => ({
      id,
      match: () => 1,
      load: () => Promise.resolve({ default: () => null }),
    });
    kernel.extensions.register({
      tier: 1,
      name: 'fields-first',
      version: '1.0.0',
      contributes: { fieldTypes: [field('color')] },
    });
    const clashing = blockManifest('fields-clash', 'fresh-field-clash-block');
    clashing.contributes = { ...clashing.contributes, fieldTypes: [field('color')] };
    expect(() => {
      kernel.extensions.register(clashing);
    }).toThrow(/already registered/);
    expect(kernel.context.registry.block('fresh-field-clash-block')).toBeUndefined();
    expect(kernel.extensions.has('fields-clash')).toBe(false);
  });

  it('scenario 2: batch registration runs dependency-first regardless of order', () => {
    const kernel = testKernel();
    const setupOrder: string[] = [];
    const withSetup = (manifest: TrustedExtensionManifest): TrustedExtensionManifest => ({
      ...manifest,
      setup: () => {
        setupOrder.push(manifest.name);
        return undefined;
      },
    });

    kernel.extensions.registerAll([
      withSetup(blockManifest('c', 'blk-c', ['b'])),
      withSetup(blockManifest('a', 'blk-a')),
      withSetup(blockManifest('b', 'blk-b', ['a'])),
    ]);
    expect(setupOrder).toEqual(['a', 'b', 'c']);
    expect(kernel.context.registry.block('blk-c')).toBeDefined();
  });

  it('scenario 2b: a dependency cycle is rejected naming the extensions involved', () => {
    const kernel = testKernel();
    let caught: BuilderError | undefined;
    try {
      kernel.extensions.registerAll([
        blockManifest('x', 'blk-x', ['y']),
        blockManifest('y', 'blk-y', ['x']),
      ]);
    } catch (error) {
      caught = error as BuilderError;
    }
    expect(caught?.code).toBe('ext/cycle');
    expect(caught?.message).toMatch(/x|y/);
    expect(caught?.meta?.['cycle']).toBeDefined();
  });

  it('a missing dependency is rejected explicitly', () => {
    const kernel = testKernel();
    expect(() => {
      kernel.extensions.register(blockManifest('lonely', 'blk-l', ['ghost']));
    }).toThrow(/depends on "ghost"/);
  });

  it('scenario 3: dispose releases contributions and runs the teardown', () => {
    const kernel = testKernel();
    let tornDown = 0;
    kernel.extensions.register({
      ...blockManifest('temp', 'blk-temp'),
      setup: () => () => {
        tornDown += 1;
      },
    });
    expect(kernel.context.registry.block('blk-temp')).toBeDefined();

    expect(kernel.extensions.dispose('temp')).toBe(true);
    expect(tornDown).toBe(1);
    expect(kernel.context.registry.block('blk-temp')).toBeUndefined();
    expect(kernel.extensions.dispose('temp')).toBe(false);
  });

  it('duplicate extension names and duplicate block types are rejected', () => {
    const kernel = testKernel();
    kernel.extensions.register(blockManifest('one', 'blk-1'));
    expect(() => {
      kernel.extensions.register(blockManifest('one', 'blk-other'));
    }).toThrow(/already registered/);
    expect(() => {
      kernel.extensions.register(blockManifest('two', 'blk-1'));
    }).toThrow(/already registered by "one"/);
  });

  it('a duplicate MID-manifest registers nothing at all (all-or-nothing for trusted too)', () => {
    const kernel = testKernel();
    kernel.extensions.register(blockManifest('first', 'blk-taken'));

    const twoBlocks = blockManifest('second', 'blk-fresh');
    twoBlocks.contributes?.blocks?.push({
      schema: defineBlockSchema({
        type: 'blk-taken', // clashes AFTER blk-fresh in the same manifest
        description: 'Clashing block.',
        props: z.object({}),
        examples: [],
      }),
      render: NullRender,
    });

    expect(() => {
      kernel.extensions.register(twoBlocks);
    }).toThrow(/already registered/);
    expect(kernel.extensions.has('second')).toBe(false);
    // The pre-clash contribution must NOT survive as an orphan:
    expect(kernel.context.registry.block('blk-fresh')).toBeUndefined();
  });

  it('a failing setup leaves no half-registered contributions behind', () => {
    const kernel = testKernel();
    expect(() => {
      kernel.extensions.register({
        ...blockManifest('boomer', 'blk-boom'),
        setup: () => {
          throw new Error('setup exploded');
        },
      });
    }).toThrow('setup exploded');
    expect(kernel.extensions.has('boomer')).toBe(false);
    expect(kernel.context.registry.block('blk-boom')).toBeUndefined();
  });

  /*
    Not vitest's 5 s default. This test's work is constant (fixed inputs);
    what varies is spare CPU. Under `pnpm test` — every package's vitest in
    parallel on the same cores — it was killed by the clock at 5 s while
    passing comfortably alone, and turbo then skipped every dependent package.
    A timing GUARD that fails on a busy machine guards nothing; the assertions
    inside still hold the property, this only stops the clock lying about it.
  */
  const LOAD_TOLERANT_TIMEOUT_MS = 30_000;
  it('scenario 4 (SC-005): lookup cost stays flat from 10 to 1,000 contributions', () => {
    const kernel = testKernel();
    for (let index = 0; index < 10; index += 1) {
      kernel.extensions.register(blockManifest(`small-${String(index)}`, `s-${String(index)}`));
    }
    const timeLookups = (): number => {
      const startedAt = Date.now();
      for (let round = 0; round < 200_000; round += 1) {
        kernel.context.registry.block(`s-${String(round % 10)}`);
      }
      return Date.now() - startedAt;
    };
    timeLookups(); // warmup
    const smallCatalog = Math.max(timeLookups(), 1);

    for (let index = 0; index < 990; index += 1) {
      kernel.extensions.register(blockManifest(`big-${String(index)}`, `b-${String(index)}`));
    }
    const bigCatalog = Math.max(timeLookups(), 1);

    // Map-backed lookups: generous ceiling, catches accidental O(n) scans.
    expect(bigCatalog / smallCatalog).toBeLessThan(5);
    expect(kernel.context.registry.block('b-500')).toBeDefined();
  }, LOAD_TOLERANT_TIMEOUT_MS);
});
