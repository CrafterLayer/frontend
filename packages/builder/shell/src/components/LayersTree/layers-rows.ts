import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  adjustAfterRemoval,
  type BuilderDocument,
  type CustomCodeNode,
  type CustomCodePath,
  type CustomCodeRoot,
  type NodeId,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot, customCodeTreeKey } from '../../custom-code/element-at';
import { elementTargetKey, type ElementTarget } from '../../custom-code/element-target';
import { orderedChildren, type SlotOrderLookup } from '../../keyboard/traversal';
import { seatOf, slotAccepts } from '../../overlay/drop-resolver';

/*
  The Layers model, kept pure so the projection math is testable without a
  DOM: one flat, visible, document-ordered row list where a custom-code
  region's ELEMENT TREE continues below the region's own row (style-manager
  DESIGN.md §E), plus the drag projection (where a dragged row would land:
  which parent, which index, which level) and the one command that commits it.
*/

interface RowBase {
  /** `block:<id>` or `tree:<id>:<path>` — `elementTargetKey`. */
  readonly key: string;
  readonly depth: number;
  readonly expandable: boolean;
  /** 1-based position among LOGICAL siblings + set size (flat DOM → explicit ARIA). */
  readonly posInSet: number;
  readonly setSize: number;
  /** The row key of the logical parent; undefined for the root. */
  readonly parentKey: string | undefined;
}

export interface BlockRow extends RowBase {
  readonly kind: 'block';
  readonly id: NodeId;
  /** Present when the block declares an element tree (a custom-code region). */
  readonly treeKey: string | undefined;
}

export interface ElementRow extends RowBase {
  readonly kind: 'element';
  readonly nodeId: NodeId;
  readonly path: CustomCodePath;
  readonly node: CustomCodeNode;
}

export type LayerRow = BlockRow | ElementRow;

export function rowTarget(row: LayerRow): ElementTarget {
  return row.kind === 'block' ? { kind: 'block', nodeId: row.id } : { kind: 'tree', nodeId: row.nodeId, path: row.path };
}

export const blockRowKey = (id: NodeId): string => elementTargetKey({ kind: 'block', nodeId: id });

/** Tags that never hold children (the HTML void elements the vocabulary admits). */
const VOID_TAGS = new Set(['img', 'hr', 'br', 'input', 'source', 'track', 'wbr', 'area', 'col', 'embed', 'iframe']);

/** Whether a row can take a dropped child. */
export function rowAcceptsChildren(row: LayerRow): boolean {
  if (row.kind === 'block') return true;
  const node = row.node;
  if (node.kind === 'icon') return false;
  if (node.kind === 'component') return true;
  return !VOID_TAGS.has(node.tag) && (node.text === undefined || node.text === '');
}

function childrenOf(node: CustomCodeNode): readonly CustomCodeNode[] {
  return node.kind === 'icon' ? [] : (node.children ?? []);
}

/**
 * Visible rows in document order: blocks by the canvas's own ordering, and
 * under each region its element tree. `collapsed` holds row keys.
 */
