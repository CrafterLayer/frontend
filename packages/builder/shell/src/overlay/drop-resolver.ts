import type { BuilderDocument, NodeId, RegistryRead, SlotName } from '@craftkit/builder-schema';

import type { RectIndex } from '../rects';

export type DragPayload = { kind: 'move'; id: NodeId } | { kind: 'insert'; type: string };

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
  const intoTargetOf = (id: NodeId): DropTarget | null => {
    const rect = index.rect(id);
    if (rect === undefined) {
      return null;
    }
    for (const slot of slotNamesOf(doc, registry, id)) {
      if (slotAccepts(doc, registry, id, slot, payload)) {
        const end = doc.nodes[id]?.slots?.[slot]?.length ?? 0;
        return {
          parentId: id,
          slot,
          index: postRemovalIndex(doc, payload, id, slot, end),
          indicatorRect: intoIndicator(rect),
        };
      }
    }
    return null;
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
    const edge: 'before' | 'after' = y < rect.y + rect.height / 2 ? 'before' : 'after';
    const rawIndex = edge === 'before' ? seat.index : seat.index + 1;
    return {
      parentId: seat.parentId,
      slot: seat.slot,
      index: postRemovalIndex(doc, payload, seat.parentId, seat.slot, rawIndex),
      indicatorRect: gapIndicator(rect, edge),
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
      const bandTop = rect.y + rect.height * 0.25;
      const bandBottom = rect.y + rect.height * 0.75;
      const preferInto = y >= bandTop && y < bandBottom;
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
