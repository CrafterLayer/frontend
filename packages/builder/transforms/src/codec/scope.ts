import type { BuilderDocument, Node, NodeId } from '@craftkit/builder-schema';

export const SCOPED_ENVELOPE_VERSION = 1 as const;

export interface ScopedProjection {
  envelope: typeof SCOPED_ENVELOPE_VERSION;
  rootId: NodeId;
  nodes: Record<NodeId, Node>;
}

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const emptyNodeMap = (): Record<NodeId, Node> => {
  const nodes: Record<NodeId, Node> = {};
  Object.setPrototypeOf(nodes, null);
  return nodes;
};

const defineNode = (nodes: Record<NodeId, Node>, id: NodeId, node: Node): void => {
  Object.defineProperty(nodes, id, {
    configurable: true,
    enumerable: true,
    value: node,
    writable: true,
  });
};

/** The selected node and every slot descendant, retaining the storage model's flat shape. */
export function scopedProjection(doc: BuilderDocument, rootId: NodeId): ScopedProjection {
  const nodes = emptyNodeMap();
  const visited = new Set<NodeId>();
  const pending: NodeId[] = [rootId];

  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || visited.has(id)) {
      continue;
    }
    visited.add(id);

    const node = hasOwn(doc.nodes, id) ? doc.nodes[id] : undefined;
    if (node === undefined) {
      // The parent still carries the missing id in its slot array, so invalid
      // content remains explicit in the projection instead of disappearing.
      continue;
    }
    defineNode(nodes, id, node);

    for (const children of Object.values(node.slots ?? {})) {
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const childId = children[index];
        if (childId !== undefined) {
          pending.push(childId);
        }
      }
    }
  }

  return { envelope: SCOPED_ENVELOPE_VERSION, rootId, nodes };
}
