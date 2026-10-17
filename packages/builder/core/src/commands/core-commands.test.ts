import { describe, expect, it } from 'vitest';

import { BuilderError } from '@craftkit/builder-schema';

import { createBuilder, type BuilderKernel } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { coreCommands, insertedNodeId } from './core-commands';

const RESERVED_PATCH_PATH_SEGMENTS = ['__proto__', 'constructor', 'prototype'] as const;

function kernelWithLanding(): BuilderKernel {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('c') },
  });
}

function expectViolation(fn: () => unknown, pattern: RegExp): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BuilderError);
  expect((caught as BuilderError).code).toBe('cmd/structural-violation');
  expect((caught as BuilderError).message).toMatch(pattern);
}

describe('structural guards', () => {
  it('insertComposition detach-clones a validated template as one undoable transaction', () => {
    const kernel = kernelWithLanding();
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'test-compositions',
      version: '1.0.0',
      contributes: {
        compositions: [
          {
            id: 'feature-pack',
            name: 'Feature pack',
            version: 1,
            surfaces: ['site'],
            rootId: 'pack-root',
            nodes: {
              'pack-root': {
                id: 'pack-root',
                type: 'box',
                props: { padding: 'roomy' },
                slots: { default: ['pack-copy'] },
              },
              'pack-copy': {
                id: 'pack-copy',
                type: 'text',
                props: { content: 'A complete reusable section.' },
              },
            },
          },
        ],
      },
    });
    const before = structuredClone(kernel.getDocument());

    const tx = kernel.dispatch('insertComposition', {
      compositionId: 'feature-pack',
      parentId: 'root',
      slot: 'default',
      index: 1,
    });
    const inserted = insertedNodeId(tx.patches);

    expect(inserted).toBe('c-0001');
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toEqual([
      'hero1',
      'c-0001',
      'sec1',
    ]);
    expect(kernel.getDocument().nodes['c-0001']).toMatchObject({
      id: 'c-0001',
      type: 'box',
      slots: { default: ['c-0002'] },
    });
    expect(kernel.getDocument().nodes['c-0002']?.props['content']).toBe(
      'A complete reusable section.',
    );
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.validate()).toEqual([]);

    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
  });

  it('insertComposition rejects a stale or surface-incompatible template with zero trace', () => {
    const kernel = kernelWithLanding();
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'broken-compositions',
      version: '1.0.0',
      contributes: {
        compositions: [
          {
            id: 'unknown-block-pack',
            name: 'Unknown block pack',
            version: 1,
            rootId: 'unknown-root',
            nodes: {
              'unknown-root': { id: 'unknown-root', type: 'not-installed', props: {} },
            },
          },
          {
            id: 'docs-only-pack',
            name: 'Docs only pack',
            version: 1,
            surfaces: ['docs'],
            rootId: 'docs-root',
            nodes: { 'docs-root': { id: 'docs-root', type: 'text', props: {} } },
          },
        ],
      },
    });
    const before = kernel.getDocument();

    expectViolation(
      () =>
        kernel.dispatch('insertComposition', {
          compositionId: 'unknown-block-pack',
          parentId: 'root',
        }),
      /invalid.*unregistered type/i,
    );
    expectViolation(
      () =>
        kernel.dispatch('insertComposition', {
          compositionId: 'docs-only-pack',
          parentId: 'root',
        }),
      /not available on surface/i,
    );
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('insertNode rejects unknown parents, undeclared slots, disallowed types, and capacity overflow', () => {
    const kernel = kernelWithLanding();
    expectViolation(
      () => kernel.dispatch('insertNode', { type: 'text', parentId: 'ghost' }),
      /does not exist/,
    );
    expectViolation(
      () => kernel.dispatch('insertNode', { type: 'text', parentId: 'cta1' }),
      /does not declare slot/,
    );
    expectViolation(
      () => kernel.dispatch('insertNode', { type: 'text', parentId: 'hero1', slot: 'actions' }),
      /accepts \[button\]/,
    );
    // hero actions max = 2 and the landing hero already has two buttons:
    expectViolation(
      () => kernel.dispatch('insertNode', { type: 'button', parentId: 'hero1', slot: 'actions' }),
      /at most 2/,
    );
  });

  it('removeNode protects the root and removes whole subtrees without orphans', () => {
    const kernel = kernelWithLanding();
    expectViolation(() => kernel.dispatch('removeNode', { id: 'root' }), /root node/i);

    kernel.dispatch('removeNode', { id: 'hero1' });
    const doc = kernel.getDocument();
    expect(doc.nodes['hero1']).toBeUndefined();
    expect(doc.nodes['cta1']).toBeUndefined();
    expect(doc.nodes['cta2']).toBeUndefined();
    expect(doc.nodes['root']?.slots?.['default']).toEqual(['sec1']);
    expect(kernel.validate()).toEqual([]);
  });

  it('moveNode rejects cycles (into own subtree) and honours order', () => {
    const kernel = kernelWithLanding();
    expectViolation(
      () => kernel.dispatch('moveNode', { id: 'sec1', toParentId: 'p1' }),
      /own subtree/,
    );

    kernel.dispatch('moveNode', { id: 'sec1', toParentId: 'root', toIndex: 0 });
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['sec1', 'hero1']);
    expect(kernel.validate()).toEqual([]);
  });

  it('setProp validates the key against the schema; unknown keys are violations', () => {
    const kernel = kernelWithLanding();
    expectViolation(
      () => kernel.dispatch('setProp', { id: 'p1', key: 'volume', value: 'loud' }),
      /declares no prop/,
    );
    expect(() => kernel.dispatch('setProp', { id: 'hero1', key: 'tone', value: 'neon' })).toThrow(
      /failed its schema/,
    );
  });

  it('setBinding sets and clears; clearing the last binding removes the record', () => {
    const kernel = kernelWithLanding();
    kernel.dispatch('setBinding', { id: 'p1', key: 'content', path: 'mock.copy' });
    expect(kernel.getDocument().nodes['p1']?.bindings).toEqual({ content: 'mock.copy' });
    kernel.dispatch('setBinding', { id: 'p1', key: 'content', path: null });
    expect(kernel.getDocument().nodes['p1']?.bindings).toBeUndefined();
  });

  it('setResponsive stores value-only overrides and cleans empty buckets (Law R)', () => {
    const kernel = kernelWithLanding();
    kernel.dispatch('setResponsive', {
      id: 'p1',
      breakpoint: 'tablet',
      key: 'content',
      value: 'On tablet.',
    });
    expect(kernel.getDocument().nodes['p1']?.responsive).toEqual({
      tablet: { content: 'On tablet.' },
    });
    kernel.dispatch('setResponsive', {
      id: 'p1',
      breakpoint: 'tablet',
      key: 'content',
      value: null,
    });
    expect(kernel.getDocument().nodes['p1']?.responsive).toBeUndefined();

    // Structural keys are unrepresentable in the args shape — 'slots' is simply
    // not a declared prop of 'text', so the override is rejected:
    expectViolation(
      () =>
        kernel.dispatch('setResponsive', {
          id: 'p1',
          breakpoint: 'mobile',
          key: 'slots',
          value: 'x',
        }),
      /declares no prop/,
    );
  });

  it('duplicateNode deep-copies with fresh ids right after the original', () => {
    const kernel = kernelWithLanding();
    const tx = kernel.dispatch('duplicateNode', { id: 'hero1' });
    const cloneId = insertedNodeId(tx.patches);
    if (cloneId === undefined) {
      throw new Error('duplicate produced no clone');
    }
    const doc = kernel.getDocument();
    expect(doc.nodes['root']?.slots?.['default']).toEqual(['hero1', cloneId, 'sec1']);
    const clone = doc.nodes[cloneId];
    expect(clone?.props).toEqual(doc.nodes['hero1']?.props);
    expect(clone?.slots?.['actions']).toHaveLength(2);
    expect(clone?.slots?.['actions']).not.toEqual(doc.nodes['hero1']?.slots?.['actions']);
    expect(kernel.validate()).toEqual([]);
  });

  it('wrapNode replaces the node with a wrapper that adopts it', () => {
    const kernel = kernelWithLanding();
    const tx = kernel.dispatch('wrapNode', { id: 'p1', wrapperType: 'box' });
    const wrapperId = insertedNodeId(tx.patches);
    if (wrapperId === undefined) {
      throw new Error('wrap produced no wrapper');
    }
    const doc = kernel.getDocument();
    expect(doc.nodes['sec1']?.slots?.['default']).toEqual([wrapperId]);
    expect(doc.nodes[wrapperId]?.slots?.['default']).toEqual(['p1']);
    expect(kernel.validate()).toEqual([]);
  });

  it('groupNodes extracts same-slot siblings, preserving document order', () => {
    const kernel = kernelWithLanding();
    const t2 = insertedNodeId(
      kernel.dispatch('insertNode', { type: 'text', parentId: 'sec1' }).patches,
    );
    if (t2 === undefined) {
      throw new Error('setup insert failed');
    }

    // Argument order reversed on purpose — document order must win.
    const tx = kernel.dispatch('groupNodes', { ids: [t2, 'p1'], groupType: 'box' });
    const groupId = insertedNodeId(tx.patches);
    if (groupId === undefined) {
      throw new Error('group produced no group');
    }
    const doc = kernel.getDocument();
    expect(doc.nodes['sec1']?.slots?.['default']).toEqual([groupId]);
    expect(doc.nodes[groupId]?.slots?.['default']).toEqual(['p1', t2]);
    expect(kernel.validate()).toEqual([]);

    // Grouping across different parents is a violation:
    expectViolation(
      () => kernel.dispatch('groupNodes', { ids: ['cta1', 'p1'], groupType: 'box' }),
      /one parent slot/,
    );
    // The parent slot must allow the group type: hero actions only accepts buttons.
    expectViolation(
      () => kernel.dispatch('groupNodes', { ids: ['cta1', 'cta2'], groupType: 'box' }),
      /accepts \[button\]/,
    );
  });
});

