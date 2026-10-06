import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  applySymbolOverrides,
  patchNodeAt,
  setNodeAt,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  treeNodeAt,
  type Author,
  type CustomCodeNode,
  type CustomCodeRoot,
  type JsonValue,
  type NodeId,
  type SymbolOverride,
  type TreeNodePatch,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot, customCodeElementAt, customCodeTreeKey } from '../custom-code/element-at';
import type { ElementTarget } from '../custom-code/element-target';
import { tryDispatchTreeEdits } from '../custom-code/element-target';
import type { StyleApplyResult } from './style-source';

/** A target inside a custom-code tree (or a symbol instance's tree). */
export type TreeTarget = Extract<ElementTarget, { kind: 'tree' }>;

export interface TreeWriteOptions {
  /**
   * A symbol's master tree from the site library (DESIGN §G). Needed only
   * when a target lives inside a `customCodeSymbol` instance: its element is
   * read from the master with the instance's overrides applied, and writes go
   * to the instance's `overrides`, never to the master.
   */
  readonly symbolTree?: ((symbolId: string) => CustomCodeRoot | undefined) | undefined;
  readonly author?: Author | undefined;
}

export interface TreeEdit {
  readonly target: TreeTarget;
  readonly patch: TreeNodePatch;
}

/** The prop a symbol instance keeps its per-instance overrides in. */
export const SYMBOL_OVERRIDES_KEY = 'overrides';
const SYMBOL_ID_KEY = 'symbolId';

export const ELEMENT_GONE = 'That element is no longer in this region.';

function symbolOverridesOf(value: unknown): SymbolOverride[] {
  return Array.isArray(value) ? (value as SymbolOverride[]) : [];
}

/** The instance's tree as the page shows it: the master plus this instance's overrides. */
function symbolInstanceTree(
  kernel: BuilderKernel,
  nodeId: NodeId,
  options: TreeWriteOptions,
): CustomCodeRoot | undefined {
  const host = kernel.getDocument().nodes[nodeId];
  const symbolId = host?.props[SYMBOL_ID_KEY];
  if (host === undefined || typeof symbolId !== 'string') return undefined;
  const master = options.symbolTree?.(symbolId);
  return master === undefined
    ? undefined
    : applySymbolOverrides(master, symbolOverridesOf(host.props[SYMBOL_OVERRIDES_KEY]));
}

export function isSymbolInstance(kernel: BuilderKernel, nodeId: NodeId): boolean {
  return kernel.getDocument().nodes[nodeId]?.type === SYMBOL_INSTANCE_BLOCK_TYPE;
}

/** The node a target addresses, as the page renders it now; undefined when stale. */
export function readTreeTarget(
  kernel: BuilderKernel,
  target: TreeTarget,
  options: TreeWriteOptions = {},
): CustomCodeNode | undefined {
  if (isSymbolInstance(kernel, target.nodeId)) {
    const tree = symbolInstanceTree(kernel, target.nodeId, options);
    return tree === undefined ? undefined : treeNodeAt(tree, target.path);
  }
  return customCodeElementAt(kernel, target.nodeId, target.path)?.element;
}

/** The class string of a tree node (`''` for a component, which carries none). */
export function classNameOfNode(node: CustomCodeNode | undefined): string {
  if (node === undefined || node.kind === 'component') return '';
  return node.className ?? '';
}

function samePath(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => b[index] === value);
}

/** Merge one patch into an instance's override list (a new array; the input is untouched). */
export function mergeSymbolOverride(
  overrides: readonly SymbolOverride[],
  path: readonly number[],
  patch: TreeNodePatch,
): SymbolOverride[] {
  const index = overrides.findIndex((override) => samePath(override.path, path));
  const found = index === -1 ? undefined : overrides[index];
  const current: SymbolOverride = found === undefined ? { path: [...path] } : { ...found, path: [...path] };
  const next: SymbolOverride = { ...current };
  const set = patch.set ?? {};
  if (set.className !== undefined) next.className = set.className ?? '';
  if (set.text !== undefined) next.text = set.text ?? '';
  if (patch.attributes !== undefined) {
    next.attributes = { ...current.attributes, ...patch.attributes };
  }
  const list = [...overrides];
  if (found === undefined) list.push(next);
  else list[index] = next;
  return list;
}

/** A patch with no undefined members, for the strict command schema. */
function cleanPatch(patch: TreeNodePatch): { set?: Record<string, unknown>; attributes?: Record<string, string | null> } {
  const out: { set?: Record<string, unknown>; attributes?: Record<string, string | null> } = {};
  if (patch.set !== undefined) {
    const set = Object.fromEntries(Object.entries(patch.set).filter(([, value]) => value !== undefined));
    if (Object.keys(set).length > 0) out.set = set;
  }
  if (patch.attributes !== undefined && Object.keys(patch.attributes).length > 0) {
    out.attributes = { ...patch.attributes };
  }
  return out;
}

