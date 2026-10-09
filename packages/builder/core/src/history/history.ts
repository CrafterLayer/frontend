import type { Author, Transaction } from '@craftkit/builder-schema';

/**
 * Consecutive setProp transactions on one (node, key) — and a person's repeated
 * labelled edit on the same paths — merge into one undo step.
 */
export const TYPING_MERGE_WINDOW_MS = 1000;

export interface History {
  record(tx: Transaction): void;
  /** Pops the entry to undo; the kernel applies its inverse. Undefined = safe no-op. */
  undo(): Transaction | undefined;
  /** Pops the entry to redo; the kernel applies its forward patches. */
  redo(): Transaction | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  /**
   * Read-only view of the undo stack (style-manager DESIGN.md §E, History
   * panel): every recorded step oldest first — the applied ones, then the
   * undone ones in redo order. The SAME array is returned until the stack
   * changes, so it can feed `useSyncExternalStore` directly.
   */
  entries(): readonly HistoryEntry[];
  /** How many entries are applied: `entries().slice(0, position())` is the past. */
  position(): number;
}

/** One undo step as the History panel lists it. Derived, never stored in the document. */
export interface HistoryEntry {
  /** The transaction id (for a merged typing burst, the latest keystroke's). */
  readonly id: string;
  /** The grouped-dispatch label, or the command name for a single dispatch. */
  readonly label: string;
  readonly author: Author;
  /** Clock time of the step (`Transaction.ts`). */
  readonly at: number;
}

function entryOf(tx: Transaction): HistoryEntry {
  return { id: tx.id, label: tx.command, author: tx.author, at: tx.ts };
}

export function createHistory(mergeWindowMs: number = TYPING_MERGE_WINDOW_MS): History {
  const past: Transaction[] = [];
  const future: Transaction[] = [];
  // Cached read model: rebuilt lazily after a change, so `entries()` keeps
  // its identity between changes (a stable external-store snapshot).
  let snapshot: readonly HistoryEntry[] | undefined;

  return {
    record(tx) {
      snapshot = undefined;
      future.length = 0;
      const previous = past.at(-1);
      if (previous !== undefined && isTypingContinuation(previous, tx, mergeWindowMs)) {
        // Merged step: redo lands on the LATEST value, undo restores the value
        // from BEFORE the burst — one undo step per typing burst.
        past[past.length - 1] = { ...tx, inverse: previous.inverse };
        return;
      }
      past.push(tx);
    },
    undo() {
      const tx = past.pop();
      if (tx === undefined) {
        return undefined;
      }
      snapshot = undefined;
      future.push(tx);
      return tx;
    },
    redo() {
      const tx = future.pop();
      if (tx === undefined) {
        return undefined;
      }
      snapshot = undefined;
      past.push(tx);
      return tx;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    entries() {
      // `future` is a stack (next redo last), so it reads back reversed.
      snapshot ??= Object.freeze([...past, ...[...future].reverse()].map(entryOf));
      return snapshot;
    },
    position: () => past.length,
  };
}

function samePath(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((segment, index) => segment === b[index]);
}

function isTypingContinuation(previous: Transaction, next: Transaction, windowMs: number): boolean {
  if (next.ts - previous.ts > windowMs) {
    return false;
  }
  if (previous.command === 'setProp' && next.command === 'setProp') {
    const previousPath = previous.patches[0]?.path;
    const nextPath = next.patches[0]?.path;
    return previousPath !== undefined && nextPath !== undefined && samePath(previousPath, nextPath);
  }
  /*
    A labelled edit a PERSON repeats on exactly the same paths — a rich-text
    session on the canvas or in the Inspector commits once per editor update
    ("Edit text · Rich Text"), so typing "word" was four Undos where plain
    text is one (walk 2026-10-08). The same burst rule applies: same label,
    same author, the same set of written paths, inside the window.
  */
  if (previous.command !== next.command || previous.author !== 'user' || next.author !== 'user') {
    return false;
  }
  if (previous.patches.length === 0 || previous.patches.length !== next.patches.length) {
    return false;
  }
  return previous.patches.every((patch, index) => {
    const other = next.patches[index];
    return other !== undefined && samePath(patch.path, other.path);
  });
}
