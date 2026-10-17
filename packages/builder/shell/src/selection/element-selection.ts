import type { BuilderKernel } from '@craftkit/builder-core';
import type { KernelState } from '@craftkit/builder-schema';

import {
  elementTargetKey,
  resolveElementTarget,
  sameElementTarget,
  type ElementTarget,
} from '../custom-code/element-target';
import { isSymbolInstance } from '../style-manager/tree-writes';

/*
  ── Multi-selection of elements (style-manager DESIGN.md §A.1, §E) ──────────

  An EPHEMERAL, shell-only store: it never writes the document and never
  creates a transaction. The kernel stays the owner of the PRIMARY target —
  `elementFocus` when an element inside a region is focused, otherwise the
  selected block — and this store adds the extra members that Shift-click on
  the canvas and Shift/Mod-click in Layers toggle in.

  Three rules keep it honest:

  1. `targets()[0]` is always the kernel's primary. Changing the primary goes
     through the kernel (`focusElement` / `setSelection`), so every existing
     reader of the kernel selection keeps working.
  2. When the primary changes from OUTSIDE this store (a plain click, a
     keyboard step, the agent), the extra members are dropped: a plain click
     collapses a multi-selection, as in every editor.
  3. Members whose node or path vanished (undo, an AI rewrite, a delete) are
     pruned on the next kernel change, so a consumer never edits a ghost.

  `subscribe` + `targets` are `useSyncExternalStore`-shaped: `targets()`
  returns the SAME array until the membership actually changes.
*/

export interface ElementSelection {
  /** Primary first, then the extra members in the order they were added. */
  targets(): readonly ElementTarget[];
  /** Replace the whole set; the first target becomes the kernel's primary. */
  set(targets: readonly ElementTarget[]): void;
  /** Add a target, or remove it when present (removing the primary promotes the next). */
  toggle(target: ElementTarget): void;
  /** Drop every member, the kernel's primary included. */
  clear(): void;
  /** Whether a target is a member. */
  has(target: ElementTarget): boolean;
  subscribe(listener: () => void): () => void;
  /** Detach from the kernel. */
  dispose(): void;
}

function primaryFrom(state: Readonly<KernelState>): ElementTarget | undefined {
  if (state.elementFocus !== null) {
    return { kind: 'tree', nodeId: state.elementFocus.id, path: [...state.elementFocus.path] };
  }
  const first = state.selection[0];
  return first === undefined ? undefined : { kind: 'block', nodeId: first };
}

function primaryKey(state: Readonly<KernelState>): string {
  const primary = primaryFrom(state);
  return primary === undefined ? '' : elementTargetKey(primary);
}

export function createElementSelection(kernel: BuilderKernel): ElementSelection {
  const listeners = new Set<() => void>();
  let extras: ElementTarget[] = [];
  let snapshot: readonly ElementTarget[] = [];
  let snapshotKey = '';
  let lastPrimary = primaryKey(kernel.context.store.getState());

  function isLive(target: ElementTarget): boolean {
    // An element inside a symbol instance lives in the master's tree (read through the library).
    if (target.kind === 'tree' && isSymbolInstance(kernel, target.nodeId)) return true;
    return resolveElementTarget(kernel, target) !== undefined;
  }

  /** Recompute the snapshot; a new array only when the membership changed. */
  function refresh(): boolean {
    const primary = primaryFrom(kernel.context.store.getState());
    const live = primary !== undefined && isLive(primary) ? primary : undefined;
    const members = live === undefined ? [] : [live];
    const kept: ElementTarget[] = [];
    for (const target of extras) {
      if (!isLive(target)) continue;
      if (members.some((member) => sameElementTarget(member, target))) continue;
      if (kept.some((member) => sameElementTarget(member, target))) continue;
      kept.push(target);
    }
    extras = kept;
    members.push(...kept);
    const key = members.map(elementTargetKey).join('|');
    if (key === snapshotKey) return false;
    snapshotKey = key;
    snapshot = members;
    return true;
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  /** Point the kernel at a new primary, remembering that THIS store moved it. */
  function setPrimary(target: ElementTarget | undefined): void {
    // Marked BEFORE the write: the kernel notifies subscribers synchronously,
    // and that notification must already read as ours.
    lastPrimary = target === undefined ? '' : elementTargetKey(target);
    if (target === undefined) {
      kernel.clearSelection();
    } else if (target.kind === 'tree') {
      kernel.focusElement(target.nodeId, target.path);
    } else {
      kernel.setSelection([target.nodeId]);
    }
    lastPrimary = primaryKey(kernel.context.store.getState());
  }

  function apply(nextPrimary: ElementTarget | undefined, nextExtras: ElementTarget[]): void {
    extras = nextExtras;
    // Writing the kernel notifies the subscription below; mark first so that
    // notification is recognised as ours and does not drop the extras.
    setPrimary(nextPrimary);
    if (refresh()) notify();
  }

  const unsubscribe = kernel.context.store.subscribe((state) => {
    const key = primaryKey(state);
    if (key !== lastPrimary) {
      // Rule 2: the primary moved without us — a plain click collapses the set.
      lastPrimary = key;
      extras = [];
    }
    if (refresh()) notify();
  });

  refresh();

  return {
    targets: () => snapshot,
    set(targets) {
      const [first, ...rest] = targets.filter(isLive);
      apply(first, rest);
    },
    toggle(target) {
      if (!isLive(target)) return;
      const current = snapshot;
      const index = current.findIndex((member) => sameElementTarget(member, target));
      if (index === -1) {
        if (current.length === 0) apply(target, []);
        else apply(current[0], [...current.slice(1), target]);
        return;
      }
      const remaining = current.filter((_, at) => at !== index);
      apply(remaining[0], remaining.slice(1));
    },
    clear() {
      apply(undefined, []);
    },
    has(target) {
      return snapshot.some((member) => sameElementTarget(member, target));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}
