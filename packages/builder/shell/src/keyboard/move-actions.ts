import type { BuilderKernel } from '@craftkit/builder-core';
import type { ContentDirection, NodeId } from '@craftkit/builder-schema';

import { seatOf, slotAccepts } from '../overlay/drop-resolver';
import { parentOf } from './traversal';

export type MoveAction = 'up' | 'down' | 'out' | 'in';

/** Alt+Arrows; the horizontal pair mirrors under RTL content (same rule as traversal). */
export function resolveMoveAction(
  key: string,
  altKey: boolean,
  dir: ContentDirection,
): MoveAction | undefined {
  if (!altKey) {
    return undefined;
  }
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowRight':
      return dir === 'rtl' ? 'out' : 'in';
    case 'ArrowLeft':
      return dir === 'rtl' ? 'in' : 'out';
    default:
      return undefined;
  }
}

const labelOf = (kernel: BuilderKernel, id: NodeId): string => {
  const type = kernel.getDocument().nodes[id]?.type;
  if (type === undefined) {
    return id;
  }
  return kernel.context.registry.block(type)?.schema.description ?? type;
};

/**
 * One keyboard arrangement step (006 contract §3 k1–k3): the SAME rule gate as
 * drops, at most ONE moveNode, selection stays on the node, every outcome is
 * announced. Returns the announcement.
 */
export function performMoveAction(
  kernel: BuilderKernel,
  selected: NodeId,
  action: MoveAction,
): string {
  const doc = kernel.getDocument();
  const registry = kernel.context.registry;
  const seat = seatOf(doc, selected);
  if (seat === undefined) {
    return 'Cannot move the document root';
  }
  const payload = { kind: 'move', id: selected } as const;

  const dispatchMove = (toParentId: NodeId, toSlot: string, toIndex: number): void => {
    kernel.dispatch('moveNode', { id: selected, toParentId, toSlot, toIndex });
    kernel.setSelection([selected]);
  };

  switch (action) {
    case 'up':
    case 'down': {
      const siblings = doc.nodes[seat.parentId]?.slots?.[seat.slot] ?? [];
      const toIndex = action === 'up' ? seat.index - 1 : seat.index + 1;
      if (toIndex < 0) {
        return 'Already first'; // silent clamp — no transaction (k1)
      }
      if (toIndex > siblings.length - 1) {
        return 'Already last';
      }
      dispatchMove(seat.parentId, seat.slot, toIndex);
      return `Moved ${labelOf(kernel, selected)} ${action === 'up' ? 'earlier' : 'later'}`;
    }
    case 'out': {
      const grandSeat = seatOf(doc, seat.parentId);
      if (grandSeat === undefined) {
        return 'Already at the top level';
      }
      if (!slotAccepts(doc, registry, grandSeat.parentId, grandSeat.slot, payload)) {
        return `Cannot move out: slot "${grandSeat.slot}" does not accept ${labelOf(kernel, selected)}`;
      }
      // Become the parent's NEXT sibling (k2).
      dispatchMove(grandSeat.parentId, grandSeat.slot, grandSeat.index + 1);
      return `Moved ${labelOf(kernel, selected)} out, after ${labelOf(kernel, seat.parentId)}`;
    }
    case 'in': {
      // Append into the nearest PRECEDING sibling's first accepting slot (k2).
      const siblings = doc.nodes[seat.parentId]?.slots?.[seat.slot] ?? [];
      for (let at = seat.index - 1; at >= 0; at -= 1) {
        const candidate = siblings[at];
        if (candidate === undefined) {
          continue;
        }
        const candidateType = doc.nodes[candidate]?.type ?? '';
        for (const slot of Object.keys(registry.block(candidateType)?.schema.slots ?? {})) {
          if (slotAccepts(doc, registry, candidate, slot, payload)) {
            const end = doc.nodes[candidate]?.slots?.[slot]?.length ?? 0;
            dispatchMove(candidate, slot, end);
            return `Moved ${labelOf(kernel, selected)} into ${labelOf(kernel, candidate)}`;
          }
        }
      }
      return `No earlier sibling accepts ${labelOf(kernel, selected)}`;
    }
  }
}

/** Re-exported for wiring convenience: the parent lookup used by traversal. */
export { parentOf };
