import type { SiteGroupStep } from '@craftkit/builder-core';
import {
  applySymbolOverrides,
  DETACHED_SYMBOL_BLOCK_TYPE,
  findSymbolInstances,
  patchNodeAt,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  symbolOverridesSchema,
  type BuilderDocument,
  type BuilderSite,
  type CustomCodeNode,
  type CustomCodePath,
  type CustomCodeRoot,
  type Node,
  type NodeId,
  type PageId,
  type SiteSymbol,
  type SymbolOverride,
  type TreeNodePatch,
} from '@craftkit/builder-schema';

import { freshStyleId } from '../ClassManager/class-manager-ops';

/*
  ── Symbol operations (style-manager DESIGN.md §G "Components / symbols") ──

  Pure step builders, one person-visible action each. "Make into symbol" is
  the master written to the library AND the region replaced by an instance in
  the same place: one transaction, one Undo. Detach is the reverse. Overrides
  live on the instance's `overrides` prop, so resetting one is a `setProp`.
*/

export type SymbolStepsResult =
  | { readonly ok: true; readonly steps: readonly SiteGroupStep[]; readonly symbolId?: string }
  | { readonly ok: false; readonly message: string };

export interface SymbolRow {
  readonly symbol: SiteSymbol;
  readonly instances: number;
}

/** The library's symbols by name, each with how many instances it has. */
export function symbolRows(site: Readonly<BuilderSite>): readonly SymbolRow[] {
  return Object.values(site.library?.symbols ?? {})
    .map((symbol) => ({
      symbol,
      instances: findSymbolInstances(site as BuilderSite, symbol.id).length,
    }))
    .sort((left, right) => left.symbol.name.localeCompare(right.symbol.name));
}

/** Where a node sits: its parent, the slot and the index in it. */
export function nodePlace(
  document: BuilderDocument,
  id: NodeId,
): { readonly parentId: NodeId; readonly slot: string; readonly index: number } | undefined {
  for (const parent of Object.values(document.nodes)) {
    for (const [slot, members] of Object.entries(parent.slots ?? {})) {
      const index = members.indexOf(id);
      if (index !== -1) return { parentId: parent.id, slot, index };
    }
  }
  return undefined;
}

function treeOf(node: Node): CustomCodeRoot | undefined {
  const tree = node.props['tree'];
  if (typeof tree !== 'object' || tree === null || Array.isArray(tree)) return undefined;
  return (tree as { kind?: unknown }).kind === 'root' ? (tree as unknown as CustomCodeRoot) : undefined;
}

function stringProp(node: Node, key: string): string | undefined {
  const value = node.props[key];
  return typeof value === 'string' ? value : undefined;
}

/** The overrides an instance node stores (tolerant read). */
export function instanceOverrides(node: Node): SymbolOverride[] {
  const parsed = symbolOverridesSchema.safeParse(node.props['overrides']);
  return parsed.success ? parsed.data : [];
}

/** The symbol an instance node shows, when the library still holds it. */
export function instanceSymbol(site: Readonly<BuilderSite>, node: Node): SiteSymbol | undefined {
  const id = stringProp(node, 'symbolId');
  const symbols = site.library?.symbols ?? {};
  return id !== undefined && Object.hasOwn(symbols, id) ? symbols[id] : undefined;
}

/**
 * "Make into symbol": the region's tree and css become `library.symbols[id]`,
 * and the region is replaced, in place, by an instance of it.
 */
export function makeSymbolSteps(
  site: Readonly<BuilderSite>,
  document: BuilderDocument,
  regionId: NodeId,
  name: string,
  pageId: PageId,
): SymbolStepsResult {
  const region = document.nodes[regionId];
  if (region === undefined) return { ok: false, message: 'The selected region no longer exists.' };
  if (region.type !== DETACHED_SYMBOL_BLOCK_TYPE) {
    return { ok: false, message: 'Only a composed region can become a symbol.' };
  }
  const tree = treeOf(region);
  if (tree === undefined || tree.children.length === 0) {
    return { ok: false, message: 'This region is empty; there is nothing to reuse.' };
  }
  const place = nodePlace(document, regionId);
  if (place === undefined) return { ok: false, message: 'The page root cannot become a symbol.' };
  const trimmed = name.trim();
  if (trimmed === '') return { ok: false, message: 'Name the symbol first.' };
  const id = freshStyleId(trimmed, Object.keys(site.library?.symbols ?? {}));
  const css = stringProp(region, 'css') ?? '';
  const symbol: SiteSymbol = {
    id,
    name: trimmed.slice(0, 80),
    tree,
    ...(css.trim() === '' ? {} : { css }),
  };
  const label = stringProp(region, 'label') ?? trimmed;
  return {
    ok: true,
    symbolId: id,
    steps: [
      { command: 'setSymbol', args: { symbol } },
      {
        command: 'insertNode',
        args: {
          type: SYMBOL_INSTANCE_BLOCK_TYPE,
          props: { label: label.slice(0, 80), symbolId: id, overrides: [] },
          parentId: place.parentId,
          slot: place.slot,
          index: place.index,
        },
        pageId,
      },
      { command: 'removeNode', args: { id: regionId }, pageId },
    ],
  };
}

