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

export interface RecentChangesOptions {
  /** How many chips the strip shows (default 3). */
  readonly limit?: number | undefined;
  /**
   * A door whose changes another surface already speaks for. With the v2 agent panel
   * mounted, the assistant's changes are its thread's records (and the status-bar pill
   * while the panel is hidden), so the strip no longer stacks three "Assistant: …" chips,
   * one per landed section, in engine words (SPEC §4.20: the pill replaces them).
   */
  readonly exclude?: ChangeDoor | undefined;
}

/** What the strip lists, and whether it left out changes another surface speaks for. */
export interface RecentChanges {
  /** Newest first, at most `limit`. */
  readonly changes: readonly RecentChange[];
  /**
   * Changes through the excluded door exist in the log. The strip must then not say "No
   * recent changes" when it lists none: after an AI build of eight sections it did, and the
   * page had plainly changed (final test, 2026-09-29).
   */
  readonly spokenElsewhere: boolean;
}

/** The pure projection behind the hook: the log in, the strip's rows out. */
export function recentChangesOf(
  transactions: readonly {
    readonly id: string;
    readonly author: string;
    readonly command: string;
  }[],
  { limit = 3, exclude }: RecentChangesOptions = {},
): RecentChanges {
  const all = transactions.map((transaction) => ({
    id: transaction.id,
    door: DOOR_BY_AUTHOR[transaction.author] ?? 'canvas',
    label: PHRASE_BY_COMMAND[transaction.command] ?? transaction.command,
  }));
  const shown = all.filter((change) => change.door !== exclude);
  return {
    // Newest first, which is the order the strip reads in.
    changes: shown.slice(-limit).reverse(),
    spokenElsewhere: shown.length < all.length,
  };
}

export function useRecentChanges(
  kernel: BuilderKernel,
  options: RecentChangesOptions = {},
): RecentChanges {
  const transactions = useSyncExternalStore(
    (listener) => kernel.context.store.subscribe(listener),
    () => kernel.transactions(),
    () => kernel.transactions(),
  );
  return recentChangesOf(transactions, options);
}
