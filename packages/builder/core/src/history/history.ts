import type { Transaction } from '@craftkit/builder-schema';

/** Consecutive setProp transactions on one (node, key) merge into one undo step. */
export const TYPING_MERGE_WINDOW_MS = 1000;

export interface History {
  record(tx: Transaction): void;
  /** Pops the entry to undo; the kernel applies its inverse. Undefined = safe no-op. */
  undo(): Transaction | undefined;
  /** Pops the entry to redo; the kernel applies its forward patches. */
  redo(): Transaction | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function createHistory(mergeWindowMs: number = TYPING_MERGE_WINDOW_MS): History {
  const past: Transaction[] = [];
  const future: Transaction[] = [];

  return {
    record(tx) {
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
      future.push(tx);
      return tx;
    },
    redo() {
      const tx = future.pop();
      if (tx === undefined) {
        return undefined;
      }
      past.push(tx);
      return tx;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}

function isTypingContinuation(previous: Transaction, next: Transaction, windowMs: number): boolean {
  if (previous.command !== 'setProp' || next.command !== 'setProp') {
    return false;
  }
  if (next.ts - previous.ts > windowMs) {
    return false;
  }
  const previousPath = previous.patches[0]?.path;
  const nextPath = next.patches[0]?.path;
  if (previousPath === undefined || nextPath === undefined) {
    return false;
  }
  return (
    previousPath.length === nextPath.length &&
    previousPath.every((segment, index) => segment === nextPath[index])
  );
}
