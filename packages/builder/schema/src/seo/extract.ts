import type { BuilderDocument, Node } from '../document/types';
import type { JsonValue } from '../json/json-value';
import { collapseSpace } from './text';

/*
  What a page SAYS, read from its customCode trees (DESIGN D.2): headings,
  images, links, FAQ pairs, the first paragraph and price-like text. The
  checker, the JSON-LD builder and the head builder all read this one
  extraction, so they agree about the page. Document order: the root's slots
  depth-first, each node's tree in order.
*/

export interface SeoHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  nodeId: string;
}

export interface SeoImage {
  src: string;
  alt?: string | undefined;
  width?: string | undefined;
  height?: string | undefined;
  loading?: string | undefined;
  fetchpriority?: string | undefined;
  srcset?: string | undefined;
  sizes?: string | undefined;
  /** `aria-hidden="true"` or `alt=""`: decorative, needs no alt text. */
  decorative: boolean;
  nodeId: string;
}

export interface SeoLink {
  href: string;
  text: string;
  nodeId: string;
}

export interface SeoFaq {
  question: string;
  answer: string;
}

export interface SeoPrice {
  /** The price text as written, e.g. '3.5 د.أ' or '$12'. */
  text: string;
  amount?: number | undefined;
  /** ISO 4217 when the currency is recognisable. */
  currency?: string | undefined;
  /** The item it prices: the nearest preceding heading or strong text. */
  label?: string | undefined;
}

export interface SeoContent {
  headings: SeoHeading[];
  images: SeoImage[];
  links: SeoLink[];
  faqs: SeoFaq[];
  firstParagraph?: string | undefined;
  prices: SeoPrice[];
  /** Page root props read alongside the trees. */
  title?: string | undefined;
  description?: string | undefined;
  lang?: string | undefined;
  slug?: string | undefined;
}