/** "Detach": the instance becomes a plain region holding the master with its overrides applied. */
export function detachInstanceSteps(
  site: Readonly<BuilderSite>,
  document: BuilderDocument,
  instanceId: NodeId,
  pageId: PageId,
): SymbolStepsResult {
  const node = document.nodes[instanceId];
  if (node?.type !== SYMBOL_INSTANCE_BLOCK_TYPE) {
    return { ok: false, message: 'The selection is not a symbol instance.' };
  }
  const symbol = instanceSymbol(site, node);
  if (symbol === undefined) return { ok: false, message: 'This instance’s symbol is missing from the library.' };
  const place = nodePlace(document, instanceId);
  if (place === undefined) return { ok: false, message: 'The instance has no place on the page.' };
  return {
    ok: true,
    steps: [
      {
        command: 'insertNode',
        args: {
          type: DETACHED_SYMBOL_BLOCK_TYPE,
          props: {
            label: (stringProp(node, 'label') ?? symbol.name).slice(0, 80),
            tree: applySymbolOverrides(symbol.tree, instanceOverrides(node)),
            css: symbol.css ?? '',
          },
          parentId: place.parentId,
          slot: place.slot,
          index: place.index,
        },
        pageId,
      },
      { command: 'removeNode', args: { id: instanceId }, pageId },
    ],
  };
}

/** "Push to master": this instance's look becomes the master; its overrides clear. */
export function pushOverridesSteps(
  site: Readonly<BuilderSite>,
  node: Node,
  pageId: PageId,
): SymbolStepsResult {
  const symbol = instanceSymbol(site, node);
  if (symbol === undefined) return { ok: false, message: 'This instance’s symbol is missing from the library.' };
  const overrides = instanceOverrides(node);
  if (overrides.length === 0) return { ok: false, message: 'This instance has no overrides to push.' };
  return {
    ok: true,
    steps: [
      { command: 'setSymbol', args: { symbol: { ...symbol, tree: applySymbolOverrides(symbol.tree, overrides) } } },
      { command: 'setProp', args: { id: node.id, key: 'overrides', value: [] }, pageId },
    ],
  };
}

/** Reset one override (by index) or all of them. */
export function resetOverrideSteps(node: Node, which: number | 'all', pageId: PageId): SymbolStepsResult {
  const overrides = instanceOverrides(node);
  const next = which === 'all' ? [] : overrides.filter((_, at) => at !== which);
  if (next.length === overrides.length) return { ok: false, message: 'Nothing to reset.' };
  return { ok: true, steps: [{ command: 'setProp', args: { id: node.id, key: 'overrides', value: next }, pageId }] };
}

function samePath(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, at) => b[at] === value);
}

/**
 * The overrides with `patch` merged into the entry at `path` (created when
 * absent). For the element panel: when the focused element lives inside an
 * instance, its writes become this instead of a tree edit.
 */
export function withSymbolOverride(
  overrides: readonly SymbolOverride[],
  path: CustomCodePath,
  patch: Omit<SymbolOverride, 'path'>,
): SymbolOverride[] {
  const at = overrides.findIndex((entry) => samePath(entry.path, path));
  const base: SymbolOverride = at === -1 ? { path: [...path] } : { ...overrides[at], path: [...path] };
  const merged: SymbolOverride = {
    ...base,
    ...(patch.text === undefined ? {} : { text: patch.text }),
    ...(patch.className === undefined ? {} : { className: patch.className }),
    ...(patch.attributes === undefined
      ? {}
      : { attributes: { ...(base.attributes ?? {}), ...patch.attributes } }),
  };
  const next = [...overrides];
  if (at === -1) next.push(merged);
  else next[at] = merged;
  return next;
}

/** The fields an override changes, for the "overridden" badge. */
export function overriddenFields(override: SymbolOverride): ('text' | 'className' | 'attributes')[] {
  const fields: ('text' | 'className' | 'attributes')[] = [];
  if (override.text !== undefined) fields.push('text');
  if (override.className !== undefined) fields.push('className');
  if (override.attributes !== undefined && Object.keys(override.attributes).length > 0) fields.push('attributes');
  return fields;
}

/** The master with one node patched — an "Edit master" write (every instance updates). */
export function patchMasterSteps(
  symbol: SiteSymbol,
  path: CustomCodePath,
  patch: TreeNodePatch,
): SymbolStepsResult {
  const result = patchNodeAt(symbol.tree, path, patch);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, steps: [{ command: 'setSymbol', args: { symbol: { ...symbol, tree: result.tree } } }] };
}

export interface MasterOutlineRow {
  readonly path: CustomCodePath;
  readonly node: CustomCodeNode;
  readonly depth: number;
}

/** The master's nodes, depth-first, for the "Edit master" outline (capped). */
export function masterOutline(tree: CustomCodeRoot, limit = 200): readonly MasterOutlineRow[] {
  const rows: MasterOutlineRow[] = [];
  const walk = (nodes: readonly CustomCodeNode[], prefix: CustomCodePath, depth: number): void => {
    nodes.forEach((node, at) => {
      if (rows.length >= limit) return;
      const path = [...prefix, at];
      rows.push({ path, node, depth });
      if (node.kind !== 'icon') walk(node.children ?? [], path, depth + 1);
    });
  };
  walk(tree.children, [], 0);
  return rows;
}