/**
 * Write element patches as ONE labelled transaction (DESIGN §A.8): one Undo
 * for the person, whatever the number of targets.
 *
 * - Ordinary regions go through the custom-code extension's `patchTreeNode`
 *   command when the host registered it (the validated door with repairable
 *   errors). A host without the extension falls back to rebuilding the tree
 *   prop with the same pure helper and one `setProp` per region.
 * - Elements inside a symbol instance write the instance's `overrides`
 *   (`setProp`), so the master — and every other instance — is untouched.
 */
export function patchTreeTargets(
  kernel: BuilderKernel,
  edits: readonly TreeEdit[],
  label: string,
  options: TreeWriteOptions = {},
): StyleApplyResult {
  const useCommand = kernel.context.registry.command('patchTreeNode') !== undefined;
  const steps: GroupStep[] = [];
  const trees = new Map<NodeId, { key: string; tree: CustomCodeRoot }>();
  const overrides = new Map<NodeId, SymbolOverride[]>();
  const document = kernel.getDocument();

  for (const { target, patch } of edits) {
    const host = document.nodes[target.nodeId];
    if (host === undefined) return { ok: false, message: ELEMENT_GONE };
    const cleaned = cleanPatch(patch);
    if (cleaned.set === undefined && cleaned.attributes === undefined) continue;

    if (host.type === SYMBOL_INSTANCE_BLOCK_TYPE) {
      const list = overrides.get(target.nodeId) ?? symbolOverridesOf(host.props[SYMBOL_OVERRIDES_KEY]);
      overrides.set(target.nodeId, mergeSymbolOverride(list, target.path, patch));
      continue;
    }
    if (useCommand) {
      steps.push({ command: 'patchTreeNode', args: { id: target.nodeId, path: [...target.path], ...cleaned } });
      continue;
    }
    const key = customCodeTreeKey(kernel, host.type);
    const tree = trees.get(target.nodeId)?.tree ?? asCustomCodeRoot(key === undefined ? undefined : host.props[key]);
    if (key === undefined || tree === undefined) return { ok: false, message: ELEMENT_GONE };
    const result = patchNodeAt(tree, target.path, patch);
    if (!result.ok) return { ok: false, message: result.message };
    trees.set(target.nodeId, { key, tree: result.tree });
  }

  for (const [id, { key, tree }] of trees) {
    steps.push({ command: 'setProp', args: { id, key, value: tree as unknown as JsonValue } });
  }
  for (const [id, list] of overrides) {
    steps.push({
      command: 'setProp',
      args: { id, key: SYMBOL_OVERRIDES_KEY, value: list as unknown as JsonValue },
    });
  }
  if (steps.length === 0) return { ok: true };
  const result = tryDispatchTreeEdits(kernel, steps, label, options.author ?? 'user');
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

export const SYMBOL_NODE_LOCKED =
  'Inside a symbol instance only text, classes and attributes can be overridden · edit the symbol master to change this.';

/**
 * Replace the node at a target with a whole new node (an icon's name or size,
 * a component's props): `setTreeNode` when the host registered it, else the
 * same pure helper and one `setProp`. One labelled transaction.
 */
export function setTreeTarget(
  kernel: BuilderKernel,
  target: TreeTarget,
  node: CustomCodeNode,
  label: string,
  options: TreeWriteOptions = {},
): StyleApplyResult {
  const host = kernel.getDocument().nodes[target.nodeId];
  if (host === undefined) return { ok: false, message: ELEMENT_GONE };
  if (host.type === SYMBOL_INSTANCE_BLOCK_TYPE) return { ok: false, message: SYMBOL_NODE_LOCKED };
  let step: GroupStep;
  if (kernel.context.registry.command('setTreeNode') !== undefined) {
    step = {
      command: 'setTreeNode',
      args: { id: target.nodeId, path: [...target.path], node: node as unknown as JsonValue },
    };
  } else {
    const key = customCodeTreeKey(kernel, host.type);
    const tree = asCustomCodeRoot(key === undefined ? undefined : host.props[key]);
    if (key === undefined || tree === undefined) return { ok: false, message: ELEMENT_GONE };
    const result = setNodeAt(tree, target.path, node);
    if (!result.ok) return { ok: false, message: result.message };
    step = { command: 'setProp', args: { id: target.nodeId, key, value: result.tree as unknown as JsonValue } };
  }
  const result = tryDispatchTreeEdits(kernel, [step], label, options.author ?? 'user');
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
