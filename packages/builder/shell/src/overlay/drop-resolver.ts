import type { BuilderDocument, NodeId, RegistryRead, SlotName } from '@craftkit/builder-schema';

import type { RectIndex } from '../rects';

export type DragPayload =
  | { kind: 'move'; id: NodeId }
  | {
      kind: 'insert';
      type: string;
      /** A library entry supplies its content; the resolver still owns the seat. */
      onDrop?: ((target: DropTarget) => void) | undefined;
    };

export interface DropTarget {
  parentId: NodeId;
  slot: SlotName;
  /** Insertion index — POST-removal terms for same-slot moves (moveNode detaches first). */
  index: number;
  /** Preview-local geometry for the insertion indicator line. */
  indicatorRect: { x: number; y: number; width: number; height: number };
}

function payloadType(doc: BuilderDocument, payload: DragPayload): string | undefined {
  return payload.kind === 'insert' ? payload.type : doc.nodes[payload.id]?.type;
}

/**
 * Hot-path parent lookup: documents are immutable between transactions (the
 * sealed store replaces the reference on every write), so one child→parent map
 * per document REFERENCE serves every pointer move for free afterwards. This is
 * what keeps the resolver's "never a tree scan per move" contract true — the
 * keyboard module's whole-document `parentOf` stays a per-keystroke cold path.
 */
const parentMaps = new WeakMap<BuilderDocument, Map<NodeId, NodeId>>();
function parentMapOf(doc: BuilderDocument): Map<NodeId, NodeId> {
  let map = parentMaps.get(doc);
  if (map === undefined) {
    map = new Map();
    for (const [parentId, node] of Object.entries(doc.nodes)) {
      for (const children of Object.values(node.slots ?? {})) {
        for (const child of children) {
          map.set(child, parentId);
        }
      }
    }
    parentMaps.set(doc, map);
  }
  return map;
}

/** The current seat of a node: parent, slot, and index within the slot array. */
export function seatOf(
  doc: BuilderDocument,
  id: NodeId,
): { parentId: NodeId; slot: SlotName; index: number } | undefined {
  const parentId = parentMapOf(doc).get(id);
  if (parentId === undefined) {
    return undefined;
  }
  for (const [slot, children] of Object.entries(doc.nodes[parentId]?.slots ?? {})) {
    const index = children.indexOf(id);
    if (index >= 0) {
      return { parentId, slot, index };
    }
  }
  return undefined;
}

function isSelfOrDescendant(doc: BuilderDocument, rootId: NodeId, candidate: NodeId): boolean {
  const parents = parentMapOf(doc);
  let current: NodeId | undefined = candidate;
  while (current !== undefined) {
    if (current === rootId) {
      return true;
    }
    current = parents.get(current);
  }
  return false;
}

/**
 * The single rule authority (contract §2 r2) — used by the resolver AND the
 * keyboard move actions, which is what makes SC-003's resolver≡door agreement
 * a construction property instead of a test hope.
 */
export function slotAccepts(
  doc: BuilderDocument,
  registry: RegistryRead,
  parentId: NodeId,
  slot: SlotName,
  payload: DragPayload,
): boolean {
  const parent = doc.nodes[parentId];
  const type = payloadType(doc, payload);
  if (parent === undefined || type === undefined) {
    return false;
  }
  if (payload.kind === 'move' && isSelfOrDescendant(doc, payload.id, parentId)) {
    return false; // a node can never become its own ancestor
  }
  const decl = registry.block(parent.type)?.schema.slots?.[slot];
  if (!decl?.allow.includes(type)) {
    return false;
  }
  if (decl.max !== undefined) {
    const occupancy = parent.slots?.[slot]?.length ?? 0;
    const ownSeat =
      payload.kind === 'move' && (parent.slots?.[slot]?.includes(payload.id) ?? false);
    // A node reordering within its own slot already holds a seat (r2).
    if (!ownSeat && occupancy >= decl.max) {
      return false;
    }
  }
  return true;
}

