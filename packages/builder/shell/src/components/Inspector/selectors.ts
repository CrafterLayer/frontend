import type { ElementFocus, NodeId } from '@craftkit/builder-schema';

import type { DocumentDirection, KernelState } from './types';

/*
  The shell's whole view of kernel state, as PRIMITIVES.

  Module-level so every `useKernelSelector` call keeps one getSnapshot identity,
  and primitive-returning so a store write that changes none of these bails
  before the Inspector renders. A selector returning the selected node's
  reference is exactly what made every property edit a whole-panel render.
*/

export function selectSelectedId(state: KernelState): NodeId | null {
  return state.selection[0] ?? null;
}

export function selectSelectedType(state: KernelState): string | null {
  const id = state.selection[0];
  return id === undefined ? null : (state.doc.nodes[id]?.type ?? null);
}

/** The `label` prop when it is a string — the one prop that names the block. */
export function selectSelectedLabel(state: KernelState): string | null {
  const id = state.selection[0];
  if (id === undefined) {
    return null;
  }
  const label = state.doc.nodes[id]?.props['label'];
  return typeof label === 'string' ? label : null;
}

export function selectDir(state: KernelState): DocumentDirection {
  return state.doc.dir;
}

/**
 * The focused element inside the selection, when there is one. An object, but
 * an immer-stable one: the kernel writes a new reference only when the focus
 * itself changes, so `Object.is` bails exactly as it does for the primitives.
 */
export function selectElementFocus(state: KernelState): ElementFocus | null {
  return state.elementFocus;
}
