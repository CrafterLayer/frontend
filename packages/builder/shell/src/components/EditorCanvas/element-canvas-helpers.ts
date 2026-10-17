import type { BuilderKernel } from '@craftkit/builder-core';
import type { RenderBreakpoint } from '@craftkit/builder-renderer';
import {
  formatCustomCodePath,
  type CustomCodePath,
  type NodeId,
  type StyleBucket,
} from '@craftkit/builder-schema';

import { customCodeElementAt } from '../../custom-code/element-at';
import type { ElementTarget } from '../../custom-code/element-target';
import type { RectIndex } from '../../rects';

/*
  Small canvas-side readers for the element chrome (style-manager DESIGN.md
  §A.6, §E). Pure apart from the DOM lookups, so EditorCanvas stays a wiring
  file and these stay testable.
*/

/**
 * Locked elements pass clicks to their parent: walk up from the hit path past
 * every locked node. `undefined` means the click lands on the REGION itself
 * (everything up to the root was locked).
 */
export function unlockedPath(
  kernel: BuilderKernel,
  nodeId: NodeId,
  path: CustomCodePath,
): CustomCodePath | undefined {
  let current = [...path];
  while (current.length > 0) {
    const found = customCodeElementAt(kernel, nodeId, current);
    if (found === undefined) return current;
    if (found.element.locked !== true) return current;
    current = current.slice(0, -1);
  }
  return undefined;
}

/** The canvas DOM of a tree element (the one stamped with its `data-ck-path`). */
export function elementDomOf(
  index: Pick<RectIndex, 'element'>,
  nodeId: NodeId,
  path: CustomCodePath,
): HTMLElement | null {
  const owner = index.element(nodeId);
  if (owner === undefined || path.length === 0) return null;
  return owner.querySelector<HTMLElement>(`[data-ck-path="${formatCustomCodePath(path)}"]`);
}

/** The panel bucket a render breakpoint edits when the host passes none (DESIGN §A.7). */
export function bucketForBreakpoint(breakpoint: RenderBreakpoint | undefined): StyleBucket {
  if (breakpoint === 'tablet') return 'tablet';
  if (breakpoint === 'mobile') return 'mobile';
  return 'base';
}

/** The focused tree element as a target, when the focus belongs to the selected node. */
export function focusedTreeTarget(
  kernel: BuilderKernel,
): Extract<ElementTarget, { kind: 'tree' }> | undefined {
  const state = kernel.context.store.getState();
  const focus = state.elementFocus;
  if (focus === null || focus.id !== state.selection[0]) return undefined;
  if (customCodeElementAt(kernel, focus.id, focus.path) === undefined) return undefined;
  return { kind: 'tree', nodeId: focus.id, path: [...focus.path] };
}
