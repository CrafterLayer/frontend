import type { BuilderKernel } from '@craftkit/builder-core';
import {
  bindPatternOf,
  blockPartsOf,
  partInstances,
  type BlockPartDecl,
  type BlockParts,
  type NodeId,
  type PartInstance,
  type PartRef,
} from '@craftkit/builder-schema';

import type { ElementNameWords } from '../custom-code/element-target';
import { blockDisplayName } from '../naming/block-display-name';

/*
  ── Part targets (block-parts DESIGN §2.6) ────────────────────────────────────

  A PART is a named inner element of a registered block — the hero's badge, its
  heading, the third feature card's title — addressed by (nodeId, part, index).
  This file is the canvas side's vocabulary for it: one target shape, plus the
  small readers every surface needs (the declaration, the instances in
  document order, the localized name). Pure apart from the kernel reads.
*/

/** One part instance on the canvas, as a target for chrome and actions. */
export interface PartTarget extends PartRef {
  readonly kind: 'part';
  readonly nodeId: NodeId;
}

/** The ephemeral focus shape the kernel keeps (`KernelState.partFocus`). */
interface PartFocusLike extends PartRef {
  readonly id: NodeId;
}

/** Structural on purpose: any kernel state that carries a selection and a part focus. */
interface PartFocusState {
  readonly selection: readonly NodeId[];
  readonly partFocus?: PartFocusLike | null | undefined;
}

export function partTarget(nodeId: NodeId, ref: PartRef): PartTarget {
  return { kind: 'part', nodeId, part: ref.part, index: [...ref.index] };
}

/** The bare reference of a target (what the planners and the kernel take). */
export function partRefOf(target: PartRef): PartRef {
  return { part: target.part, index: [...target.index] };
}

/** `heading`, `item.title@2`, `cell@1.3`: a stable key for one instance. */
export function partInstanceKey(ref: PartRef): string {
  return ref.index.length === 0 ? ref.part : `${ref.part}@${ref.index.join('.')}`;
}

export function samePartRef(
  left: PartRef | null | undefined,
  right: PartRef | null | undefined,
): boolean {
  if (left === right) return true;
  if (left === null || left === undefined || right === null || right === undefined) return false;
  return (
    left.part === right.part &&
    left.index.length === right.index.length &&
    left.index.every((value, at) => right.index[at] === value)
  );
}

/**
 * `data-ck-part-index` → the index list. Absent or empty is the unrepeated
 * part (`[]`); anything that is not dot-separated digits is refused, so a
 * stray attribute can never become an address.
 */
export function parsePartIndex(text: string | null | undefined): readonly number[] | undefined {
  if (text === null || text === undefined || text === '') return [];
  if (!/^\d+(?:\.\d+)*$/u.test(text)) return undefined;
  return text.split('.').map(Number);
}

/** The focused part as a target — only while it belongs to the selected node. */
export function partTargetFromFocus(state: PartFocusState): PartTarget | undefined {
  const focus = state.partFocus;
  if (focus === null || focus === undefined || focus.id !== state.selection[0]) return undefined;
  return partTarget(focus.id, focus);
}

/** The part declarations of a node's block (`{}` when it declares none or is gone). */
export function partsOfNode(kernel: BuilderKernel, nodeId: NodeId): BlockParts {
  const node = kernel.getDocument().nodes[nodeId];
  if (node === undefined) return {};
  return blockPartsOf(kernel.context.registry.block(node.type)?.schema);
}

export function partDeclOf(
  kernel: BuilderKernel,
  nodeId: NodeId,
  part: string,
): BlockPartDecl | undefined {
  return partsOfNode(kernel, nodeId)[part];
}

/** Every live part instance of the node, in document (declaration × index) order. */
export function partInstancesOf(kernel: BuilderKernel, nodeId: NodeId): readonly PartInstance[] {
  const node = kernel.getDocument().nodes[nodeId];
  if (node === undefined) return [];
  const parts = partsOfNode(kernel, nodeId);
  if (Object.keys(parts).length === 0) return [];
  return partInstances(parts, node.props);
}

/** True when the instance still exists in the document (an undo can remove it). */
export function isLivePart(kernel: BuilderKernel, nodeId: NodeId, ref: PartRef): boolean {
  return partInstancesOf(kernel, nodeId).some((instance) => samePartRef(instance, ref));
}

