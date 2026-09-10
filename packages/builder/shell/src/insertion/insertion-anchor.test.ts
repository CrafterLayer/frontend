import { describe, expect, it } from 'vitest';

import type { SourceHandle } from '@craftkit/builder-schema';

import {
  createInsertionAnchor,
  revalidateInsertionAnchor,
  type InsertionAnchorResolver,
} from './insertion-anchor';

const source = (revision = 'source-1'): SourceHandle => ({
  projectId: 'project',
  modulePath: 'pages/home/Page.tsx',
  sourceRevision: revision,
  astNodeId: 'list',
});

describe('insertion anchors', () => {
  it.each(['before', 'after', 'inside'] as const)(
    'captures both adjacent identities for a %s placement',
    (mode) => {
      const result = createInsertionAnchor({
        pageId: 'home',
        owner: 'section',
        slot: 'default',
        mode,
        children: ['a', 'b', 'c'],
        index: 1,
        revision: 'site-1',
      });
      expect(result).toMatchObject({
        ok: true,
        index: 1,
        anchor: { beforeId: 'a', afterId: 'b' },
      });
    },
  );

  it('follows a stable identity boundary when unrelated siblings move before it', () => {
    const created = createInsertionAnchor({
      pageId: 'home',
      owner: 'section',
      slot: 'default',
      mode: 'before',
      children: ['a', 'b'],
      index: 1,
      revision: 'site-1',
    });
    if (!created.ok) throw new Error('fixture');
    const resolver: InsertionAnchorResolver = {
      currentRevision: () => 'site-2',
      resolveOwner: () => [{ owner: 'section', children: ['x', 'a', 'b'] }],
    };

    expect(revalidateInsertionAnchor(created.anchor, resolver)).toMatchObject({
      ok: true,
      index: 2,
      anchor: { revision: 'site-2' },
    });
  });

  it('stops without guessing when reordering separates the captured neighbors', () => {
    const created = createInsertionAnchor({
      pageId: 'home',
      owner: 'section',
      slot: 'default',
      mode: 'after',
      children: ['a', 'b', 'c'],
      index: 2,
      revision: 'site-1',
    });
    if (!created.ok) throw new Error('fixture');

    expect(
      revalidateInsertionAnchor(created.anchor, {
        currentRevision: () => 'site-2',
        resolveOwner: () => [{ owner: 'section', children: ['b', 'a', 'c'] }],
      }),
    ).toEqual({ ok: false, reason: 'neighbors-diverged' });
  });

  it('reconciles a source owner to its current source revision', () => {
    const created = createInsertionAnchor({
      pageId: 'home',
      owner: source(),
      slot: 'children',
      mode: 'inside',
      children: [],
      index: 0,
      revision: 'site-1',
    });
    if (!created.ok) throw new Error('fixture');

    expect(
      revalidateInsertionAnchor(created.anchor, {
        currentRevision: () => 'site-2',
        resolveOwner: () => [{ owner: source('source-2'), children: [] }],
      }),
    ).toMatchObject({
      ok: true,
      anchor: { revision: 'site-2', owner: { sourceRevision: 'source-2' } },
    });
  });

  it('refuses a sibling anchor with no stable neighbor', () => {
    expect(
      createInsertionAnchor({
        pageId: 'home',
        owner: 'section',
        slot: 'default',
        mode: 'before',
        children: [],
        index: 0,
        revision: 'site-1',
      }),
    ).toEqual({ ok: false, reason: 'missing-neighbor' });
  });

  it.each([
    ['missing owner', [], 'missing-owner'],
    [
      'ambiguous owner',
      [
        { owner: 'a', children: [] },
        { owner: 'b', children: [] },
      ],
      'ambiguous-owner',
    ],
  ] as const)('fails closed for a %s', (_label, owners, reason) => {
    const created = createInsertionAnchor({
      pageId: 'home',
      owner: source(),
      slot: 'children',
      mode: 'inside',
      children: [],
      index: 0,
      revision: 'site-1',
    });
    if (!created.ok) throw new Error('fixture');
    expect(
      revalidateInsertionAnchor(created.anchor, {
        currentRevision: () => 'site-2',
        resolveOwner: () => owners,
      }),
    ).toEqual({ ok: false, reason });
  });
});
