/**
 * A shadow of the kernel's undo history, rebuilt from its events (SPEC §7.6 E3 fallback).
 *
 * Until the engine ships `revertBuild` (E3), "Undo build" is a kernel undo of exactly the
 * build's own transactions, and it is offered "only while this build's transactions are
 * the newest history entries". The kernel does not expose its history stack, only
 * `canUndo()`; its transaction log is append-only and does not move on undo (Law S). So
 * the panel follows the three events that do move it, `tx.applied`, `history.undone` and
 * `history.redone`, and keeps the stack of ids they imply:
 * - a new transaction lands on top and clears the redo side, exactly like the kernel;
 * - a setProp typing burst merges into the entry below it, as `createHistory` merges it
 *   (same command, same patch path, within the kernel's merge window): the merged entry
 *   takes the newest id;
 * - an undo moves the top id to the redo side, a redo moves it back.
 *
 * Anything the shadow did not see (history from before the panel mounted, an event it
 * cannot place) makes it UNSURE of that part of the stack, and an unsure answer is "no":
 * `isNewest` and `isNextRedo` only say yes about ids they watched land, in order. The cost
 * of being wrong is an Undo that reaches past the build into the person's own work, so the
 * shadow errs toward hiding the action.
 *
 * Pure: `record*` return a new shadow; nothing here reads a clock or a kernel.
 */

/** The kernel's typing merge window (`TYPING_MERGE_WINDOW_MS` in core `history.ts`). */
export const HISTORY_MERGE_WINDOW_MS = 1_000;

/** What the shadow reads off a transaction. */
export interface ShadowTransaction {
  readonly id: string;
  readonly command: string;
  readonly ts: number;
  readonly patches: readonly { readonly path: readonly (string | number)[] }[];
}

interface Entry {
  readonly id: string;
  readonly command: string;
  readonly ts: number;
  readonly path: readonly (string | number)[] | undefined;
}

export interface HistoryShadow {
  /** Oldest first; the last entry is what `kernel.undo()` would take back next. */
  readonly past: readonly Entry[];
  /** The redo side; the last entry is what `kernel.redo()` would put back next. */
  readonly future: readonly Entry[];
}

export const EMPTY_HISTORY: HistoryShadow = { past: [], future: [] };

function entryOf(tx: ShadowTransaction): Entry {
  return { id: tx.id, command: tx.command, ts: tx.ts, path: tx.patches[0]?.path };
}

/** `createHistory`'s own merge rule: one undo step per typing burst on one prop. */
function mergesInto(previous: Entry, next: Entry): boolean {
  if (previous.command !== 'setProp' || next.command !== 'setProp') return false;
  if (next.ts - previous.ts > HISTORY_MERGE_WINDOW_MS) return false;
  const a = previous.path;
  const b = next.path;
  if (a === undefined || b?.length !== a.length) return false;
  return a.every((segment, index) => segment === b[index]);
}

/** A transaction landed through the door. */
export function recordApplied(shadow: HistoryShadow, tx: ShadowTransaction): HistoryShadow {
  const entry = entryOf(tx);
  const top = shadow.past.at(-1);
  if (top !== undefined && mergesInto(top, entry)) {
    return { past: [...shadow.past.slice(0, -1), entry], future: [] };
  }
  return { past: [...shadow.past, entry], future: [] };
}

/**
 * `kernel.undo()` took `tx` back. When it is not the top the shadow knows (history from
 * before the panel mounted), the shadow no longer knows the stack and starts over empty.
 */
export function recordUndone(shadow: HistoryShadow, tx: Pick<ShadowTransaction, 'id'>): HistoryShadow {
  const top = shadow.past.at(-1);
  if (top?.id !== tx.id) return EMPTY_HISTORY;
  return { past: shadow.past.slice(0, -1), future: [...shadow.future, top] };
}

/** `kernel.redo()` put `tx` back. */
export function recordRedone(shadow: HistoryShadow, tx: Pick<ShadowTransaction, 'id'>): HistoryShadow {
  const next = shadow.future.at(-1);
  if (next?.id !== tx.id) return EMPTY_HISTORY;
  return { past: [...shadow.past, next], future: shadow.future.slice(0, -1) };
}

/**
 * Whether `ids` (oldest first) are exactly the newest history entries, in order: then
 * `ids.length` kernel undos take back exactly them and nothing else.
 */
export function isNewest(shadow: HistoryShadow, ids: readonly string[]): boolean {
  if (ids.length === 0 || shadow.past.length < ids.length) return false;
  const top = shadow.past.slice(-ids.length);
  return top.every((entry, index) => entry.id === ids[index]);
}

/**
 * Whether `ids` (oldest first) are exactly what the next `ids.length` kernel redos put
 * back: they were undone together and nothing landed since.
 */
export function isNextRedo(shadow: HistoryShadow, ids: readonly string[]): boolean {
  if (ids.length === 0 || shadow.future.length < ids.length) return false;
  // The redo side is a stack: the oldest of `ids` was undone last, so it is on top.
  const top = shadow.future.slice(-ids.length).reverse();
  return top.every((entry, index) => entry.id === ids[index]);
}