describe('applyPatches — the code view door (011 contract §4 p1)', () => {
  // The one command whose input comes from parsed TEXT, not from a handler
  // that preserves invariants by construction — so the resulting document is
  // validated in full before the door commits.
  it('lands a whole batch as ONE transaction, and one undo restores exactly', () => {
    const kernel = kernelWithLanding();
    const before = kernel.getDocument();
    kernel.dispatch('applyPatches', {
      patches: [
        { op: 'replace', path: ['nodes', 'p1', 'props', 'content'], value: 'edited as code' },
        { op: 'replace', path: ['nodes', 'hero1', 'props', 'heading'], value: 'New heading' },
      ],
    });
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['p1']?.props['content']).toBe('edited as code');
    expect(kernel.getDocument().nodes['hero1']?.props['heading']).toBe('New heading');
    kernel.undo();
    expect(kernel.getDocument()).toEqual(before);
  });

  it('REJECTS a batch that produces an invalid document, with zero partial change', () => {
    const kernel = kernelWithLanding();
    const before = kernel.getDocument();
    // Removing a node while its slot still references it orphans the child —
    // exactly what hand-edited text can produce.
    expect(() =>
      kernel.dispatch('applyPatches', {
        patches: [{ op: 'remove', path: ['nodes', 'p1'] }],
      }),
    ).toThrow(BuilderError);
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('refuses to change schemaVersion — migrations own that field (Law M)', () => {
    const kernel = kernelWithLanding();
    expect(() =>
      kernel.dispatch('applyPatches', {
        patches: [{ op: 'replace', path: ['schemaVersion'], value: 999 }],
      }),
    ).toThrow(/schemaVersion/);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('a hostile path cannot address the prototype', () => {
    const kernel = kernelWithLanding();
    expect(() =>
      kernel.dispatch('applyPatches', {
        patches: [{ op: 'replace', path: ['nodes', '__proto__', 'polluted'], value: true }],
      }),
    ).toThrow(BuilderError);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it.each(RESERVED_PATCH_PATH_SEGMENTS)(
    'rejects reserved string path segment "%s" in the zod door with a typed refusal',
    (segment) => {
      const kernel = kernelWithLanding();
      const before = kernel.getDocument();
      const args = {
        patches: [
          {
            op: 'add' as const,
            path: ['nodes', segment],
            value: { id: segment, type: 'text', props: { content: 'must not land' } },
          },
        ],
      };

      expect(coreCommands.applyPatches.argsSchema.safeParse(args).success).toBe(false);

      let refusal: unknown;
      try {
        kernel.dispatch('applyPatches', args);
      } catch (error) {
        refusal = error;
      }

      expect(refusal).toBeInstanceOf(BuilderError);
      if (!(refusal instanceof BuilderError)) {
        throw new Error('Reserved patch path did not produce a typed BuilderError refusal.');
      }
      expect(refusal.code).toBe('cmd/invalid-args');
      expect(refusal.message).toMatch(/reserved object key/i);
      expect(refusal.path).toEqual(['patches', 0, 'path', 1]);
      expect(kernel.getDocument()).toBe(before);
      expect(kernel.transactions()).toHaveLength(0);
    },
  );

  it('zod refuses a value-less replace and an empty batch inside the door (Law V)', () => {
    const kernel = kernelWithLanding();
    expect(() =>
      kernel.dispatch('applyPatches', {
        patches: [{ op: 'replace', path: ['nodes', 'p1', 'props', 'content'] }],
      }),
    ).toThrow(BuilderError);
    expect(() => kernel.dispatch('applyPatches', { patches: [] })).toThrow(BuilderError);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('a structural batch that stays VALID is accepted (remove node + its slot entry)', () => {
    const kernel = kernelWithLanding();
    const rootSlots = kernel.getDocument().nodes['root']?.slots?.['default'];
    if (rootSlots === undefined) {
      throw new Error('fixture root must have a default slot');
    }
    const index = rootSlots.indexOf('sec1');
    expect(index).toBeGreaterThanOrEqual(0);
    // The section subtree: sec1 plus everything inside it must go together.
    const doc = kernel.getDocument();
    const inSec1 = Object.values(doc.nodes).filter(
      (node) =>
        ['sec1'].includes(node.id) ||
        Object.values(doc.nodes['sec1']?.slots ?? {}).some((ids) => ids.includes(node.id)),
    );
    const patches = [
      { op: 'remove' as const, path: ['nodes', 'root', 'slots', 'default', index] },
      ...inSec1.map((node) => ({ op: 'remove' as const, path: ['nodes', node.id] })),
    ];
    kernel.dispatch('applyPatches', { patches });
    expect(kernel.getDocument().nodes['sec1']).toBeUndefined();
    expect(kernel.transactions()).toHaveLength(1);
  });
});

describe('insertedNodeId reads the SHAPE of a path, not its root', () => {
  /*
    Five call sites depend on this one function — the palette, the drag session,
    block actions, the playground's extension demo — and every one of them
    silently stopped selecting what it had just inserted the moment the
    playground booted on a site. Matching `path[0] === 'nodes'` was a statement
    about the ROOT, and the root is exactly what a site changes.
  */
  it('names the node a PAGE kernel created', () => {
    expect(insertedNodeId([{ op: 'add', path: ['nodes', 'n1'] }])).toBe('n1');
  });

  it('names the node a SITE kernel created, through a page lens', () => {
    expect(insertedNodeId([{ op: 'add', path: ['pages', 2, 'document', 'nodes', 'n1'] }])).toBe(
      'n1',
    );
  });

  it('is not fooled by a path that merely passes through nodes', () => {
    // A prop write, and a whole-map replacement: neither creates a node.
    expect(
      insertedNodeId([{ op: 'add', path: ['nodes', 'n1', 'props', 'label'] }]),
    ).toBeUndefined();
    expect(insertedNodeId([{ op: 'add', path: ['nodes'] }])).toBeUndefined();
    expect(insertedNodeId([{ op: 'replace', path: ['nodes', 'n1'] }])).toBeUndefined();
  });

  it('returns the FIRST insertion when a group made several', () => {
    expect(
      insertedNodeId([
        { op: 'replace', path: ['pages', 0, 'document', 'nodes', 'root', 'slots'] },
        { op: 'add', path: ['pages', 0, 'document', 'nodes', 'first'] },
        { op: 'add', path: ['pages', 0, 'document', 'nodes', 'second'] },
      ]),
    ).toBe('first');
  });
});
