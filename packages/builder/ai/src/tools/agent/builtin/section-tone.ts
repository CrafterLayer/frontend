import { colourHex, readPageKit, type KitColourKey } from '../page-kit';
import {
  isArabicLocale,
  readTree,
  rootIdOf,
  setProp,
  type TreeNode,
  type TreeRoot,
} from '../shared';
import type { AgentToolContext, AgentToolRun } from '../types';

/*
  A section as a dark, light, surface or accent band, in the page's own
  tokens (2026-10-13, ready scripts). "Make the hero dark" was a hand-written
  editTree: the model quoted the section's ground class and every text colour
  under it, one find/replace each — 200-600 output tokens and a repair round
  whenever one quote missed (tree-edits.ts) — and still left a text-white or a
  stone-900 that no longer read. One step does it now: the band's outer
  element takes the kit ground (`ck-inverse`, `ck-ground`, `ck-surface`,
  `ck-accent-fill`), whose ink, muted, accent text, cards and buttons are
  re-pointed by the kit itself (skeleton-from-plan.ts) and measured at AA;
  the text colours written for the old ground become the kit's text roles or
  go. Grounds inside it (a card, a button, a photo's veil) keep their own.
  Same commands on an Arabic page: only classes change, never direction.
*/

export const SECTION_TONES = ['dark', 'light', 'surface', 'accent'] as const;
export type SectionTone = (typeof SECTION_TONES)[number];

const TONE_CLASS: Readonly<Record<SectionTone, string>> = {
  dark: 'ck-inverse',
  light: 'ck-ground',
  surface: 'ck-surface',
  accent: 'ck-accent-fill',
};
const KIT_GROUNDS = new Set(Object.values(TONE_CLASS));
/** A node with one of these paints its own ground: what is inside it keeps its colours. */
const OWN_GROUNDS = new Set([...KIT_GROUNDS, 'ck-card', 'ck-btn']);
/** The kit's text roles, by the plan colour a class paints with. */
const TEXT_ROLES: readonly (readonly [KitColourKey, string])[] = [
  ['ink', 'ck-ink'],
  ['muted', 'ck-muted'],
  ['accentInk', 'ck-accent-ink'],
  ['accent', 'ck-accent-ink'],
];
const ROLE_VALUE =
  /^(?:accent|accent-text|success|success-text|surface|surface-inverse|text|text-inverse|text-muted)$/u;

interface Colour {
  readonly hex: string | undefined;
  readonly translucent: boolean;
}

/** A plain (no variant) colour utility of `prefix` (`bg`, `text`): what it paints, or undefined. */
function utilityColour(name: string, prefix: 'bg' | 'text'): Colour | undefined {
  // A variant (`md:`, `hover:`) only applies sometimes: the band's ground and ink are the plain ones.
  if (name.replace(/\[[^\]]*\]/gu, '').includes(':') || !name.startsWith(`${prefix}-`))
    return undefined;
  const value = name.slice(prefix.length + 1);
  const [base = '', alpha] = value.split('/');
  const translucent = alpha !== undefined;
  const bracket = /^\[(?:color:)?(#[0-9a-fA-F]{3,8}|(?:rgb|hsl|oklch)a?\(.+\))\]$/u.exec(base);
  if (bracket !== null) return { hex: colourHex(bracket[1] ?? ''), translucent };
  if (base === 'white' || base === 'black')
    return { hex: base === 'white' ? '#ffffff' : '#000000', translucent };
  if (ROLE_VALUE.test(base)) return { hex: undefined, translucent };
  if (/^[a-z]+-(?:50|[1-9]00|950)$/u.test(base)) return { hex: colourHex(base), translucent };
  return undefined;
}

function classes(node: TreeNode): readonly string[] {
  const className = (node as { className?: unknown }).className;
  return typeof className === 'string' ? className.split(/\s+/u).filter((name) => name !== '') : [];
}

function withClassList(node: TreeNode, list: readonly string[]): TreeNode {
  const rest = Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'className'));
  return (list.length === 0 ? rest : { ...rest, className: list.join(' ') }) as unknown as TreeNode;
}

function paintsGround(name: string): boolean {
  return (
    OWN_GROUNDS.has(name) ||
    utilityColour(name, 'bg') !== undefined ||
    /^(?:bg-gradient-to-|bg-linear-|bg-radial|from-|via-|to-)/u.test(name)
  );
}

