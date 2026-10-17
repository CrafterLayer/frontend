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
import { IN_PAGE, itemFrom, LIST_TAGS, menuLinkOf, menuRun, repointed } from './nav-menu';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolRun,
  type AgentToolStep,
} from '../types';

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

// The menu's finding and re-pointing are nav-menu.ts's, shared with nav.pages (T230b).
function retarget(target: NavTarget): (link: TreeElementNode) => TreeElementNode {
  return (link) =>
    repointed(link, target.label, { ...(link.attributes ?? {}), href: `#${target.anchor}` });
}

/**
 * The element with its run of menu items replaced by one item per target.
 * A run counts only when it points at a section that exists, and is two
 * items long or sits in a nav/ul/ol — so a footer's legal links and a lone
 * `li > a` are never mistaken for the menu.
 */
function rebuilt(
  node: TreeNode,
  targets: readonly NavTarget[],
  anchors: ReadonlySet<string>,
): TreeNode {
  if (!isElement(node) || node.children === undefined) return node;
  const children = node.children;
  const found = menuRun(children, IN_PAGE);
  if (found === undefined) return node;
  const { first, last } = found;
  const run = children.slice(first, last + 1);
  const pointsHome = run.some((item) =>
    anchors.has((menuLinkOf(item, IN_PAGE)?.attributes?.['href'] ?? '').slice(1)),
  );
  if (!pointsHome || (run.length < 2 && !LIST_TAGS.has(node.tag))) return node;
  const template = run[0] as TreeElementNode;
  return {
    ...node,
    children: [
      ...children.slice(0, first),
      ...targets.map((target) => itemFrom(template, IN_PAGE, retarget(target))),
      ...children.slice(last + 1),
    ],
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
    const hero =
      region.tree !== undefined &&
      treeNodes(region.tree).some((node) => isElement(node) && node.tag === 'h1');
    if (label === undefined || hero) continue;
    targets.push({ label, anchor });
  }
  if (targets.length === 0)
    return { ok: false, error: 'no section has both an id and a label to link to.' };

  const steps: AgentToolStep[] = [];
  for (const region of [header, footer]) {
    if (region?.tree === undefined) continue;
    const next = mapTree(region.tree, (node) => rebuilt(node, targets, anchors));
    if (JSON.stringify(next) !== JSON.stringify(region.tree))
      steps.push(setProp(region.id, 'tree', next));
  }
  return steps.length === 0
    ? { ok: true, steps, note: 'the menus already match the sections' }
    : { ok: true, steps };
}

export const navSyncTool = defineAgentTool<NavSyncInput>({
  name: 'nav.sync',
  lanes: ['edit', 'build'],
  summary: 'Rebuild menus from sections',
  signature: '{}',
  parse,
  run,
});
