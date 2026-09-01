import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { createBuilder } from '../kernel/create-builder';
import { GROUPED_DISPATCH_LABEL_MAX_LENGTH } from './dispatch';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '../testing';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('group') },
  });
}

const THREE_STEPS = [
  { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Grouped' } },
  { command: 'insertNode', args: { type: 'text', props: { content: 'One' }, parentId: 'sec1' } },
  { command: 'insertNode', args: { type: 'text', props: { content: 'Two' }, parentId: 'sec1' } },
] as const;

describe('dispatchGroup', () => {
  it('applies every step as ONE transaction and ONE undo restores the exact document', () => {
    const k = kernel();
    const before = structuredClone(k.getDocument());

    const tx = k.dispatchGroup([...THREE_STEPS], 'ai');

    expect(k.transactions()).toHaveLength(1);
    expect(tx.author).toBe('ai');
    expect(tx.command).toBe('group(3)');
    const doc = k.getDocument();
    expect(doc.nodes['hero1']?.props['heading']).toBe('Grouped');
    const contents = Object.values(doc.nodes).map((node) => node.props['content']);
    expect(contents).toEqual(expect.arrayContaining(['One', 'Two']));

    expect(k.undo()).toBe(true);
    expect(k.getDocument()).toEqual(before);
    expect(k.canUndo()).toBe(false);

    expect(k.redo()).toBe(true);
    expect(k.getDocument().nodes['hero1']?.props['heading']).toBe('Grouped');
  });

  /*
    The uSES ordering, for the GROUPED door (003 contract §15).

    `store.write` is the observable moment, and React's `useSyncExternalStore`
    reads its snapshot SYNCHRONOUSLY inside the notification. A subscriber that
    derives from the log — `transactions().length` is the real case — must
    already see this transaction by then. Record after notifying and the
    change-check bails out, leaving the view one event behind FOREVER rather
    than merely late; nothing later re-notifies to repair it.

    Grouped dispatch shares `commit()` with single dispatch today, so this is
    also the test that notices if the group path ever grows its own commit.
  */
  it('has already logged and recorded the group by the time subscribers are notified', () => {
    const k = kernel();
    const seen: { transactions: number; canUndo: boolean; heading: unknown }[] = [];

    const unsubscribe = k.context.store.subscribe(() => {
      seen.push({
        transactions: k.transactions().length,
        canUndo: k.canUndo(),
        heading: k.getDocument().nodes['hero1']?.props['heading'],
      });
    });

    expect(k.transactions()).toHaveLength(0);
    k.dispatchGroup([...THREE_STEPS], { author: 'ai', label: 'Grouped write' });
    unsubscribe();

    expect(seen).not.toHaveLength(0);
    /* One notification, and the log/history/document all agree inside it. */
    expect(seen[0]?.transactions).toBe(1);
    expect(seen[0]?.canUndo).toBe(true);
    expect(seen[0]?.heading).toBe('Grouped');
  });

  it('is atomic: a failing middle step leaves document, log, and history untouched', () => {
    const k = kernel();
    const before = structuredClone(k.getDocument());

    expect(() =>
      k.dispatchGroup(
        [
          { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Half' } },
          { command: 'removeNode', args: { id: 'ghost-node' } },
        ],
        'ai',
      ),
    ).toThrow();

    expect(k.getDocument()).toEqual(before);
    expect(k.transactions()).toHaveLength(0);
    expect(k.canUndo()).toBe(false);
  });

  it('rejects unknown commands and bad args BEFORE touching anything', () => {
    const k = kernel();
    const before = structuredClone(k.getDocument());

    expect(() => k.dispatchGroup([{ command: 'invent', args: {} }], 'ai')).toThrow(/invent/);
    expect(() =>
      k.dispatchGroup(
        [
          { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'ok' } },
          { command: 'insertNode', args: {} },
        ],
        'ai',
      ),
    ).toThrow();
    expect(k.getDocument()).toEqual(before);
    expect(k.transactions()).toHaveLength(0);
  });

  it('treats a no-effect group as no observable change: nothing logged, nothing undoable', () => {
    const k = kernel();
    const current = k.getDocument().nodes['hero1']?.props['heading'];

    k.dispatchGroup([
      { command: 'setProp', args: { id: 'hero1', key: 'heading', value: current } },
    ]);

    expect(k.transactions()).toHaveLength(0);
    expect(k.canUndo()).toBe(false);
  });

  it('accepts options, trims a human label, and stores it on the one transaction', () => {
    const k = kernel();

    const tx = k.dispatchGroup([...THREE_STEPS], {
      author: 'ai',
      label: '  Refresh the landing-page story  ',
    });

    expect(tx.author).toBe('ai');
    expect(tx.command).toBe('Refresh the landing-page story');
    expect(k.transactions()).toEqual([tx]);
    expect(k.undo()).toBe(true);
    expect(k.canUndo()).toBe(false);
  });

  it('keeps legacy labels and defaults the options author to user', () => {
    const single = kernel().dispatchGroup([
      { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Single' } },
    ]);
    expect(single.command).toBe('setProp');
    expect(single.author).toBe('user');

    const labelled = kernel().dispatchGroup(
      [{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Labelled' } }],
      { label: 'One precise edit' },
    );
    expect(labelled.command).toBe('One precise edit');
    expect(labelled.author).toBe('user');
  });

  it('rejects empty, non-string, and oversized labels before touching state or history', () => {
    const invalidLabels: unknown[] = ['   ', 42, 'x'.repeat(GROUPED_DISPATCH_LABEL_MAX_LENGTH + 1)];

    for (const label of invalidLabels) {
      const k = kernel();
      const before = structuredClone(k.getDocument());

      expect(() =>
        k.dispatchGroup([...THREE_STEPS], {
          author: 'ai',
          label: label as string,
        }),
      ).toThrow();
      expect(k.getDocument()).toEqual(before);
      expect(k.transactions()).toHaveLength(0);
      expect(k.canUndo()).toBe(false);
    }
  });

  it('rejects an invalid runtime author instead of corrupting transaction provenance', () => {
    const k = kernel();
    const before = k.getDocument();

    expect(() => k.dispatchGroup([...THREE_STEPS], 'robot' as 'ai')).toThrow(/author/i);
    expect(() => k.dispatchGroup([...THREE_STEPS], { author: null as unknown as 'ai' })).toThrow(
      /author/i,
    );
    expect(k.getDocument()).toBe(before);
    expect(k.transactions()).toEqual([]);
  });

  it('bounds the derived legacy label even when an extension command name is oversized', () => {
    const longCommand = `extension.${'x'.repeat(GROUPED_DISPATCH_LABEL_MAX_LENGTH)}`;
    const extension: TrustedExtensionManifest = {
      tier: 1,
      name: '@craftkit/test-long-command',
      version: '1.0.0',
      contributes: {
        commands: {
          [longCommand]: {
            argsSchema: z.strictObject({}),
            apply: () => (draft) => {
              draft.dir = 'rtl';
            },
          },
        },
      },
    };
    const k = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks, extension],
      ports: { clock: fixedClock(10), ids: seededIds('long-label') },
    });

    const tx = k.dispatchGroup([{ command: longCommand, args: {} }]);

    expect(tx.command).toBe(longCommand.slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH));
    expect(tx.command).toHaveLength(GROUPED_DISPATCH_LABEL_MAX_LENGTH);
    expect(k.transactions()).toEqual([tx]);
  });
});
