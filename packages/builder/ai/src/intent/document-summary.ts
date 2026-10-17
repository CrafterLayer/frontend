import type { BuilderDocument, Node, NodeId } from '@craftkit/builder-schema';

import type { IntentDocumentSummary } from './route-intent';

/**
 * What the router needs to know about a page, and nothing more.
 *
 * Three facts decide a route: whether anything is on the page, whether what
 * is there is only the skeleton an unfinished build left behind, and what the
 * sections are called. The router is pure and takes this summary rather than
 * a document so it can be tested with a literal — and so no rule in it can
 * grow a dependency on how a document happens to be stored.
 */
export function summarizeDocumentForIntent(document: BuilderDocument): IntentDocumentSummary {
  const root = document.nodes[document.rootId];
  const children = childrenOf(document, root);
  const nodeCount = countBelow(document, document.rootId);
  return Object.freeze({
    nodeCount,
    /*
      Only when EVERY node under the root is a top-level placeholder: one
      filled region, or one block nested anywhere, is content a person may
      want to keep, and the router must not offer to replace it.
    */
    placeholderOnly:
      children.length > 0 && nodeCount === children.length && children.every(isPlaceholder),
    sectionLabels: Object.freeze(children.map(labelOf)),
  });
}

function childrenOf(document: BuilderDocument, node: Node | undefined): Node[] {
  if (node?.slots === undefined) return [];
  return Object.values(node.slots)
    .flat()
    .map((id) => document.nodes[id])
    .filter((child): child is Node => child !== undefined);
}

/** Every node reachable under `rootId`, the root itself excluded; a cycle is walked once. */
function countBelow(document: BuilderDocument, rootId: NodeId): number {
  const seen = new Set<NodeId>([rootId]);
  const stack = childrenOf(document, document.nodes[rootId]);
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined || seen.has(node.id)) continue;
    seen.add(node.id);
    stack.push(...childrenOf(document, node));
  }
  return seen.size - 1;
}

/**
 * A section's name as a person would say it: a generated region's own label
 * (the scaffold names every region, "Pricing"), otherwise its block type in
 * words — `logoCloud` reads "logo cloud". A registered block's `label` prop is
 * NOT its name: on an announcement bar it is the badge text "New".
 */
function labelOf(node: Node): string {
  const label = node.props['label'];
  if (node.type === CUSTOM_CODE && typeof label === 'string' && label.trim() !== '') {
    return label.trim();
  }
  const type = node.type.slice(node.type.lastIndexOf('.') + 1);
  return type.replace(/([a-z\d])([A-Z])/gu, '$1 $2').toLowerCase();
}

const CUSTOM_CODE = 'customCode';
/** The tags build-scaffold lays a placeholder with: a shell and one heading. */
const SKELETON_TAGS: ReadonlySet<string> = new Set([
  'section',
  'header',
  'footer',
  'nav',
  'main',
  'article',
  'aside',
  'div',
  'h1',
  'h2',
  'h3',
]);
/** Attributes that are content: a link goes somewhere, an image shows something. */
const CONTENT_ATTRIBUTES: ReadonlySet<string> = new Set([
  'href',
  'src',
  'srcset',
  'action',
  'data-ck-scene',
]);
/** A placeholder is a handful of nodes; a hostile tree costs nothing past this. */
const PLACEHOLDER_MAX_NODES = 12;

/**
 * Whether a node is an unfilled region: a custom-code tree holding a shell and
 * at most one line of text — its heading — and nothing a person wrote into it.
 *
 * That is exactly what build-scaffold lays (builtins.ts, "ONE insertNode PER
 * SECTION… THE SECTION TITLE"), and what stays on the page when a fill is
 * skipped or a Stop lands mid-build (agent-audit §2 P0-3, P1-16). Anything
 * else — a registered block, a component or icon inside the tree, a link, a
 * paragraph — is content.
 */
function isPlaceholder(node: Node): boolean {
  if (node.type !== CUSTOM_CODE) return false;
  // A small DOM host can hold an entire authored canvas scene. Preserve its code.
  const js = node.props['js'];
  if (typeof js === 'string' && js.trim() !== '') return false;
  const tree: unknown = node.props['tree'];
  if (typeof tree !== 'object' || tree === null) return false;
  const stack: unknown[] = [...childList(tree)];
  let seen = 0;
  let texts = 0;
  while (stack.length > 0) {
    seen += 1;
    if (seen > PLACEHOLDER_MAX_NODES) return false;
    const entry = stack.pop();
    if (typeof entry !== 'object' || entry === null) return false;
    const element = entry as {
      kind?: unknown;
      tag?: unknown;
      text?: unknown;
      attributes?: unknown;
    };
    if (element.kind !== 'element') return false;
    if (typeof element.tag !== 'string' || !SKELETON_TAGS.has(element.tag)) return false;
    if (typeof element.text === 'string' && element.text.trim() !== '') texts += 1;
    if (texts > 1) return false;
    if (holdsContentAttribute(element.attributes)) return false;
    stack.push(...childList(entry));
  }
  return true;
}

function childList(value: object): readonly unknown[] {
  const children = (value as { children?: unknown }).children;
  return Array.isArray(children) ? (children as unknown[]) : [];
}

function holdsContentAttribute(attributes: unknown): boolean {
  if (typeof attributes !== 'object' || attributes === null) return false;
  return Object.keys(attributes).some((name) => CONTENT_ATTRIBUTES.has(name));
}
