import { bindPathOf, getAtPropPath, partInstances, setAtPropPath } from '@craftkit/builder-schema';

import { partBlocks } from '../style-tools/part-address';
import {
  isElement,
  mapTree,
  readTree,
  regionIds,
  setProp,
  topElement,
  treeNodes,
  type TreeElementNode,
  type TreeNode,
  type TreeRoot,
} from '../tools/agent/shared';
import type { AgentToolContext, AgentToolStep } from '../tools/agent/types';
import { siteLanguage } from './languages';

/**
 * A site in several languages (2026-10-12) is one page per language, each at its language's
 * address (`/about` → `/ar/about`, the home `/` → `/ar`), linked as alternates for search and by
 * a visible language switcher. These are the deterministic parts a host runs around the agent:
 * no model writes an address, a link or a switcher.
 */

/** A version's address: the language tag before the page's own path. */
export function versionAddress(address: string, tag: string): string {
  const path =
    address === '/' || address === '' ? '' : address.startsWith('/') ? address : `/${address}`;
  return `/${tag.toLowerCase()}${path}`;
}

/** An internal link pointed at the same page's version, keeping any #fragment or ?query. */
function relink(href: string, addresses: ReadonlyMap<string, string>): string {
  const cut = href.search(/[?#]/u);
  const path = cut < 0 ? href : href.slice(0, cut);
  const next = addresses.get(path === '' ? href : path);
  return next === undefined || path === '' ? href : `${next}${cut < 0 ? '' : href.slice(cut)}`;
}

/**
 * Steps pointing every internal link on the page at the version in its language: `href`s in
 * region trees and the href of every link part of a registered block. `addresses` maps a source
 * page's address to its version's (`/about` → `/ar/about`).
 */
export function relinkSteps(
  context: AgentToolContext,
  addresses: ReadonlyMap<string, string>,
): readonly AgentToolStep[] {
  const steps: AgentToolStep[] = [];
  for (const id of regionIds(context)) {
    const tree = readTree(context, id);
    if (tree === undefined) continue;
    const next = mapTree(tree, (node) => {
      const href = isElement(node) ? node.attributes?.['href'] : undefined;
      if (!isElement(node) || typeof href !== 'string') return node;
      const moved = relink(href, addresses);
      return moved === href ? node : { ...node, attributes: { ...node.attributes, href: moved } };
    });
    if (next !== tree) steps.push(setProp(id, 'tree', next));
  }
  for (const block of partBlocks(context.kernel, context.readProp)) {
    const before = block.node.props as Readonly<Record<string, unknown>>;
    let props = before;
    for (const { decl, index } of partInstances(block.parts, before)) {
      if (decl.kind !== 'link') continue;
      const path = bindPathOf(decl, index, 'href');
      const href = path === undefined ? undefined : getAtPropPath(props, path);
      if (path === undefined || typeof href !== 'string') continue;
      const moved = relink(href, addresses);
      if (moved !== href) props = setAtPropPath(props, path, moved);
    }
    for (const key of Object.keys(props)) {
      if (props[key] !== before[key]) steps.push(setProp(block.id, key, props[key]));
    }
  }
  return steps;
}

// ── The language switcher ─────────────────────────────────────────────────────

export interface LanguageLink {
  readonly lang: string;
  readonly href: string;
}

/** "Language" in a page's language, for the switcher's accessible name. */
const LANGUAGE_WORD: Readonly<Record<string, string>> = {
  ar: 'اللغة',
  de: 'Sprache',
  es: 'Idioma',
  fa: 'زبان',
  fr: 'Langue',
  he: 'שפה',
  it: 'Lingua',
  nl: 'Taal',
  pt: 'Idioma',
  ru: 'Язык',
  tr: 'Dil',
  ur: 'زبان',
};

/** A `nav` whose links each carry `lang`: the switcher this module writes. */
export function isSwitcher(node: TreeNode): boolean {
  if (!isElement(node) || node.tag !== 'nav') return false;
  const links = node.children ?? [];
  return (
    links.length > 0 &&
    links.every(
      (link) =>
        isElement(link) && link.tag === 'a' && typeof link.attributes?.['lang'] === 'string',
    )
  );
}

/** The switcher for one page: every version by its own name, the page's own marked current. */
export function languageSwitcher(links: readonly LanguageLink[], current: string): TreeElementNode {
  const primary = current.toLowerCase().split('-')[0] ?? current;
  return {
    kind: 'element',
    tag: 'nav',
    className: 'flex items-center gap-3 text-sm',
    attributes: { 'aria-label': LANGUAGE_WORD[primary] ?? 'Language' },
    children: links.map(({ lang, href }) => ({
      kind: 'element',
      tag: 'a',
      className: lang === current ? 'font-semibold underline' : 'hover:underline',
      text: siteLanguage(lang)?.native ?? lang,
      attributes: {
        href,
        lang,
        ...(siteLanguage(lang)?.dir === 'rtl' ? { dir: 'rtl' } : {}),
        ...(lang === current ? { 'aria-current': 'page' } : {}),
      },
    })),
  };
}

function hasSwitcher(tree: TreeRoot): boolean {
  return treeNodes(tree).some(isSwitcher);
}

function withSwitcher(tree: TreeRoot, switcher: TreeElementNode, at: 'end' | 'start'): TreeRoot {
  if (hasSwitcher(tree)) return mapTree(tree, (node) => (isSwitcher(node) ? switcher : node));
  const top = topElement(tree);
  if (top === undefined) return tree;
  const children = top.children ?? [];
  const next: TreeElementNode = {
    ...top,
    children: at === 'end' ? [...children, switcher] : [switcher, ...children],
  };
  return { ...tree, children: tree.children.map((node) => (node === top ? next : node)) };
}

/**
 * The step placing (or refreshing) the language switcher: in the header when the page has one,
 * else the footer, else at the start of the first section.
 */
export function languageSwitcherSteps(
  context: AgentToolContext,
  links: readonly LanguageLink[],
  current: string,
): readonly AgentToolStep[] {
  const regions = regionIds(context).flatMap((id) => {
    const tree = readTree(context, id);
    return tree === undefined ? [] : [{ id, tree, tag: topElement(tree)?.tag }];
  });
  const switcher = languageSwitcher(links, current);
  const host =
    regions.find(({ tree }) => hasSwitcher(tree)) ??
    regions.find(({ tag }) => tag === 'header') ??
    regions.find(({ tag }) => tag === 'footer') ??
    regions[0];
  if (host === undefined) return [];
  const next = withSwitcher(
    host.tree,
    switcher,
    host.tag === 'header' || host.tag === 'footer' ? 'end' : 'start',
  );
  return next === host.tree ? [] : [setProp(host.id, 'tree', next)];
}
