import { describe, expect, it } from 'vitest';

import { BuilderError } from '@craftkit/builder-schema';

import { createBuilder, type BuilderKernel } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { insertedNodeId } from './core-commands';

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