export function buildLayerRows(
  kernel: BuilderKernel,
  doc: BuilderDocument,
  slotOrder: SlotOrderLookup,
  collapsed: ReadonlySet<string>,
): LayerRow[] {
  const out: LayerRow[] = [];

  const walkElements = (
    nodeId: NodeId,
    nodes: readonly CustomCodeNode[],
    parentPath: CustomCodePath,
    depth: number,
    parentKey: string,
  ): void => {
    nodes.forEach((node, at) => {
      const path = [...parentPath, at];
      const key = elementTargetKey({ kind: 'tree', nodeId, path });
      const kids = childrenOf(node);
      out.push({
        kind: 'element',
        key,
        nodeId,
        path,
        node,
        depth,
        expandable: kids.length > 0,
        posInSet: at + 1,
        setSize: nodes.length,
        parentKey,
      });
      if (kids.length > 0 && !collapsed.has(key)) walkElements(nodeId, kids, path, depth + 1, key);
    });
  };

  const walk = (id: NodeId, depth: number, posInSet: number, setSize: number, parentKey: string | undefined) => {
    const node = doc.nodes[id];
    const treeKey = node === undefined ? undefined : customCodeTreeKey(kernel, node.type);
    const tree: CustomCodeRoot | undefined =
      treeKey === undefined || node === undefined ? undefined : asCustomCodeRoot(node.props[treeKey]);
    const children = orderedChildren(doc, slotOrder, id);
    const elements = tree?.children ?? [];
    const key = blockRowKey(id);
    out.push({
      kind: 'block',
      key,
      id,
      treeKey,
      depth,
      expandable: children.length + elements.length > 0,
      posInSet,
      setSize,
      parentKey,
    });
    if (collapsed.has(key)) return;
    children.forEach((child, at) => {
      walk(child, depth + 1, at + 1, children.length, key);
    });
    if (elements.length > 0) walkElements(id, elements, [], depth + 1, key);
  };

  walk(doc.rootId, 0, 1, 1, undefined);
  return out;
}

const PREVIEW_MAX = 28;

/** A short preview of an element's own text (or its first descendant's). */
export function elementTextPreview(node: CustomCodeNode): string | undefined {
  const queue: CustomCodeNode[] = [node];
  for (let guard = 0; queue.length > 0 && guard < 100; guard += 1) {
    const current = queue.shift();
    if (current === undefined) break;
    if (current.kind === 'element') {
      const text = current.text?.replace(/\s+/gu, ' ').trim();
      if (text !== undefined && text !== '') {
        return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : text;
      }
    }
    queue.push(...childrenOf(current));
  }
  return undefined;
}

/** A language-neutral glyph for the tag column ('H2', 'IMG', '◇' for an icon). */
export function elementGlyph(node: CustomCodeNode): string {
  if (node.kind === 'icon') return '◇';
  if (node.kind === 'component') return '⧉';
  if (/^h[1-6]$/u.test(node.tag)) return node.tag.toUpperCase();
  return node.tag.slice(0, 3).toUpperCase();
}

// ── Drag projection ─────────────────────────────────────────────────────────

/** Rows a drag reorders over: the dragged row's own descendants travel with it. */
export function dragRows(rows: readonly LayerRow[], activeKey: string): LayerRow[] {
  const at = rows.findIndex((row) => row.key === activeKey);
  const active = rows[at];
  if (active === undefined) return [...rows];
  const out: LayerRow[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;
    if (index > at && isDescendantRow(rows, at, index, active.depth)) continue;
    out.push(row);
  }
  return out;
}

function isDescendantRow(rows: readonly LayerRow[], activeIndex: number, index: number, activeDepth: number): boolean {
  for (let between = activeIndex + 1; between <= index; between += 1) {
    if ((rows[between]?.depth ?? 0) <= activeDepth) return false;
  }
  return true;
}

export interface Projection {
  /** Index in the drag rows where the dragged row now stands. */
  readonly overIndex: number;
  readonly depth: number;
  readonly minDepth: number;
  readonly maxDepth: number;
  /** The row that becomes the parent; undefined above the root. */
  readonly parent: LayerRow | undefined;
  /** Post-removal index among the parent's children of the same kind. */
  readonly index: number;
}

/**
 * Where the active row lands if dropped at `overIndex` with a wished-for
 * `depth` (clamped to what the neighbours allow) — the dnd-kit sortable-tree
 * projection, applied to Layers' mixed block/element rows.
 */
