import type { BuilderKernel } from '@craftkit/builder-core';
import {
  customCodeNodeAtPath,
  isCustomCodeTreeSchema,
  type CustomCodeNode,
  type CustomCodePath,
  type CustomCodeRoot,
  type NodeId,
} from '@craftkit/builder-schema';

import { propsShapeOf } from '../fields/resolve-field';

/**
 * Which prop of a block holds its composition tree — found by the schema's
 * own DECLARATION (`customCodeTree()` marks it), never by a property name.
 * Matching `key === 'tree'` would capture any block that happened to name a
 * prop `tree` and miss one that called it `layout`; the marker is the same
 * mechanism the Inspector's field types already match on.
 */
export function customCodeTreeKey(kernel: BuilderKernel, type: string): string | undefined {
  const schema = kernel.context.registry.block(type)?.schema;
  if (schema === undefined) {
    return undefined;
  }
  for (const [key, propSchema] of Object.entries(propsShapeOf(schema.props))) {
    if (isCustomCodeTreeSchema(propSchema)) {
      return key;
    }
  }
  return undefined;
}

/** A stored tree, when the value has the root shape; a tolerant read like the renderer's. */
export function asCustomCodeRoot(value: unknown): CustomCodeRoot | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as { kind?: unknown; children?: unknown };
  return record.kind === 'root' && Array.isArray(record.children)
    ? (value as CustomCodeRoot)
    : undefined;
}

export interface CustomCodeElementLocation {
  /** The prop the tree lives in on this node. */
  readonly treeKey: string;
  readonly tree: CustomCodeRoot;
  readonly element: CustomCodeNode;
}

/**
 * Resolve an element focus against document truth: the node must exist, its
 * block must declare a tree prop, the stored value must be a tree, and the
 * path must land on a node. Any failure is `undefined` — a focus can go stale
 * (undo removed the element) and every reader must degrade to the region.
 */
export function customCodeElementAt(
  kernel: BuilderKernel,
  id: NodeId,
  path: CustomCodePath,
): CustomCodeElementLocation | undefined {
  const node = kernel.getDocument().nodes[id];
  if (node === undefined) {
    return undefined;
  }
  const treeKey = customCodeTreeKey(kernel, node.type);
  if (treeKey === undefined) {
    return undefined;
  }
  const tree = asCustomCodeRoot(node.props[treeKey]);
  if (tree === undefined) {
    return undefined;
  }
  const element = customCodeNodeAtPath(tree, path);
  return element === undefined ? undefined : { treeKey, tree, element };
}
