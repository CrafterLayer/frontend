import { collectAssetRefs } from '../assets/validate';
import type { AssetId } from '../assets/types';
import { customCodeAssetId } from '../custom-code/asset-reference';
import type { BuilderDocument, NodeId } from '../document/types';
import {
  namedStyleMarker,
  paletteVariable,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  type LibraryId,
  type SiteLibrary,
  type SiteSymbol,
} from './library';
import type { BuilderSite, PageId, SharedRegionId } from './types';

/**
 * WHERE a library entry is used (DESIGN §2 refusals, §G usage counts).
 *
 * A style, a symbol, a palette colour or an asset may not vanish while
 * something still points at it, and the refusal must say what does — "in use"
 * with no location is a message that costs its reader a search. These readers
 * answer that, for the commands that refuse and for the panels that show
 * usage counts, from one walk.
 *
 * Tolerant like every tree reader: they inspect whatever they are handed, so
 * they work on a stored site, an immer draft, or a proposal not yet validated.
 */

export type LibraryUsageOwner =
  | { kind: 'page'; pageId: PageId }
  | { kind: 'region'; regionId: SharedRegionId }
  | { kind: 'symbol'; symbolId: LibraryId }
  | { kind: 'template'; templateId: LibraryId }
  | { kind: 'style'; styleId: LibraryId };

export interface LibraryUsage {
  owner: LibraryUsageOwner;
  /** The document node, for page and region owners. */
  nodeId?: NodeId;
  /** JSON path inside the node (or library entry) to the holder. */
  path: readonly (string | number)[];
}

/** One place a library reference can live: a document node or a library entry. */
export interface LibraryHost {
  owner: LibraryUsageOwner;
  nodeId?: NodeId;
  /** The node or entry object itself — on a draft, writes through it land. */
  value: unknown;
}

function documentHosts(
  document: BuilderDocument,
  owner: LibraryUsageOwner,
  hosts: LibraryHost[],
): void {
  for (const [nodeId, node] of Object.entries(document.nodes)) {
    hosts.push({ owner, nodeId, value: node });
  }
}

/** Every node of every page and shared region, then every library entry. */
export function libraryHosts(site: BuilderSite): LibraryHost[] {
  const hosts: LibraryHost[] = [];
  for (const page of site.pages) {
    documentHosts(page.document, { kind: 'page', pageId: page.id }, hosts);
  }
  for (const region of Object.values(site.sharedRegions)) {
    documentHosts(region.document, { kind: 'region', regionId: region.id }, hosts);
  }
  const library = site.library;
  for (const style of Object.values(library?.styles ?? {})) {
    hosts.push({ owner: { kind: 'style', styleId: style.id }, value: style });
  }
  for (const symbol of Object.values(library?.symbols ?? {})) {
    hosts.push({ owner: { kind: 'symbol', symbolId: symbol.id }, value: symbol });
  }
  for (const template of Object.values(library?.templates ?? {})) {
    hosts.push({ owner: { kind: 'template', templateId: template.id }, value: template });
  }
  return hosts;
}

export type LibraryWalkVisitor = (value: unknown, path: readonly (string | number)[]) => void;

/**
 * Visit every value under `root` (objects, arrays and leaves), depth-first.
 * Iterative, so a deep tree cannot overflow the stack; a value reached twice
 * (a shared reference in a hand-built object) is visited once.
 */
