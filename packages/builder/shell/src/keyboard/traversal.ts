import type { BuilderDocument, ContentDirection, NodeId } from '@craftkit/builder-schema';

/**
 * Pure keyboard-traversal model (005 contract §6). Document order at one
 * nesting level = the parent's slots in SCHEMA declaration order (falling back
 * to stored order for unknown types), each slot's children in array order.
 * Cold path — computed per keystroke from the current document.
 */
export type TraversalAction = 'next' | 'previous' | 'in' | 'out' | 'clear';

/** Arrow keys mirror horizontally under RTL content (FR-009/FR-011). */
export function resolveTraversalAction(
  key: string,
  dir: ContentDirection,
): TraversalAction | undefined {
  switch (key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'previous';
    case 'ArrowRight':
      return dir === 'rtl' ? 'out' : 'in';
    case 'ArrowLeft':
      return dir === 'rtl' ? 'in' : 'out';
    case 'Escape':
      return 'clear';
    default:
      return undefined;
  }
}

/** Slot declaration order comes from the block schema; stored order is the fallback. */
export type SlotOrderLookup = (type: string) => readonly string[] | undefined;

export function orderedChildren(
  document: BuilderDocument,
  slotOrder: SlotOrderLookup,
  id: NodeId,
): NodeId[] {
  const node = document.nodes[id];
  if (node?.slots === undefined) {
    return [];
  }
  const stored = node.slots;
  const declared = slotOrder(node.type);
  const names =
    declared === undefined
      ? Object.keys(stored)
      : [
          ...declared.filter((name) => name in stored),
          ...Object.keys(stored).filter((name) => !declared.includes(name)),
        ];
  return names.flatMap((name) => stored[name] ?? []);
}

export function parentOf(document: BuilderDocument, id: NodeId): NodeId | undefined {
  for (const [candidateId, node] of Object.entries(document.nodes)) {
    for (const children of Object.values(node.slots ?? {})) {
      if (children.includes(id)) {
        return candidateId;
      }
    }
  }
  return undefined;
}

/**
 * Apply one traversal action to the current selection; returns the new
 * selection (undefined = clear). With no selection, any movement key enters at
 * the root's first child (falling back to the root itself).
 */
export function traverse(
  document: BuilderDocument,
  slotOrder: SlotOrderLookup,
  selected: NodeId | undefined,
  action: TraversalAction,
): NodeId | undefined {
  if (action === 'clear') {
    return undefined;
  }
  if (selected === undefined || document.nodes[selected] === undefined) {
    const entry = orderedChildren(document, slotOrder, document.rootId)[0];
    return entry ?? document.rootId;
  }
  switch (action) {
    case 'next':
    case 'previous': {
      const parent = parentOf(document, selected);
      if (parent === undefined) {
        return selected; // the root has no siblings
      }
      const siblings = orderedChildren(document, slotOrder, parent);
      const at = siblings.indexOf(selected);
      const to = action === 'next' ? at + 1 : at - 1;
      return siblings[to] ?? selected; // no wrap
    }
    case 'in': {
      const first = orderedChildren(document, slotOrder, selected)[0];
      return first ?? selected;
    }
    case 'out':
      return parentOf(document, selected) ?? selected; // root stops
  }
}
