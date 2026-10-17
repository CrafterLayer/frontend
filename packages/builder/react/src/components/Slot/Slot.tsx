import type { ReactNode } from 'react';

import type { Node, NodeId, SlotName } from '@craftkit/builder-schema';

const EMPTY: readonly NodeId[] = Object.freeze([]);

export interface SlotProps {
  /** The parent node whose slot is being rendered. */
  node: Node;
  /** Declared slot name (e.g. "default", "actions"). */
  name: SlotName;
  /** Render-prop over the ordered child ids — document order is the order. */
  children: (childIds: readonly NodeId[]) => ReactNode;
}

/**
 * Read one named slot's ordered membership (FR-005). The render-prop keeps this
 * component renderer-agnostic: hosts decide how child ids become views.
 */
export function Slot({ node, name, children }: SlotProps) {
  return <>{children(node.slots?.[name] ?? EMPTY)}</>;
}