/** Schema-declared slot names in declaration order (stored order as fallback). */
function slotNamesOf(doc: BuilderDocument, registry: RegistryRead, id: NodeId): SlotName[] {
  const node = doc.nodes[id];
  if (node === undefined) {
    return [];
  }
  const declared = registry.block(node.type)?.schema.slots;
  if (declared !== undefined) {
    return Object.keys(declared);
  }
  return Object.keys(node.slots ?? {});
}

/** Same-slot forward moves land one earlier once the node's own seat is vacated (r4). */
function postRemovalIndex(
  doc: BuilderDocument,
  payload: DragPayload,
  parentId: NodeId,
  slot: SlotName,
  rawIndex: number,
): number {
  if (payload.kind !== 'move') {
    return rawIndex;
  }
  const seat = seatOf(doc, payload.id);
  if (seat?.parentId === parentId && seat.slot === slot && seat.index < rawIndex) {
    return rawIndex - 1;
  }
  return rawIndex;
}

const INDICATOR_THICKNESS = 2;

function gapIndicator(
  rect: { x: number; y: number; width: number; height: number },
  edge: 'before' | 'after',
): DropTarget['indicatorRect'] {
  return {
    x: rect.x,
    y:
      edge === 'before'
        ? rect.y - INDICATOR_THICKNESS / 2
        : rect.y + rect.height - INDICATOR_THICKNESS / 2,
    width: rect.width,
    height: INDICATOR_THICKNESS,
  };
}

function intoIndicator(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): DropTarget['indicatorRect'] {
  const inset = Math.min(8, rect.width / 8);
  return {
    x: rect.x + inset,
    y: rect.y + rect.height - INDICATOR_THICKNESS - 4,
    width: Math.max(rect.width - inset * 2, INDICATOR_THICKNESS),
    height: INDICATOR_THICKNESS,
  };
}

