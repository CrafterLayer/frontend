import {
  fail,
  inputRecord,
  isElement,
  labelOf,
  mapTree,
  okParse,
  readTree,
  regionIds,
  setProp,
  topElement,
  treeNodes,
  unknownKeys,
  type TreeElementNode,
  type TreeNode,
} from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun, type AgentToolStep } from '../types';

/**
 * nav.sync — make the header's menu and the footer's link list name the
 * page's sections as they are now: every region with an `id` and a label,
 * in page order, except the header, the footer and the opening hero.
 *
 * A link list is any `nav` (in the header) or `nav`/`ul` (in the footer)
 * whose links all point at `#anchors`. Its first item is the template, so
 * the rebuilt links keep the page's own classes and structure.
 */

export type NavSyncInput = Readonly<Record<string, never>>;

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<NavSyncInput>('input must be {}.');
  if (unknownKeys(record, []).length > 0) return fail<NavSyncInput>('nav.sync takes no input: {}.');
  return okParse<NavSyncInput>({});
}

interface NavTarget {
  readonly label: string;
  readonly anchor: string;
}

const LIST_TAGS = new Set(['nav', 'ul', 'ol']);

/** An in-page link that is a menu entry: not the brand's `#top`, not the page's action button. */
function isMenuLink(node: TreeNode): node is TreeElementNode {
  if (!isElement(node) || node.tag !== 'a') return false;
  const href = node.attributes?.['href'] ?? '';
  return href.startsWith('#') && href !== '#' && href !== '#top' && !/\bck-btn\b/u.test(node.className ?? '');
}

/** The menu link an item is (`a`) or wraps alone (`li > a`), else undefined. */
function menuLinkOf(node: TreeNode): TreeElementNode | undefined {
  if (isMenuLink(node)) return node;
  if (!isElement(node) || node.tag !== 'li') return undefined;
  const links = treeNodes({ kind: 'root', children: node.children ?? [] }).filter((child) => isElement(child) && child.tag === 'a');
  const only = links[0];
  return links.length === 1 && only !== undefined && isMenuLink(only) ? only : undefined;
}

/** The link re-pointed: new words and anchor, icons kept, old text spans dropped. */
function pointed(link: TreeElementNode, target: NavTarget): TreeElementNode {
  const rest: TreeElementNode = { tag: link.tag, kind: link.kind, ...(link.className === undefined ? {} : { className: link.className }) };
  const icons = (link.children ?? []).filter((child) => !isElement(child));
  return {
    ...rest,
    text: target.label,
    attributes: { ...(link.attributes ?? {}), href: `#${target.anchor}` },
    ...(icons.length === 0 ? {} : { children: icons }),
  };
}

function itemFor(template: TreeElementNode, target: NavTarget): TreeElementNode {
  if (isMenuLink(template)) return pointed(template, target);
  const next = mapTree({ kind: 'root', children: [template] }, (node) => (isMenuLink(node) ? pointed(node, target) : node));
  return next.children[0] as TreeElementNode;
}

/**
 * The element with its run of menu items replaced by one item per target.
 * A run counts only when it points at a section that exists, and is two
 * items long or sits in a nav/ul/ol — so a footer's legal links and a lone
 * `li > a` are never mistaken for the menu.
 */
function rebuilt(node: TreeNode, targets: readonly NavTarget[], anchors: ReadonlySet<string>): TreeNode {
  if (!isElement(node) || node.children === undefined) return node;
  const children = node.children;
  const first = children.findIndex((child) => menuLinkOf(child) !== undefined);
  if (first < 0) return node;
  let last = first;
  for (let next = children[last + 1]; next !== undefined && menuLinkOf(next) !== undefined; next = children[last + 1]) {
    last += 1;
  }
  const run = children.slice(first, last + 1);
  const pointsHome = run.some((item) => anchors.has((menuLinkOf(item)?.attributes?.['href'] ?? '').slice(1)));
  if (!pointsHome || (run.length < 2 && !LIST_TAGS.has(node.tag))) return node;
  const template = run[0] as TreeElementNode;
  return {
    ...node,
    children: [...children.slice(0, first), ...targets.map((target) => itemFor(template, target)), ...children.slice(last + 1)],
  };
}

function run(_input: NavSyncInput, context: AgentToolContext): AgentToolRun {
  const regions = regionIds(context).map((id) => {
    const tree = readTree(context, id);
    return { id, tree, top: tree === undefined ? undefined : topElement(tree) };
  });
  const header = regions.find(({ top }) => top?.tag === 'header');
  const footer = regions.find(({ top }) => top?.tag === 'footer');
  if (header === undefined && footer === undefined) {
    return { ok: false, error: 'this page has no header or footer region to sync.' };
  }
  const anchors = new Set<string>();
  const targets: NavTarget[] = [];
  for (const region of regions) {
    if (region === header || region === footer || region.top === undefined) continue;
    const anchor = region.top.attributes?.['id'];
    if (anchor === undefined) continue;
    anchors.add(anchor);
    const label = labelOf(context, region.id);
    // The opening hero (the page's h1) is where the page starts, not a menu entry.
    const hero = region.tree !== undefined && treeNodes(region.tree).some((node) => isElement(node) && node.tag === 'h1');
    if (label === undefined || hero) continue;
    targets.push({ label, anchor });
  }
  if (targets.length === 0) return { ok: false, error: 'no section has both an id and a label to link to.' };

  const steps: AgentToolStep[] = [];
  for (const region of [header, footer]) {
    if (region?.tree === undefined) continue;
    const next = mapTree(region.tree, (node) => rebuilt(node, targets, anchors));
    if (JSON.stringify(next) !== JSON.stringify(region.tree)) steps.push(setProp(region.id, 'tree', next));
  }
  return steps.length === 0 ? { ok: true, steps, note: 'the menus already match the sections' } : { ok: true, steps };
}

export const navSyncTool = defineAgentTool<NavSyncInput>({
  name: 'nav.sync',
  lanes: ['edit', 'build'],
  summary: 'Rebuild menus from sections',
  signature: '{}',
  parse,
  run,
});
