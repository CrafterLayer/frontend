import type { BuilderKernel } from '@craftkit/builder-core';
import {
  blockPartsOf,
  getAtPropPath,
  parsePropPath,
  partInstances,
  type BlockPartDecl,
  type BuilderDocument,
  type KernelState,
  type NodeId,
  type PartInstance,
  type PartRef,
} from '@craftkit/builder-schema';

import { richTextPlainText } from '../../fields/rich-text-plain-text';
import type { LayerRow } from './layers-rows';
import type { LayersPartLabels } from './LayersPartRow.labels';

/*
  A registered block's PARTS in Layers (block-parts DESIGN §2.13): the block
  row expands to one row per part instance (the hero's badge, heading, body,
  each feature and each feature's title), nested the way their binds nest —
  `items.2.title` sits under `items.2`, which sits under `items`. Part rows
  are not sortable: their order is the block's own, changed by the item
  actions (Duplicate / Move / Remove), never by a drop.
*/

export interface PartLayerRow {
  readonly kind: 'part';
  /** `part:<nodeId>:<name>@<index>` — see {@link partRowKey}. */
  readonly key: string;
  readonly nodeId: NodeId;
  readonly ref: PartRef;
  readonly decl: BlockPartDecl;
  /** The formatted primary bind path (`items.2.title`); absent for a box. */
  readonly bind: string | undefined;
  readonly depth: number;
  readonly expandable: boolean;
  readonly posInSet: number;
  readonly setSize: number;
  readonly parentKey: string;
  /** Item rows: whether a Move up / Move down has somewhere to go. */
  readonly first: boolean;
  readonly last: boolean;
}

export type TreeRow = LayerRow | PartLayerRow;

export function partRowKey(nodeId: NodeId, ref: PartRef): string {
  return `part:${nodeId}:${ref.part}@${ref.index.join('.')}`;
}

/** The row key of the kernel's part focus, when it names the primary selection. */
export function partFocusKey(state: Readonly<KernelState>): string | null {
  const focus = state.partFocus;
  if (focus === undefined || focus === null || state.selection[0] !== focus.id) return null;
  return partRowKey(focus.id, focus);
}

interface Placed {
  readonly instance: PartInstance;
  readonly children: Placed[];
}

/** Nest instances by bind prefix: `items.2.title` under `items.2` under `items`. */
function nest(instances: readonly PartInstance[]): Placed[] {
  const placed = instances.map((instance) => ({ instance, children: [] as Placed[] }));
  const roots: Placed[] = [];
  for (const entry of placed) {
    const bind = entry.instance.bind;
    let parent: Placed | undefined;
    if (bind !== undefined) {
      for (const candidate of placed) {
        const other = candidate.instance.bind;
        if (candidate === entry || other === undefined || !bind.startsWith(`${other}.`)) continue;
        if (parent === undefined || (parent.instance.bind?.length ?? 0) < other.length) parent = candidate;
      }
    }
    (parent?.children ?? roots).push(entry);
  }
  return roots;
}

/**
 * The visible rows with every part-declaring block's part rows inserted right
 * after its own row (before its child blocks), depth-first. A collapsed block
 * or part hides what is below it; sibling positions are renumbered so a
 * block's parts and its child blocks read as one set.
 */