function containsPoint(
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

/**
 * Pure drop resolution (contract §2 r1, three-band rule): bounded to one
 * hit-test plus one parent-chain walk per pointer move — never a tree scan.
 * A non-null result is rule-valid by construction.
 */
export function resolveDropTarget(
  doc: BuilderDocument,
  registry: RegistryRead,
  index: RectIndex,
  payload: DragPayload,
  x: number,
  y: number,
): DropTarget | null {
  const layoutOfSlot = (id: NodeId, slot: SlotName) => {
    const owner = index.element(id);
    const slotElement = Array.from(
      owner?.querySelectorAll<HTMLElement>('[data-bldr-slot]') ?? [],
    ).find(
      (element) =>
        element.getAttribute('data-bldr-slot-of') === id &&
        element.getAttribute('data-bldr-slot') === slot,
    );
    const layoutElement = slotElement?.parentElement;
    const style = layoutElement?.ownerDocument.defaultView?.getComputedStyle(layoutElement);
    const inline =
      style?.display.includes('flex') === true && style.flexDirection.startsWith('row');
    const reverse = inline
      ? (style.direction === 'rtl') !== (style.flexDirection === 'row-reverse')
      : style?.flexDirection === 'column-reverse';
    return { inline, reverse };
  };
  // Container padding and gaps are real insertion positions, not an instruction
  // to append. Compare only the receiving slot's children (never the whole tree).
  const slotTarget = (
    id: NodeId,
    slot: SlotName,
    containerRect: DropTarget['indicatorRect'],
  ): DropTarget => {
    const children = doc.nodes[id]?.slots?.[slot] ?? [];
    let nearest: { at: number; rect: DropTarget['indicatorRect']; distance: number } | undefined;
    children.forEach((child, at) => {
      if (payload.kind === 'move' && child === payload.id) return;
      const rect = index.rect(child);
      if (rect === undefined || rect.width <= 0 || rect.height <= 0) return;
      const dx = x - Math.max(rect.x, Math.min(x, rect.x + rect.width));
      const dy = y - Math.max(rect.y, Math.min(y, rect.y + rect.height));
      const distance = Math.hypot(dx, dy);
      if (nearest === undefined || distance < nearest.distance) nearest = { at, rect, distance };
    });
    if (nearest === undefined) {
      return {
        parentId: id,
        slot,
        index: postRemovalIndex(doc, payload, id, slot, children.length),
        indicatorRect: intoIndicator(containerRect),
      };
    }
    const { inline, reverse } = layoutOfSlot(id, slot);
    const rect = nearest.rect;
    const leading = inline ? x < rect.x + rect.width / 2 : y < rect.y + rect.height / 2;
    const before = reverse ? !leading : leading;
    return {
      parentId: id,
      slot,
      index: postRemovalIndex(doc, payload, id, slot, nearest.at + (before ? 0 : 1)),
      indicatorRect: inline
        ? {
            x: (before !== reverse ? rect.x : rect.x + rect.width) - 1,
            y: rect.y,
            width: 2,
            height: rect.height,
          }
        : gapIndicator(rect, before !== reverse ? 'before' : 'after'),
    };
  };
  const intoTargetOf = (id: NodeId): DropTarget | null => {
    const nodeRect = index.rect(id);
    if (nodeRect === undefined) {
      return null;
    }
    let firstAcceptingSlot: SlotName | undefined;
    for (const slot of slotNamesOf(doc, registry, id)) {
      if (!slotAccepts(doc, registry, id, slot, payload)) {
        continue;
      }
      firstAcceptingSlot ??= slot;
      const slotRect = index.slotRect?.(id, slot);
      if (slotRect !== undefined && containsPoint(slotRect, x, y)) {
        return slotTarget(id, slot, slotRect);
      }
    }
    if (firstAcceptingSlot === undefined) {
      return null;
    }
    return slotTarget(id, firstAcceptingSlot, nodeRect);
  };

  const gapTargetOf = (id: NodeId): DropTarget | null => {
    const seat = seatOf(doc, id);
    const rect = index.rect(id);
    if (seat === undefined || rect === undefined) {
      return null;
    }
    if (!slotAccepts(doc, registry, seat.parentId, seat.slot, payload)) {
      return null;
    }
    const { inline, reverse } = layoutOfSlot(seat.parentId, seat.slot);
    const leading = inline ? x < rect.x + rect.width / 2 : y < rect.y + rect.height / 2;
    const before = reverse ? !leading : leading;
    const rawIndex = before ? seat.index : seat.index + 1;
    return {
      parentId: seat.parentId,
      slot: seat.slot,
      index: postRemovalIndex(doc, payload, seat.parentId, seat.slot, rawIndex),
      indicatorRect: inline
        ? {
            x: (leading ? rect.x : rect.x + rect.width) - 1,
            y: rect.y,
            width: 2,
            height: rect.height,
          }
        : gapIndicator(rect, leading ? 'before' : 'after'),
    };
  };

  let current: NodeId | undefined = index.nodeAt(x, y);
  if (current === undefined) {
    return intoTargetOf(doc.rootId); // empty-canvas hover targets the root
  }
  while (current !== undefined) {
    const rect = index.rect(current);
    if (rect !== undefined) {
      // Three-band rule: the middle band prefers INTO (an empty container is
      // otherwise untargetable); the outer quarters prefer the sibling gap.
      const seat = seatOf(doc, current);
      const inline = seat !== undefined && layoutOfSlot(seat.parentId, seat.slot).inline;
      const start = inline ? rect.x : rect.y;
      const size = inline ? rect.width : rect.height;
      const point = inline ? x : y;
      const preferInto = point >= start + size * 0.25 && point < start + size * 0.75;
      const first = preferInto ? intoTargetOf(current) : gapTargetOf(current);
      const second = preferInto ? gapTargetOf(current) : intoTargetOf(current);
      const resolved = first ?? second;
      if (resolved !== null) {
        return resolved;
      }
    }
    current = parentMapOf(doc).get(current);
  }
  return null;
}
