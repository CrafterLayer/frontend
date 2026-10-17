import type { BuilderKernel } from '@craftkit/builder-core';
import {
  applySymbolOverrides,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  type CustomCodeNode,
  type CustomCodeRoot,
  type NodeId,
  type SymbolOverride,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot, customCodeTreeKey } from '../../custom-code/element-at';
import type { TreeWriteOptions } from '../../style-manager/tree-writes';

function rootOf(kernel: BuilderKernel, nodeId: NodeId, options: TreeWriteOptions): CustomCodeRoot | undefined {
  const host = kernel.getDocument().nodes[nodeId];
  if (host === undefined) return undefined;
  if (host.type === SYMBOL_INSTANCE_BLOCK_TYPE) {
    const symbolId = host.props['symbolId'];
    const master = typeof symbolId === 'string' ? options.symbolTree?.(symbolId) : undefined;
    const overrides = host.props['overrides'];
    return master === undefined
      ? undefined
      : applySymbolOverrides(master, Array.isArray(overrides) ? (overrides as unknown as SymbolOverride[]) : []);
  }
  const key = customCodeTreeKey(kernel, host.type);
  return key === undefined ? undefined : asCustomCodeRoot(host.props[key]);
}

/** Every `id` attribute in a region's tree, in document order (the click-target choices). */
export function treeIdsOf(kernel: BuilderKernel, nodeId: NodeId, options: TreeWriteOptions): string[] {
  const root = rootOf(kernel, nodeId, options);
  const ids: string[] = [];
  const walk = (nodes: readonly CustomCodeNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.kind === 'icon') continue;
      if (node.kind === 'element') {
        const id = (node.attributes as Readonly<Record<string, string | undefined>> | undefined)?.['id'];
        if (id !== undefined && id !== '') ids.push(id);
      }
      walk(node.children);
    }
  };
  walk(root?.children);
  return ids;
}