export function withPartRows(
  kernel: BuilderKernel,
  doc: BuilderDocument,
  rows: readonly LayerRow[],
  collapsed: ReadonlySet<string>,
): TreeRow[] {
  const out: TreeRow[] = [];
  // Child rows of a part-declaring block: key → [shift, setSize].
  const renumber = new Map<string, { readonly shift: number; readonly size: number }>();

  for (const row of rows) {
    const shifted = row.parentKey === undefined ? undefined : renumber.get(row.parentKey);
    const base: LayerRow =
      shifted === undefined ? row : { ...row, posInSet: row.posInSet + shifted.shift, setSize: shifted.size };
    if (base.kind !== 'block') {
      out.push(base);
      continue;
    }
    const node = doc.nodes[base.id];
    const parts = blockPartsOf(node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema);
    const instances = node === undefined || Object.keys(parts).length === 0 ? [] : partInstances(parts, node.props);
    if (instances.length === 0) {
      out.push(base);
      continue;
    }
    out.push(base.expandable ? base : { ...base, expandable: true });
    const roots = nest(instances);
    const childCount = rows.filter((candidate) => candidate.parentKey === base.key).length;
    renumber.set(base.key, { shift: roots.length, size: roots.length + childCount });
    if (collapsed.has(base.key)) continue;

    const walk = (level: readonly Placed[], depth: number, parentKey: string, siblings: number) => {
      level.forEach((entry, at) => {
        const ref: PartRef = { part: entry.instance.part, index: entry.instance.index };
        const key = partRowKey(base.id, ref);
        out.push({
          kind: 'part',
          key,
          nodeId: base.id,
          ref,
          decl: entry.instance.decl,
          bind: entry.instance.bind,
          depth,
          expandable: entry.children.length > 0,
          posInSet: at + 1,
          setSize: siblings,
          parentKey,
          first: at === 0,
          last: at === level.length - 1,
        });
        if (entry.children.length > 0 && !collapsed.has(key)) {
          walk(entry.children, depth + 1, key, entry.children.length);
        }
      });
    };
    walk(roots, base.depth + 1, base.key, roots.length + childCount);
  }
  return out;
}

const PREVIEW_MAX = 28;

function clip(text: string): string | undefined {
  const flat = text.replace(/\s+/gu, ' ').trim();
  if (flat === '') return undefined;
  return flat.length > PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : flat;
}

function firstString(value: unknown, guard = 0): string | undefined {
  if (typeof value === 'string') return clip(value);
  if (guard > 4 || typeof value !== 'object' || value === null) return undefined;
  for (const entry of Object.values(value)) {
    const found = firstString(entry, guard + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** A row's name: the part's label in the editor's language, numbered when repeated. */
export function partRowName(row: PartLayerRow, labels: LayersPartLabels): string {
  const label = row.decl.label[labels.locale];
  const last = row.ref.index.at(-1);
  return last === undefined ? label : labels.instance(label, last + 1);
}

/** A short preview of the part's content (its text, an image's alt, a list's count). */
export function partRowPreview(
  row: PartLayerRow,
  props: Readonly<Record<string, unknown>> | undefined,
  labels: LayersPartLabels,
): string | undefined {
  if (props === undefined || row.bind === undefined) return undefined;
  const value = getAtPropPath(props, parsePropPath(row.bind));
  switch (row.decl.kind) {
    case 'text':
    case 'link':
      return typeof value === 'string' ? clip(value) : undefined;
    case 'rich':
      return clip(richTextPlainText(value));
    case 'image': {
      const bind = row.decl.bind;
      const altPattern = typeof bind === 'object' && 'src' in bind ? bind.alt : undefined;
      if (altPattern !== undefined) {
        let at = 0;
        const altPath = altPattern.split('.').map((segment) => (segment === '*' ? (row.ref.index[at++] ?? 0) : segment));
        const alt = getAtPropPath(props, altPath);
        if (typeof alt === 'string' && alt.trim() !== '') return clip(alt);
      }
      return typeof value === 'string' ? clip(value.split('/').at(-1) ?? value) : undefined;
    }
    case 'list':
      return Array.isArray(value) ? labels.count(value.length) : undefined;
    case 'item':
      return firstString(value);
    case 'box':
      return undefined;
  }
}

/** A language-neutral glyph for the tag column, by part kind. */
export function partGlyph(decl: BlockPartDecl): string {
  switch (decl.kind) {
    case 'text':
      return 'T';
    case 'rich':
      return '¶';
    case 'link':
      return '↗';
    case 'image':
      return 'IMG';
    case 'list':
      return '≡';
    case 'item':
      return '•';
    case 'box':
      return '□';
  }
}
