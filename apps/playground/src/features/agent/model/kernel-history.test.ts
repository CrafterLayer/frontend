/**
 * The shadow of the kernel's undo history (SPEC §7.6 E3 fallback): Undo build may walk
 * back exactly the build's transactions only while they are the newest entries, and the
 * shadow says "no" whenever it is unsure. Checked against a real kernel's own events.
 */
import { describe, expect, it } from 'vitest';

import { createBuildKernel } from '../testing/scripted-engine';
import {
  EMPTY_HISTORY,
  isNewest,
  isNextRedo,
  recordApplied,
  recordRedone,
  recordUndone,
  type HistoryShadow,
} from './kernel-history';

function follow() {
  const kernel = createBuildKernel();
  let shadow: HistoryShadow = EMPTY_HISTORY;
  const events = kernel.context.events;
  events.on('tx.applied', ({ tx }) => {
    shadow = recordApplied(shadow, tx);
  });
  events.on('history.undone', ({ tx }) => {
    shadow = recordUndone(shadow, tx);
  });
  events.on('history.redone', ({ tx }) => {
    shadow = recordRedone(shadow, tx);
  });
  /** The insert's transaction id; `nodeOf(label)` finds the region it made. */
  const insert = (label: string): string =>
    kernel.dispatch('insertNode', { type: 'region', parentId: 'root', props: { label, tree: '' } }).id;
  const nodeOf = (label: string): string =>
    Object.keys(kernel.getDocument().nodes).find(
      (id) => kernel.getDocument().nodes[id]?.props['label'] === label,
    ) ?? '';
  return { kernel, shadow: () => shadow, insert, nodeOf };
}

describe('the history shadow', () => {
  it('knows its newest entries, in order, and nothing below what it saw', () => {
    const { shadow, insert } = follow();
    const a = insert('A');
    const b = insert('B');
    expect(isNewest(shadow(), [a, b])).toBe(true);
    expect(isNewest(shadow(), [b])).toBe(true);
    expect(isNewest(shadow(), [a])).toBe(false);
    expect(isNewest(shadow(), [b, a])).toBe(false);
    expect(isNewest(shadow(), [])).toBe(false);
  });

  it('follows undo and redo, and a new change clears the redo side', () => {
    const { kernel, shadow, insert } = follow();
    const a = insert('A');
    const b = insert('B');
    kernel.undo();
    kernel.undo();
    expect(isNextRedo(shadow(), [a, b])).toBe(true);
    kernel.redo();
    expect(isNewest(shadow(), [a])).toBe(true);
    expect(isNextRedo(shadow(), [b])).toBe(true);
    insert('C');
    expect(isNextRedo(shadow(), [b])).toBe(false);
  });

  it('merges a typing burst like the kernel does, so a build under it is not "newest"', () => {
    const { kernel, shadow, insert, nodeOf } = follow();
    const a = insert('A');
    kernel.dispatch('setProp', { id: nodeOf('A'), key: 'tree', value: 'x' });
    kernel.dispatch('setProp', { id: nodeOf('A'), key: 'tree', value: 'xy' });
    // Two setProps on one path within the window are ONE history entry.
    expect(shadow().past).toHaveLength(2);
    expect(isNewest(shadow(), [a])).toBe(false);
  });

  it('gives up, saying no, when an undo reaches history it never saw', () => {
    let shadow: HistoryShadow = EMPTY_HISTORY;
    shadow = recordApplied(shadow, { id: 'tx-1', command: 'x', ts: 0, patches: [] });
    shadow = recordUndone(shadow, { id: 'tx-0' });
    expect(shadow).toBe(EMPTY_HISTORY);
    expect(isNewest(shadow, ['tx-1'])).toBe(false);
  });
});
