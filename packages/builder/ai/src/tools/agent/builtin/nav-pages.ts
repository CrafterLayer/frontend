import {
  fail,
  inputRecord,
  isElement,
  isRecord,
  mapTree,
  okParse,
  readTree,
  regionIds,
  setProp,
  topElement,
  unknownKeys,
  type TreeElementNode,
  type TreeNode,
} from '../shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolRun,
  type AgentToolStep,
} from '../types';
import {
  IN_PAGE,
  itemFrom,
  LIST_TAGS,
  menuLinkOf,
  menuRun,
  repointed,
  type MenuHref,
} from './nav-menu';

/**
 * nav.pages (T230b, 2026-10-12) — make the header's menu and the footer's link list name
 * the SITE's pages: one item per page, in the order given, each pointing at the page's
 * address, the current page's link marked `aria-current="page"`.
 *
 * The menu is found exactly as nav.sync finds it (nav-menu.ts) and its first item is the
 * template, so the links keep the page's own classes and structure. It also finds a menu
 * that already links pages (a relative address like "/about"), so a site's menus can be
 * linked again when its pages change. A page with no header or footer, or no menu in
 * them, is left as it is.
 */

export interface NavPage {
  readonly label: string;
  readonly href: string;
}

export interface NavPagesInput {
  readonly pages: readonly NavPage[];
  readonly current?: string | undefined;
}

const MIN_PAGES = 2;
const MAX_PAGES = 8;
const MAX_LABEL = 60;
/** A page of the site: "/", "/about", "/blog/news" (no scheme, no host, no query or fragment). */
const PAGE_ADDRESS = /^\/(?:[^\s?#/]+(?:\/[^\s?#/]+)*)?$/u;

/** A link to one of the site's pages: an address on this site, never `//host`. */
const SITE_PAGE: MenuHref = (href) => PAGE_ADDRESS.test(href);
const MENU_ENTRY: MenuHref = (href) => IN_PAGE(href) || SITE_PAGE(href);

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined)
    return fail<NavPagesInput>('input must be {pages:[{label,href}],current?}.');
  const unknown = unknownKeys(record, ['pages', 'current']);
  if (unknown.length > 0) return fail<NavPagesInput>(`unknown keys: ${unknown.join(', ')}.`);
  const list = record['pages'];
  if (!Array.isArray(list) || list.length < MIN_PAGES || list.length > MAX_PAGES) {
    return fail<NavPagesInput>(
      `pages must list ${String(MIN_PAGES)} to ${String(MAX_PAGES)} pages.`,
    );
  }
  const pages: NavPage[] = [];
  for (const [index, entry] of (list as readonly unknown[]).entries()) {
    const at = `page ${String(index + 1)}`;
    if (!isRecord(entry) || unknownKeys(entry, ['label', 'href']).length > 0) {
      return fail<NavPagesInput>(`${at} must be {label,href}.`);
    }
    const label =
      typeof entry['label'] === 'string' ? entry['label'].replace(/\s+/gu, ' ').trim() : '';
    const href = typeof entry['href'] === 'string' ? entry['href'].trim() : '';
    if (label === '' || label.length > MAX_LABEL) {
      return fail<NavPagesInput>(`${at}: label must be 1 to ${String(MAX_LABEL)} characters.`);
    }
    if (!PAGE_ADDRESS.test(href) || href.split('/').some((part) => part === '.' || part === '..')) {
      return fail<NavPagesInput>(`${at}: href must be a page address on this site, like "/about".`);
    }
    if (pages.some((page) => page.href === href)) {
      return fail<NavPagesInput>(`${at}: "${href}" is listed twice.`);
    }
    pages.push({ label, href });
  }
  const current = record['current'];
  if (
    current !== undefined &&
    (typeof current !== 'string' || !pages.some(({ href }) => href === current))
  ) {
    return fail<NavPagesInput>('current must be the href of one of the pages.');
  }
  return okParse<NavPagesInput>({ pages, ...(current === undefined ? {} : { current }) });
}

/** The link pointed at `page`: its href, and `aria-current` only on the current page's. */
function retarget(
  page: NavPage,
  current: string | undefined,
): (link: TreeElementNode) => TreeElementNode {
  return (link) => {
    const { 'aria-current': _was, ...kept } = link.attributes ?? {};
    void _was;
    return repointed(link, page.label, {
      ...kept,
      href: page.href,
      ...(page.href === current ? { 'aria-current': 'page' } : {}),
    });
  };
}

/**
 * The element with its run of menu items replaced by one item per page. A run counts as
 * nav.sync counts it — it links a section of this page (or, here, a page of the site),
 * and is two items long or sits in a nav/ul/ol.
 */
function rebuilt(node: TreeNode, input: NavPagesInput, anchors: ReadonlySet<string>): TreeNode {
  if (!isElement(node) || node.children === undefined) return node;
  const children = node.children;
  const found = menuRun(children, MENU_ENTRY);
  if (found === undefined) return node;
  const { first, last } = found;
  const run = children.slice(first, last + 1);
  const links = run.map((item) => menuLinkOf(item, MENU_ENTRY));
  // A language switcher (its links carry `lang`, T230c) points at the same pages and is no menu.
  if (links.some((link) => link?.attributes?.['lang'] !== undefined)) return node;
  const pointsHome = links.some((link) => {
    const href = link?.attributes?.['href'] ?? '';
    return SITE_PAGE(href) || anchors.has(href.slice(1));
  });
  if (!pointsHome || (run.length < 2 && !LIST_TAGS.has(node.tag))) return node;
  const template = run[0] as TreeElementNode;
  return {
    ...node,
    children: [
      ...children.slice(0, first),
      ...input.pages.map((page) => itemFrom(template, MENU_ENTRY, retarget(page, input.current))),
      ...children.slice(last + 1),
    ],
  };
}

function run(input: NavPagesInput, context: AgentToolContext): AgentToolRun {
  const regions = regionIds(context).map((id) => {
    const tree = readTree(context, id);
    return { id, tree, top: tree === undefined ? undefined : topElement(tree) };
  });
  const header = regions.find(({ top }) => top?.tag === 'header');
  const footer = regions.find(({ top }) => top?.tag === 'footer');
  const anchors = new Set(
    regions.flatMap((region) => {
      const anchor = region.top?.attributes?.['id'];
      return region === header || region === footer || anchor === undefined ? [] : [anchor];
    }),
  );
  const steps: AgentToolStep[] = [];
  for (const region of [header, footer]) {
    if (region?.tree === undefined) continue;
    const next = mapTree(region.tree, (node) => rebuilt(node, input, anchors));
    if (JSON.stringify(next) !== JSON.stringify(region.tree))
      steps.push(setProp(region.id, 'tree', next));
  }
  return steps.length > 0
    ? { ok: true, steps }
    : { ok: true, steps, note: 'no header or footer menu to link the pages from' };
}

export const navPagesTool = defineAgentTool<NavPagesInput>({
  name: 'nav.pages',
  lanes: ['edit'],
  summary: 'Link the site pages in menus',
  signature: '{pages:[{label,href}],current?:href}',
  parse,
  run,
});
