import { isElement, mapTree, treeNodes, type TreeElementNode, type TreeNode } from '../shared';

/*
  How a menu is found and re-pointed, shared by nav.sync (the page's sections) and
  nav.pages (the site's pages, T230b 2026-10-12). Moved out of nav-sync.ts unchanged: a
  menu is a RUN of link items among one element's children, each item a link (`a`) or an
  `li` wrapping exactly one link; its first item is the template every rebuilt item is
  cut from, so the page's own classes and structure survive. Which hrefs make a link a
  menu entry is the caller's (`MenuHref`): the brand's `#top` and the page's action
  button (`ck-btn`) never are.
*/

/** Which hrefs make a link a menu entry. */
export type MenuHref = (href: string) => boolean;

/** The tags a single-item run counts in: a lone `li > a` elsewhere is no menu. */
export const LIST_TAGS: ReadonlySet<string> = new Set(['nav', 'ul', 'ol']);

/** nav.sync's menu entries: in-page anchors, never the brand's `#top`. */
export const IN_PAGE: MenuHref = (href) => href.startsWith('#') && href !== '#' && href !== '#top';

/** A link that is a menu entry under `accepts`: never the page's action button. */
export function isMenuLink(node: TreeNode, accepts: MenuHref): node is TreeElementNode {
  if (!isElement(node) || node.tag !== 'a') return false;
  const href = node.attributes?.['href'] ?? '';
  return accepts(href) && !/\bck-btn\b/u.test(node.className ?? '');
}

/** The menu link an item is (`a`) or wraps alone (`li > a`), else undefined. */
export function menuLinkOf(node: TreeNode, accepts: MenuHref): TreeElementNode | undefined {
  if (isMenuLink(node, accepts)) return node;
  if (!isElement(node) || node.tag !== 'li') return undefined;
  const links = treeNodes({ kind: 'root', children: node.children ?? [] }).filter(
    (child) => isElement(child) && child.tag === 'a',
  );
  const only = links[0];
  return links.length === 1 && only !== undefined && isMenuLink(only, accepts) ? only : undefined;
}

/** The link re-pointed: new words and attributes, icons kept, old text spans dropped. */
export function repointed(
  link: TreeElementNode,
  label: string,
  attributes: Readonly<Record<string, string>>,
): TreeElementNode {
  const rest: TreeElementNode = {
    tag: link.tag,
    kind: link.kind,
    ...(link.className === undefined ? {} : { className: link.className }),
  };
  const icons = (link.children ?? []).filter((child) => !isElement(child));
  return {
    ...rest,
    text: label,
    attributes,
    ...(icons.length === 0 ? {} : { children: icons }),
  };
}

/** One item cut from the template, its menu link(s) re-pointed by `retarget`. */
export function itemFrom(
  template: TreeElementNode,
  accepts: MenuHref,
  retarget: (link: TreeElementNode) => TreeElementNode,
): TreeElementNode {
  if (isMenuLink(template, accepts)) return retarget(template);
  const next = mapTree({ kind: 'root', children: [template] }, (node) =>
    isMenuLink(node, accepts) ? retarget(node) : node,
  );
  return next.children[0] as TreeElementNode;
}

/** The first run of menu items among `children`, by index, or undefined when there is none. */
export function menuRun(
  children: readonly TreeNode[],
  accepts: MenuHref,
): { readonly first: number; readonly last: number } | undefined {
  const first = children.findIndex((child) => menuLinkOf(child, accepts) !== undefined);
  if (first < 0) return undefined;
  let last = first;
  for (
    let next = children[last + 1];
    next !== undefined && menuLinkOf(next, accepts) !== undefined;
    next = children[last + 1]
  ) {
    last += 1;
  }
  return { first, last };
}
