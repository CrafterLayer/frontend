import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { performMoveAction, resolveMoveAction } from './move-actions';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, slots?: Record<string, { allow: string[]; max?: number }>) => ({
  schema: defineBlockSchema({
    type,
    description: type,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'move-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', { default: { allow: ['section'] } }),
      block('section', { default: { allow: ['text', 'section'] } }),
      block('text'),
    ],
  },
};

// root → [sA(t1, t2, sInner), sB]
const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['sA', 'sB'] } },
    sA: { id: 'sA', type: 'section', props: {}, slots: { default: ['t1', 't2', 'sInner'] } },
    t1: { id: 't1', type: 'text', props: {} },
    t2: { id: 't2', type: 'text', props: {} },
    sInner: { id: 'sInner', type: 'section', props: {} },
    sB: { id: 'sB', type: 'section', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('mv') },
  });

describe('resolveMoveAction (Alt+arrows, RTL mirrored)', () => {
  it('requires Alt and mirrors the horizontal pair', () => {
    expect(resolveMoveAction('ArrowDown', false, 'ltr')).toBeUndefined();
    expect(resolveMoveAction('ArrowDown', true, 'ltr')).toBe('down');
    expect(resolveMoveAction('ArrowUp', true, 'rtl')).toBe('up');
    expect(resolveMoveAction('ArrowRight', true, 'ltr')).toBe('in');
    expect(resolveMoveAction('ArrowRight', true, 'rtl')).toBe('out');
    expect(resolveMoveAction('ArrowLeft', true, 'ltr')).toBe('out');
    expect(resolveMoveAction('Escape', true, 'ltr')).toBeUndefined();
  });
});

describe('performMoveAction (006 contract §3)', () => {
  it('k1: sibling swap in one transaction; selection stays; edges clamp silently', () => {
    const kernel = makeKernel();
    expect(performMoveAction(kernel, 't2', 'up')).toContain('earlier');
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual(['t2', 't1', 'sInner']);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.context.store.getState().selection).toEqual(['t2']);

    expect(performMoveAction(kernel, 't2', 'up')).toBe('Already first');
    expect(kernel.transactions()).toHaveLength(1); // clamp = no transaction

    expect(performMoveAction(kernel, 'sInner', 'down')).toBe('Already last');
    expect(kernel.transactions()).toHaveLength(1);
  });

  it("k2 out: becomes the parent's next sibling when the grandparent slot accepts", () => {
    const kernel = makeKernel();
    expect(performMoveAction(kernel, 'sInner', 'out')).toContain('out');
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toEqual(['sA', 'sInner', 'sB']);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('k2 out: an illegal move announces the reason and changes nothing', () => {
    const kernel = makeKernel();
    // t1's grandparent slot is root.default which accepts only sections.
    const message = performMoveAction(kernel, 't1', 'out');
    expect(message).toContain('Cannot move out');
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('k2 in: appends into the nearest PRECEDING sibling that accepts', () => {
    const kernel = makeKernel();
    // sB's preceding sibling is sA (a section accepting sections/text).
    expect(performMoveAction(kernel, 'sB', 'in')).toContain('into');
    expect(kernel.getDocument().nodes['sA']?.slots?.['default']).toEqual([
      't1',
      't2',
      'sInner',
      'sB',
    ]);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('k2 in: no preceding acceptor announces and changes nothing', () => {
    const kernel = makeKernel();
    // t1 is first in its slot — nothing precedes it.
    expect(performMoveAction(kernel, 't1', 'in')).toContain('No earlier sibling');
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('the document root cannot move', () => {
    const kernel = makeKernel();
    expect(performMoveAction(kernel, 'root', 'down')).toContain('root');
    expect(kernel.transactions()).toHaveLength(0);
  });
});