export function walkLibraryValues(root: unknown, visit: LibraryWalkVisitor): void {
  const seen = new Set<object>();
  const stack: { value: unknown; path: (string | number)[] }[] = [{ value: root, path: [] }];
  while (stack.length > 0) {
    const entry = stack.pop();
    /* v8 ignore next -- the loop condition guarantees an entry. */
    if (entry === undefined) break;
    const { value, path } = entry;
    visit(value, path);
    if (typeof value !== 'object' || value === null || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: (value as unknown[])[index], path: [...path, index] });
      }
      continue;
    }
    const keys = Object.keys(value).reverse();
    for (const key of keys) {
      stack.push({ value: (value as Record<string, unknown>)[key], path: [...path, key] });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function usagesWhere(
  site: BuilderSite,
  matches: (value: unknown, host: LibraryHost) => boolean,
): LibraryUsage[] {
  const usages: LibraryUsage[] = [];
  for (const host of libraryHosts(site)) {
    walkLibraryValues(host.value, (value, path) => {
      if (!matches(value, host)) return;
      usages.push({
        owner: host.owner,
        ...(host.nodeId === undefined ? {} : { nodeId: host.nodeId }),
        path,
      });
    });
  }
  return usages;
}

/** Whether `value` is an object whose `className` carries `marker` as a whole token. */
export function holdsClassToken(value: unknown, marker: string): value is { className: string } {
  if (!isRecord(value) || typeof value['className'] !== 'string') return false;
  return value['className'].split(/\s+/u).includes(marker);
}

/** Every holder of the `ck-s-<id>` marker: tree elements, icons, overrides, block props. */
export function findNamedStyleUsages(site: BuilderSite, id: LibraryId): LibraryUsage[] {
  const marker = namedStyleMarker(id);
  return usagesWhere(site, (value) => holdsClassToken(value, marker));
}

/** How many holders each named style has — the Styles panel's usage counts. */
export function namedStyleUsageCounts(site: BuilderSite): Record<LibraryId, number> {
  const counts: Record<LibraryId, number> = {};
  for (const id of Object.keys(site.library?.styles ?? {})) {
    counts[id] = findNamedStyleUsages(site, id).length;
  }
  return counts;
}

function paletteReference(id: LibraryId): RegExp {
  /* An id is [a-z0-9-] only, so it needs no escaping inside the pattern. */
  return new RegExp(`${paletteVariable(id)}(?![a-z0-9-])`, 'u');
}

/** Every string (class list, stylesheet, attribute) that names `--ck-c-<id>`. */
export function findPaletteUsages(site: BuilderSite, id: LibraryId): LibraryUsage[] {
  const pattern = paletteReference(id);
  return usagesWhere(site, (value) => typeof value === 'string' && pattern.test(value));
}

/**
 * Every instance of a symbol: a `customCodeSymbol` document node, or a tree
 * `component` node referencing the same block (a symbol inside a symbol).
 */
export function findSymbolInstances(site: BuilderSite, id: LibraryId): LibraryUsage[] {
  return usagesWhere(site, (value) => isSymbolInstance(value, id));
}

/** Whether `value` is a document node or tree component instantiating symbol `id`. */
export function isSymbolInstance(value: unknown, id?: LibraryId): boolean {
  if (!isRecord(value)) return false;
  const isNode = value['type'] === SYMBOL_INSTANCE_BLOCK_TYPE;
  const isComponent =
    value['kind'] === 'component' && value['component'] === SYMBOL_INSTANCE_BLOCK_TYPE;
  if (!isNode && !isComponent) return false;
  const props = value['props'];
  if (!isRecord(props) || typeof props['symbolId'] !== 'string') return false;
  return id === undefined || props['symbolId'] === id;
}

/** The symbol ids instantiated anywhere inside `value` (deduplicated, in order). */
export function referencedSymbolIds(value: unknown): LibraryId[] {
  const found: LibraryId[] = [];
  walkLibraryValues(value, (candidate) => {
    if (!isSymbolInstance(candidate)) return;
    const id = (candidate as { props: { symbolId: string } }).props.symbolId;
    if (!found.includes(id)) found.push(id);
  });
  return found;
}

/**
 * The reference chain by which symbol `id` contains itself, or undefined.
 * `candidate` stands in for the stored symbol of the same id — the check a
 * write runs BEFORE the new master lands.
 */
export function symbolCycle(
  library: SiteLibrary | undefined,
  id: LibraryId,
  candidate?: SiteSymbol,
): LibraryId[] | undefined {
  const symbols = library?.symbols ?? {};
  const lookup = (symbolId: LibraryId): SiteSymbol | undefined =>
    candidate?.id === symbolId
      ? candidate
      : Object.hasOwn(symbols, symbolId)
        ? symbols[symbolId]
        : undefined;
  const visited = new Set<LibraryId>();
  const search = (current: LibraryId, chain: LibraryId[]): LibraryId[] | undefined => {
    for (const next of referencedSymbolIds(lookup(current)?.tree)) {
      if (next === id) return [...chain, next];
      if (visited.has(next)) continue;
      visited.add(next);
      const found = search(next, [...chain, next]);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return search(id, [id]);
}

/** Every `{assetId}` reference to `id` in page and shared-region documents. */
export function findAssetUsages(site: BuilderSite, id: AssetId): LibraryUsage[] {
  const usages: LibraryUsage[] = [];
  const scan = (document: BuilderDocument, owner: LibraryUsageOwner): void => {
    for (const ref of collectAssetRefs(document.nodes)) {
      if (ref.ref.assetId !== id) continue;
      const path = ref.propPath[0] === 'responsive' ? ref.propPath : ['props', ...ref.propPath];
      usages.push({ owner, nodeId: ref.nodeId, path });
    }
    // A tree image points at an asset by `src="/ck-assets/<id>"` (asset-reference.ts).
    for (const node of Object.values(document.nodes)) {
      const walk = (value: unknown, path: (string | number)[]): void => {
        if (typeof value === 'string') {
          if (path.at(-1) === 'src' && customCodeAssetId(value) === id) {
            usages.push({ owner, nodeId: node.id, path: ['props', ...path] });
          }
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            walk(item, [...path, index]);
          });
          return;
        }
        if (typeof value === 'object' && value !== null) {
          for (const [key, item] of Object.entries(value)) walk(item, [...path, key]);
        }
      };
      walk(node.props, []);
    }
  };
  for (const page of site.pages) scan(page.document, { kind: 'page', pageId: page.id });
  for (const region of Object.values(site.sharedRegions)) {
    scan(region.document, { kind: 'region', regionId: region.id });
  }
  return usages;
}

/** One readable location, e.g. `page "home" › node "hero" › props.tree.children.0`. */
export function describeLibraryUsage(usage: LibraryUsage): string {
  const owner = usage.owner;
  const head =
    owner.kind === 'page'
      ? `page "${owner.pageId}"`
      : owner.kind === 'region'
        ? `shared region "${owner.regionId}"`
        : owner.kind === 'symbol'
          ? `symbol "${owner.symbolId}"`
          : owner.kind === 'template'
            ? `template "${owner.templateId}"`
            : `style "${owner.styleId}"`;
  const node = usage.nodeId === undefined ? '' : ` › node "${usage.nodeId}"`;
  const path = usage.path.length === 0 ? '' : ` › ${usage.path.join('.')}`;
  return `${head}${node}${path}`;
}

/** A refusal-sized list: the first few locations and how many more. */
export function describeLibraryUsages(usages: readonly LibraryUsage[], shown = 5): string {
  const listed = usages.slice(0, shown).map(describeLibraryUsage).join('; ');
  const rest = usages.length - shown;
  return rest > 0 ? `${listed}; and ${String(rest)} more` : listed;
}