/** A text colour written for the old ground, as the new ground reads it: a kit role, or nothing. */
function textOnNewGround(
  name: string,
  colours: Readonly<Record<KitColourKey, string>>,
): string | undefined | null {
  const colour = utilityColour(name, 'text');
  if (colour === undefined) return null; // not a text colour: kept as it is
  const role = TEXT_ROLES.find(
    ([key]) => colour.hex !== undefined && colours[key].toLowerCase() === colour.hex,
  )?.[1];
  if (role !== undefined) return role;
  // A softened white or black (text-white/70) was the old ground's secondary text.
  return colour.translucent && (colour.hex === '#ffffff' || colour.hex === '#000000')
    ? 'ck-muted'
    : undefined;
}

function retone(
  node: TreeNode,
  colours: Readonly<Record<KitColourKey, string>>,
  outer: string | undefined,
): TreeNode {
  const list = classes(node);
  if (outer === undefined && list.some(paintsGround)) return node;
  const kept: string[] = [];
  for (const name of list) {
    // The band's own ground and ink are the kit ground's: every other one on it goes.
    if (outer !== undefined && (paintsGround(name) || utilityColour(name, 'text') !== undefined))
      continue;
    const text = textOnNewGround(name, colours);
    if (text === null) kept.push(name);
    else if (text !== undefined && !kept.includes(text) && !list.includes(text)) kept.push(text);
  }
  if (outer !== undefined) kept.unshift(outer);
  const children: readonly TreeNode[] | undefined = (node as { children?: readonly TreeNode[] })
    .children;
  const nextChildren = children?.map((child) => retone(child, colours, undefined));
  const changedChildren =
    nextChildren?.some((child, index) => child !== children?.[index]) === true;
  const changedClasses =
    kept.length !== list.length || kept.some((name, index) => name !== list[index]);
  if (!changedChildren && !changedClasses) return node;
  const base = changedClasses ? withClassList(node, kept) : node;
  return changedChildren ? { ...base, children: nextChildren } : base;
}

const ESCAPE = /[.*+?^${}()|[\]\\]/gu;

/** A rule in the region css that paints the band's own ground, which a class could never override. */
function cssGround(css: string, outer: TreeNode): string | undefined {
  const id = (outer as { attributes?: Record<string, unknown> }).attributes?.['id'];
  const names = [
    ...classes(outer).map((name) => `\\.${name.replace(ESCAPE, '\\$&')}`),
    ...(typeof id === 'string' ? [`#${id.replace(ESCAPE, '\\$&')}`] : []),
  ];
  if (names.length === 0) return undefined;
  const own = new RegExp(`^(?:[a-z]+)?(?:${names.join('|')})+$`, 'u');
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)) {
    const selectors = (rule[1] ?? '').split(',').map((selector) => selector.trim());
    if (
      selectors.some((selector) => own.test(selector)) &&
      /(?:^|;)\s*background(?:-color|-image)?\s*:/u.test(rule[2] ?? '')
    ) {
      return `${(rule[1] ?? '').trim()}{…}`;
    }
  }
  return undefined;
}

/**
 * The region `id` as a `tone` band. Refused, with the fix, on a region that
 * is not composed, on a page with no kit to paint with, and on a band whose
 * own css paints its ground.
 */
export function toneSection(
  id: string,
  tone: SectionTone,
  context: AgentToolContext,
): AgentToolRun {
  const tree: TreeRoot | undefined = readTree(context, id);
  if (tree === undefined)
    return {
      ok: false,
      error: `"${id}" is not a composed region (customCode); tone works on those.`,
    };
  const pageCss = context.readProp(rootIdOf(context.kernel), 'pageCss');
  const kit = readPageKit(typeof pageCss === 'string' ? pageCss : '', isArabicLocale(context));
  if (!kit.hasKit) {
    return {
      ok: false,
      error:
        'this page has no page kit, so a tone has no tokens to paint with: apply one with theme.apply first, or style the element with element.style.',
    };
  }
  const css = context.readProp(id, 'css');
  const outers = tree.children.filter((child) => child.kind === 'element');
  if (outers.length === 0) return { ok: false, error: `"${id}" holds no element to tone.` };
  for (const outer of outers) {
    const rule = typeof css === 'string' ? cssGround(css, outer) : undefined;
    if (rule !== undefined) {
      return {
        ok: false,
        error: `"${id}" paints its ground in its own css (${rule}); change that rule's background with setProp css instead.`,
      };
    }
  }
  const target = TONE_CLASS[tone];
  const children = tree.children.map((child) =>
    child.kind === 'element' ? retone(child, kit.state.colours, target) : child,
  );
  if (children.every((child, index) => child === tree.children[index])) {
    return { ok: true, steps: [], note: `the section is already ${tone}` };
  }
  return { ok: true, steps: [setProp(id, 'tree', { ...tree, children })] };
}
