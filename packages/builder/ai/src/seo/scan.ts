import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';

/**
 * One read of a page for the SEO checks: every region in reading order, and
 * every element of every customCode tree with the address a fix needs
 * (region id + child-index path).
 *
 * The checker needs addresses, which is why it walks the trees itself rather
 * than reading `extractSeoContent`'s flat lists: an issue without a node and a
 * path cannot carry a fix.
 */

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ScannedElement {
  readonly nodeId: NodeId;
  readonly path: readonly number[];
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** The element's own `text`, trimmed. */
  readonly ownText: string;
  /** Its own text plus every descendant's, space-joined. */
  readonly fullText: string;
  /** The first heading's text in the same region, for alt and link copy. */
  readonly sectionHeading: string;
  /** How many text-bearing descendants below it (own text excluded). */
  readonly textDescendants: number;
}

export interface ScannedRegion {
  readonly nodeId: NodeId;
  readonly tree: JsonRecord;
  readonly heading: string;
}

export interface PageScan {
  readonly document: BuilderDocument;
  readonly rootId: NodeId;
  readonly root: JsonRecord;
  readonly dir: 'rtl' | 'ltr';
  readonly lang: string;
  readonly regions: readonly ScannedRegion[];
  readonly elements: readonly ScannedElement[];
  /** Every visible text, for script detection. */
  readonly bodyText: string;
}

export const HEADING_LEVEL: Readonly<Record<string, number>> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

function childrenOf(node: JsonRecord): unknown[] {
  return Array.isArray(node['children']) ? (node['children'] as unknown[]) : [];
}

function attributesOf(node: JsonRecord): Record<string, string> {
  const raw = isRecord(node['attributes']) ? node['attributes'] : {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function ownTextOf(node: JsonRecord): string {
  return typeof node['text'] === 'string' ? node['text'].replace(/\s+/gu, ' ').trim() : '';
}

/** Every text below a node (itself included), space-joined. */
export function textOf(node: JsonRecord): string {
  const parts: string[] = [];
  const visit = (current: JsonRecord): void => {
    const own = ownTextOf(current);
    if (own !== '') parts.push(own);
    if (current['kind'] === 'icon' && typeof current['label'] === 'string') parts.push(current['label']);
    for (const child of childrenOf(current)) if (isRecord(child)) visit(child);
  };
  visit(node);
  return parts.join(' ').replace(/\s+/gu, ' ').trim();
}

function firstHeading(tree: JsonRecord): string {
  let found = '';
  const visit = (node: JsonRecord): void => {
    if (found !== '') return;
    const tag = typeof node['tag'] === 'string' ? node['tag'] : '';
    if (HEADING_LEVEL[tag] !== undefined) {
      found = textOf(node);
      if (found !== '') return;
    }
    for (const child of childrenOf(node)) if (isRecord(child)) visit(child);
  };
  visit(tree);
  return found;
}

/** Region ids in reading order: the root's slots depth-first, then any stragglers. */
export function regionOrder(document: BuilderDocument): NodeId[] {
  const seen = new Set<NodeId>();
  const order: NodeId[] = [];
  const collect = (id: NodeId): void => {
    if (seen.has(id) || !Object.hasOwn(document.nodes, id)) return;
    seen.add(id);
    order.push(id);
    const slots = document.nodes[id]?.slots;
    if (slots === undefined) return;
    for (const children of Object.values(slots)) for (const child of children) collect(child);
  };
  collect(document.rootId);
  for (const id of Object.keys(document.nodes)) collect(id);
  return order;
}

export function scanPage(document: BuilderDocument): PageScan {
  const root = (document.nodes[document.rootId]?.props ?? {}) as JsonRecord;
  const regions: ScannedRegion[] = [];
  const elements: ScannedElement[] = [];
  const texts: string[] = [];

  for (const nodeId of regionOrder(document)) {
    const props = document.nodes[nodeId]?.props;
    const tree = props === undefined ? undefined : props['tree'];
    if (!isRecord(tree)) {
      if (nodeId !== document.rootId && props !== undefined) {
        for (const value of Object.values(props)) if (typeof value === 'string') texts.push(value);
      }
      continue;
    }
    const heading = firstHeading(tree);
    regions.push({ nodeId, tree, heading });
    const descend = (node: JsonRecord, path: readonly number[]): number => {
      const own = ownTextOf(node);
      if (own !== '') texts.push(own);
      let below = 0;
      const index = elements.length;
      if (node['kind'] === 'element' && typeof node['tag'] === 'string') {
        elements.push({
          nodeId,
          path,
          tag: node['tag'],
          attributes: attributesOf(node),
          ownText: own,
          fullText: textOf(node),
          sectionHeading: heading,
          textDescendants: 0,
        });
      }
      childrenOf(node).forEach((child, at) => {
        if (isRecord(child)) below += descend(child, [...path, at]);
      });
      const entry = elements[index];
      if (entry?.path === path && entry.nodeId === nodeId) {
        elements[index] = { ...entry, textDescendants: below };
      }
      return below + (own !== '' ? 1 : 0);
    };
    childrenOf(tree).forEach((child, at) => {
      if (isRecord(child)) descend(child, [at]);
    });
  }

  const lang = typeof root['lang'] === 'string' ? root['lang'].trim() : '';
  return {
    document,
    rootId: document.rootId,
    root,
    dir: document.dir === 'rtl' ? 'rtl' : 'ltr',
    lang,
    regions,
    elements,
    bodyText: texts.join(' '),
  };
}

/** The node at a child-index path inside a tree, or undefined. */
export function nodeAt(tree: unknown, path: readonly number[]): JsonRecord | undefined {
  let current: unknown = tree;
  for (const index of path) {
    if (!isRecord(current)) return undefined;
    current = childrenOf(current)[index];
  }
  return isRecord(current) ? current : undefined;
}
