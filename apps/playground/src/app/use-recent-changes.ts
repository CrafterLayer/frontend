import { useSyncExternalStore } from 'react';

import type { BuilderKernel, ChangeDoor, RecentChange } from '@craftkit/builder';

/**
 * The provenance strip's data — read, never invented.
 *
 * The kernel has stamped `author` on every transaction since B0: a change knows
 * whether it came from the canvas, the code view, or the assistant. Nothing in
 * the interface has ever shown it, so an author could not answer the question
 * they ask most often after a busy minute — "what just changed, and was that
 * me?". This maps that existing field onto the status bar's chips.
 *
 * Deliberately a projection, not a store: the transaction log is already the
 * source of truth, and a second list of the same facts is a second list to get
 * wrong.
 */

const DOOR_BY_AUTHOR: Readonly<Record<string, ChangeDoor>> = {
  user: 'canvas',
  codeview: 'code',
  ai: 'assistant',
};

/**
 * A command name is machinery (`setProp`, `insertNode`); the strip needs the
 * author's words. This is the smallest honest translation — where a command
 * has no phrasing yet it falls back to the name rather than inventing prose.
 */
const PHRASE_BY_COMMAND: Readonly<Record<string, string>> = {
  insertNode: 'add block',
  removeNode: 'remove block',
  moveNode: 'move block',
  duplicateNode: 'duplicate block',
  setProp: 'edit property',
  setBinding: 'bind data',
  setResponsive: 'device override',
  setDocMeta: 'page settings',
  applyPatches: 'code edit',
};

export function useRecentChanges(kernel: BuilderKernel, limit = 3): readonly RecentChange[] {
  const transactions = useSyncExternalStore(
    (listener) => kernel.context.store.subscribe(listener),
    () => kernel.transactions(),
    () => kernel.transactions(),
  );

  // Newest first, which is the order the strip reads in.
  return transactions
    .slice(-limit)
    .reverse()
    .map((transaction) => ({
      id: transaction.id,
      door: DOOR_BY_AUTHOR[transaction.author] ?? 'canvas',
      label: PHRASE_BY_COMMAND[transaction.command] ?? transaction.command,
    }));
}