export function projectDrop(
  rows: readonly LayerRow[],
  activeKey: string,
  overIndex: number,
  wishedDepth: number,
): Projection | undefined {
  const activeIndex = rows.findIndex((row) => row.key === activeKey);
  const active = rows[activeIndex];
  if (active === undefined) return undefined;
  const clampedOver = Math.max(1, Math.min(overIndex, rows.length - 1));
  const moved = [...rows];
  moved.splice(activeIndex, 1);
  moved.splice(clampedOver, 0, active);
  const previous = moved[clampedOver - 1];
  const next = moved[clampedOver + 1];
  const maxDepth = previous === undefined ? 0 : rowAcceptsChildren(previous) ? previous.depth + 1 : previous.depth;
  const minDepth = Math.min(next?.depth ?? 1, maxDepth);
  const depth = Math.max(minDepth, Math.min(maxDepth, wishedDepth));

  let parent: LayerRow | undefined;
  for (let at = clampedOver - 1; at >= 0; at -= 1) {
    const candidate = moved[at];
    if (candidate?.depth === depth - 1) {
      parent = candidate;
      break;
    }
  }
  let index = 0;
  for (let at = clampedOver - 1; at >= 0; at -= 1) {
    const candidate = moved[at];
    if (candidate === undefined || candidate.depth < depth) break;
    if (candidate.depth === depth && candidate.kind === active.kind) index += 1;
  }
  return { overIndex: clampedOver, depth, minDepth, maxDepth, parent, index };
}

export type PlannedMove =
  | { readonly ok: true; readonly step: GroupStep; readonly focus: ElementTarget | undefined }
  | { readonly ok: false; readonly unchanged: boolean };

/**
 * The ONE command a projected drop commits: `moveTreeNode` for an element
 * (across regions too), `moveNode` for a block. Element rows only land in an
 * element tree and blocks only in slots that accept them.
 */
export function planDrop(
  kernel: BuilderKernel,
  active: LayerRow,
  projection: Projection,
): PlannedMove {
  const parent = projection.parent;
  if (parent === undefined) return { ok: false, unchanged: false };
  if (active.kind === 'element') {
    let regionId: NodeId;
    let parentPath: CustomCodePath;
    if (parent.kind === 'block') {
      if (parent.treeKey === undefined) return { ok: false, unchanged: false };
      regionId = parent.id;
      parentPath = [];
    } else {
      if (!rowAcceptsChildren(parent)) return { ok: false, unchanged: false };
      regionId = parent.nodeId;
      parentPath = parent.path;
    }
    const sameParent =
      regionId === active.nodeId &&
      parentPath.length === active.path.length - 1 &&
      parentPath.every((value, at) => active.path[at] === value);
    if (sameParent && projection.index === active.path.at(-1)) return { ok: false, unchanged: true };
    const to = regionId === active.nodeId ? { parent: parentPath, index: projection.index } : { id: regionId, parent: parentPath, index: projection.index };
    // The new address, read in the tree AFTER the move.
    const focusParent =
      regionId === active.nodeId ? adjustAfterRemoval(parentPath, active.path) : parentPath;
    return {
      ok: true,
      step: { command: 'moveTreeNode', args: { id: active.nodeId, from: [...active.path], to } },
      focus: { kind: 'tree', nodeId: regionId, path: [...focusParent, projection.index] },
    };
  }
  if (parent.kind !== 'block') return { ok: false, unchanged: false };
  const doc = kernel.getDocument();
  const registry = kernel.context.registry;
  const payload = { kind: 'move', id: active.id } as const;
  const slots = Object.keys(registry.block(doc.nodes[parent.id]?.type ?? '')?.schema.slots ?? {});
  const seat = seatOf(doc, active.id);
  const slot =
    seat?.parentId === parent.id && slots.includes(seat.slot)
      ? seat.slot
      : slots.find((candidate) => slotAccepts(doc, registry, parent.id, candidate, payload));
  if (slot === undefined || !slotAccepts(doc, registry, parent.id, slot, payload)) {
    return { ok: false, unchanged: false };
  }
  if (seat?.parentId === parent.id && seat.slot === slot && seat.index === projection.index) {
    return { ok: false, unchanged: true };
  }
  return {
    ok: true,
    step: { command: 'moveNode', args: { id: active.id, toParentId: parent.id, toSlot: slot, toIndex: projection.index } },
    focus: { kind: 'block', nodeId: active.id },
  };
}
