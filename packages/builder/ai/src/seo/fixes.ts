import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';

import type { AgentToolStep } from '../tools/agent/types';
import { isRecord, nodeAt, regionOrder, type JsonRecord } from './scan';

/**
 * A fix as DATA, before it becomes plan steps.
 *
 * An issue's fix and the auto-fix plan are the same edits read two ways: one
 * issue alone becomes its own setProp, and every safe edit together becomes ONE
 * setProp per region, applied in order over one copy of the tree — the same
 * earlier-steps rule `tree-edits.ts` follows, so two fixes in one region
 * compose instead of the later one undoing the earlier.
 *
 * Tree edits never change a tree's SHAPE (attributes, a tag or a text only),
 * so every path read before the first edit still addresses the same element
 * after the last.
 */
export type SeoEdit =
  | {
      readonly kind: 'tree';
      readonly nodeId: NodeId;
      readonly path: readonly number[];
      /** Attributes to set on the element (merged over its existing ones). */
      readonly attributes?: Readonly<Record<string, string>>;
      readonly tag?: string;
      readonly text?: string;
      /** Marks the fetchpriority edit, the one a door without P5 would refuse. */
      readonly fetchpriority?: true;
    }
  | { readonly kind: 'prop'; readonly nodeId: NodeId; readonly key: string; readonly value: unknown }
  | { readonly kind: 'meta'; readonly dir: 'rtl' | 'ltr' };

function applyTreeEdit(tree: JsonRecord, edit: Extract<SeoEdit, { kind: 'tree' }>): void {
  const node = nodeAt(tree, edit.path);
  if (node === undefined) return;
  if (edit.tag !== undefined) node['tag'] = edit.tag;
  if (edit.text !== undefined) node['text'] = edit.text;
  if (edit.attributes !== undefined) {
    const current = isRecord(node['attributes']) ? node['attributes'] : {};
    node['attributes'] = { ...current, ...edit.attributes };
  }
}

/**
 * Edits as the fewest ordinary steps: root props first (one setProp per key,
 * the last value winning), then one whole-tree setProp per region, then a
 * direction change. `trees` overrides the document's trees, for a caller whose
 * plan has already changed a region.
 */
export function editsToSteps(
  document: BuilderDocument,
  edits: readonly SeoEdit[],
  trees?: ReadonlyMap<NodeId, unknown>,
): AgentToolStep[] {
  const props = new Map<string, { nodeId: NodeId; key: string; value: unknown }>();
  const regions = new Map<NodeId, JsonRecord>();
  let dir: 'rtl' | 'ltr' | undefined;
  for (const edit of edits) {
    if (edit.kind === 'prop') {
      props.set(`${edit.nodeId}\u0000${edit.key}`, { nodeId: edit.nodeId, key: edit.key, value: edit.value });
      continue;
    }
    if (edit.kind === 'meta') {
      dir = edit.dir;
      continue;
    }
    let tree = regions.get(edit.nodeId);
    if (tree === undefined) {
      const source = trees?.has(edit.nodeId) === true
        ? trees.get(edit.nodeId)
        : document.nodes[edit.nodeId]?.props['tree'];
      if (!isRecord(source)) continue;
      tree = structuredClone(source);
      regions.set(edit.nodeId, tree);
    }
    applyTreeEdit(tree, edit);
  }
  const steps: AgentToolStep[] = [];
  for (const { nodeId, key, value } of props.values()) {
    steps.push({ command: 'setProp', args: { id: nodeId, key, value } });
  }
  /* Page order, whatever order the checks found the fixes in. */
  const order = regionOrder(document);
  const sorted = [...regions].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  for (const [nodeId, tree] of sorted) {
    steps.push({ command: 'setProp', args: { id: nodeId, key: 'tree', value: tree } });
  }
  if (dir !== undefined) steps.push({ command: 'setDocMeta', args: { dir } });
  return steps;
}