interface TreeNode {
  kind?: unknown;
  tag?: unknown;
  text?: unknown;
  label?: unknown;
  attributes?: unknown;
  children?: unknown;
  props?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function childrenOf(node: TreeNode): TreeNode[] {
  return Array.isArray(node.children) ? (node.children as TreeNode[]) : [];
}

function attr(node: TreeNode, name: string): string | undefined {
  const value = asRecord(node.attributes)?.[name];
  return typeof value === 'string' ? value : undefined;
}

function isTreeRoot(value: JsonValue | undefined): boolean {
  const record = asRecord(value);
  return record?.['kind'] === 'root' && Array.isArray(record['children']);
}

/** All visible text under a node, whitespace-collapsed. Icons contribute their label. */
function textOf(node: TreeNode): string {
  const parts: string[] = [];
  const visit = (current: TreeNode): void => {
    if (current.kind === 'icon') {
      if (typeof current.label === 'string') parts.push(current.label);
      return;
    }
    if (current.kind === 'element' && attr(current, 'aria-hidden') === 'true') return;
    if (typeof current.text === 'string') parts.push(current.text);
    for (const child of childrenOf(current)) visit(child);
  };
  visit(node);
  return collapseSpace(parts.join(' '));
}

const CURRENCIES: readonly (readonly [RegExp, string])[] = [
  [/د\.?\s?أ|دينار|JOD|JD/iu, 'JOD'],
  [/ر\.?\s?س|ريال\s?سعودي|SAR|SR/iu, 'SAR'],
  [/د\.?\s?إ|درهم|AED/iu, 'AED'],
  [/ج\.?\s?م|جنيه|EGP/iu, 'EGP'],
  [/د\.?\s?ك|KWD/iu, 'KWD'],
  [/ر\.?\s?ق|QAR/iu, 'QAR'],
  [/ريال/u, 'SAR'],
  [/US\$|\$|USD|دولار/iu, 'USD'],
  [/€|EUR|يورو/iu, 'EUR'],
  [/£|GBP/iu, 'GBP'],
];
const CURRENCY_TOKEN =
  'US\\$|\\$|€|£|USD|EUR|GBP|JOD|JD|SAR|SR|AED|EGP|KWD|QAR|د\\.?\\s?أ|ر\\.?\\s?س|د\\.?\\s?إ|ج\\.?\\s?م|د\\.?\\s?ك|ر\\.?\\s?ق|دينار|ريال|درهم|جنيه|دولار|يورو';
const AMOUNT = '[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?';
const PRICE = new RegExp(
  `(?:(?:${CURRENCY_TOKEN})\\s?${AMOUNT}|${AMOUNT}\\s?(?:${CURRENCY_TOKEN}))`,
  'iu',
);

function toAmount(text: string): number | undefined {
  const digits = (/[0-9]+(?:[.,٫][0-9]+)?/u.exec(text
    .replace(/[٠-٩]/gu, (d) => String(d.charCodeAt(0) - 0x0660))))?.[0]
    ?.replace(/[,٫]/u, '.');
  if (digits === undefined) return undefined;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : undefined;
}

function priceOf(text: string, label: string | undefined): SeoPrice | undefined {
  const match = PRICE.exec(text);
  if (match === null) return undefined;
  const found = match[0].trim();
  const currency = CURRENCIES.find(([pattern]) => pattern.test(found))?.[1];
  return { text: found, amount: toAmount(found), currency, label };
}

const HEADING = /^h([1-6])$/u;

/**
 * Reads a page's SEO-relevant content. Walks every node reachable from the
 * root (slot order, depth-first) and every customCode tree prop on each.
 * Nodes not reachable from the root are ignored — they are not on the page.
 */
export function extractSeoContent(document: BuilderDocument): SeoContent {
  const content: SeoContent = { headings: [], images: [], links: [], faqs: [], prices: [] };
  const root = document.nodes[document.rootId];
  if (root !== undefined) {
    const props = root.props;
    const read = (key: string): string | undefined => {
      const value = props[key];
      return typeof value === 'string' && value !== '' ? value : undefined;
    };
    content.title = read('title');
    content.description = read('description');
    content.lang = read('lang');
    content.slug = read('slug');
  }

  let lastLabel: string | undefined;

  const visitTree = (node: TreeNode, nodeId: string): void => {
    if (node.kind === 'component') {
      for (const child of childrenOf(node)) visitTree(child, nodeId);
      return;
    }
    if (node.kind !== 'element' || typeof node.tag !== 'string') return;
    const tag = node.tag;
    const heading = HEADING.exec(tag);
    if (heading !== null) {
      const text = textOf(node);
      content.headings.push({ level: Number(heading[1]) as SeoHeading['level'], text, nodeId });
      if (text !== '') lastLabel = text;
      return;
    }
    if (tag === 'img') {
      const src = attr(node, 'src');
      if (src !== undefined) {
        const alt = attr(node, 'alt');
        content.images.push({
          src,
          alt,
          width: attr(node, 'width'),
          height: attr(node, 'height'),
          loading: attr(node, 'loading'),
          fetchpriority: attr(node, 'fetchpriority'),
          srcset: attr(node, 'srcset'),
          sizes: attr(node, 'sizes'),
          decorative: attr(node, 'aria-hidden') === 'true' || alt === '',
          nodeId,
        });
      }
      return;
    }
    if (tag === 'a') {
      const href = attr(node, 'href');
      if (href !== undefined) {
        const text = textOf(node) || collapseSpace(attr(node, 'aria-label') ?? '');
        content.links.push({ href, text, nodeId });
      }
    }
    if (tag === 'details') {
      const children = childrenOf(node);
      const summary = children.find((child) => child.kind === 'element' && child.tag === 'summary');
      if (summary !== undefined) {
        const question = textOf(summary);
        const answer = collapseSpace(
          [
            typeof node.text === 'string' ? node.text : '',
            ...children.filter((child) => child !== summary).map(textOf),
          ].join(' '),
        );
        if (question !== '' && answer !== '') content.faqs.push({ question, answer });
      }
    }
    if (tag === 'p' && content.firstParagraph === undefined) {
      const text = textOf(node);
      if (text.length >= 20) content.firstParagraph = text;
    }
    if (tag === 'strong' || tag === 'b' || tag === 'dt') {
      const text = textOf(node);
      if (text !== '' && PRICE.exec(text) === null) lastLabel = text;
    }
    if (typeof node.text === 'string') {
      const price = priceOf(node.text, lastLabel);
      if (price !== undefined) content.prices.push(price);
    }
    for (const child of childrenOf(node)) visitTree(child, nodeId);
  };

  const seen = new Set<string>();
  const visitNode = (node: Node): void => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    for (const value of Object.values(node.props)) {
      if (!isTreeRoot(value)) continue;
      const tree = value as unknown as TreeNode;
      for (const child of childrenOf(tree)) visitTree(child, node.id);
    }
    const slots = node.slots ?? {};
    const names = Object.keys(slots).sort((a, b) =>
      a === 'default' ? -1 : b === 'default' ? 1 : 0,
    );
    for (const name of names) {
      for (const childId of slots[name] ?? []) {
        const child = document.nodes[childId];
        if (child !== undefined) visitNode(child);
      }
    }
  };
  if (root !== undefined) visitNode(root);
  return content;
}