/**
 * The next (`+1`) or previous (`-1`) part instance after `ref` in document
 * order — Tab traversal. `undefined` at either end, so Tab leaves the canvas
 * there instead of trapping the keyboard.
 */
export function steppedPart(
  kernel: BuilderKernel,
  nodeId: NodeId,
  ref: PartRef,
  step: 1 | -1,
): PartRef | undefined {
  const instances = partInstancesOf(kernel, nodeId);
  const at = instances.findIndex((instance) => samePartRef(instance, ref));
  const next = at < 0 ? undefined : instances[at + step];
  return next === undefined ? undefined : partRefOf(next);
}

/** The first part instance of a node (entering a block from the keyboard). */
export function firstPart(kernel: BuilderKernel, nodeId: NodeId): PartRef | undefined {
  const first = partInstancesOf(kernel, nodeId)[0];
  return first === undefined ? undefined : partRefOf(first);
}

function starCount(pattern: string): number {
  return pattern.split('.').filter((segment) => segment === '*').length;
}

/**
 * The ITEM a part lives in: the item part itself, or — for a part inside a
 * repeated card (`item.title` bound to `items.*.title`) — the item whose bind
 * is a prefix of it, at the matching index depth. This is what lets "Remove
 * item" work from the card's title as well as from the card.
 */
export function enclosingItemRef(parts: BlockParts, ref: PartRef): PartRef | undefined {
  const decl = parts[ref.part];
  if (decl === undefined) return undefined;
  if (decl.kind === 'item') return partRefOf(ref);
  const pattern = bindPatternOf(decl);
  if (pattern === undefined || ref.index.length === 0) return undefined;
  let best: { name: string; depth: number } | undefined;
  for (const [name, candidate] of Object.entries(parts)) {
    if (candidate.kind !== 'item') continue;
    const itemPattern = bindPatternOf(candidate);
    if (itemPattern === undefined || !pattern.startsWith(`${itemPattern}.`)) continue;
    const depth = starCount(itemPattern);
    if (depth === 0 || depth > ref.index.length) continue;
    // The innermost item wins when lists nest.
    if (best === undefined || depth > best.depth) best = { name, depth };
  }
  return best === undefined ? undefined : { part: best.name, index: ref.index.slice(0, best.depth) };
}

/** The part's own name in the editor's language. */
export function partLabel(decl: BlockPartDecl | undefined, part: string, locale: 'en' | 'ar'): string {
  if (decl === undefined) return part;
  return decl.label[locale] === '' ? decl.label.en : decl.label[locale];
}

/**
 * The localized name of one instance: "Heading", or "Title 3" for a repeated
 * part (people count from one).
 */
export function partInstanceName(
  kernel: BuilderKernel,
  nodeId: NodeId,
  ref: PartRef,
  locale: 'en' | 'ar',
): string {
  const base = partLabel(partDeclOf(kernel, nodeId, ref.part), ref.part, locale);
  const position = ref.index[ref.index.length - 1];
  return position === undefined ? base : `${base} ${String(position + 1)}`;
}

/** The hover/selection chip: "Heading · Hero" (localized part label, block display name). */
export function partChipLabel(
  kernel: BuilderKernel,
  nodeId: NodeId,
  ref: PartRef,
  locale: 'en' | 'ar',
  words?: ElementNameWords,
): string {
  return `${partInstanceName(kernel, nodeId, ref, locale)} · ${blockDisplayName(kernel, nodeId, words)}`;
}

/**
 * The first part instance INSIDE this one — a list's first item, an item's
 * first part — by bind containment. `undefined` for a leaf (or a box).
 */
export function firstPartInside(kernel: BuilderKernel, nodeId: NodeId, ref: PartRef): PartRef | undefined {
  const instances = partInstancesOf(kernel, nodeId);
  const self = instances.find((instance) => samePartRef(instance, ref));
  if (self?.bind === undefined) return undefined;
  const prefix = `${self.bind}.`;
  const inside = instances.find((instance) => instance.bind?.startsWith(prefix) === true);
  return inside === undefined ? undefined : partRefOf(inside);
}
