/**
 * The one helper a block renderer uses to make its inner elements parts
 * (block-parts DESIGN §2.3).
 *
 * ```tsx
 * const part = blockPartProps({ node, props, isCanvas }, heroSchema.parts);
 * <h1 {...part('heading', { id: headingId, className: 'm-0 leading-tight' })}>{props.heading}</h1>
 * ```
 *
 * Pure: no React, no DOM. It returns plain attributes:
 *
 * - `className`: the block's own classes for the element, then the part's
 *   `all` entry, then its `this` entry, merged with `ckTwMerge` so a later
 *   class replaces a conflicting earlier one.
 * - `dir`: the stored override, else `auto` for text, rich and link parts, so
 *   an English line on an RTL page keeps its full stop at the end. Other kinds
 *   follow the page direction unless overridden.
 * - On the canvas only (law L5): `data-ck-part`, `data-ck-part-index` and
 *   `data-ck-bind`, which the hit test, the outline and the inline editor read.
 *   The published render gains only `dir` and the part classes.
 */
import type { Node } from '../document/types';
import { ckTwMerge } from '../style/tw-merge';
import {
  bindPathOf,
  formatPropPath,
  partStyleKey,
  type BlockPartKind,
  type BlockParts,
} from './block-parts';
import { readPartStyles } from './part-styles';

export interface PartAttributeOptions {
  /** The instance indices of a repeated part, one per `*` in its bind. */
  readonly index?: readonly number[] | undefined;
  /** The block's own classes for this element. */
  readonly className?: string | undefined;
  readonly id?: string | undefined;
}

export interface PartAttributes {
  className?: string;
  dir?: 'auto' | 'ltr' | 'rtl';
  id?: string;
  'data-ck-part'?: string;
  'data-ck-part-index'?: string;
  'data-ck-bind'?: string;
  // ── block-parts (2026-10-06) ── canvas only: the block's own classes, the Design tab's baseline
  'data-ck-part-own'?: string;
  // ── /block-parts ──
  // gsap-pixi additions (2026-10-08): canvas AND published — the timeline engine plays them.
  'data-ck-timeline'?: string;
  'data-ck-scrub'?: string;
}

/** The render facts the helper reads; a block passes its own render props. */
export interface PartRenderContext {
  readonly node: Node;
  readonly props: unknown;
  readonly isCanvas: boolean;
}

const TEXTUAL_KINDS: ReadonlySet<BlockPartKind> = new Set(['text', 'rich', 'link']);

/* An undeclared name is a block bug: loud under test, silent for a reader. */
function isTestMode(): boolean {
  const meta = import.meta as { env?: { MODE?: string } };
  return meta.env?.MODE === 'test';
}

// ── block-parts (2026-10-06) ──
/** Canvas only (law L5): the classes the block renderer gave a part, before any stored part style. */
export const PART_OWN_CLASSES_ATTRIBUTE = 'data-ck-part-own';

/** `@md:hover:text-xl` → { variant: '@md:hover', base: 'text-xl' }; colons inside brackets are not separators. */
function splitVariant(token: string): { readonly variant: string; readonly base: string } {
  let depth = 0;
  let cut = -1;
  for (let at = 0; at < token.length; at += 1) {
    const char = token[at];
    if (char === '[' || char === '(') depth += 1;
    else if (char === ']' || char === ')') depth = Math.max(depth - 1, 0);
    else if (char === ':' && depth === 0) cut = at;
  }
  return cut < 0 ? { variant: '', base: token } : { variant: token.slice(0, cut), base: token.slice(cut + 1) };
}

/* True when `override` replaces `own` on the same property (tailwind-merge's verdict on the bare utilities). */
function replaces(own: string, override: string): boolean {
  // A font size never takes the block's line height with it: `text-2xl` over `leading-relaxed` keeps both.
  if (own.replace(/^!/u, '').startsWith('leading-') && !override.replace(/^!/u, '').startsWith('leading-')) {
    return false;
  }
  return !ckTwMerge(own, override).split(' ').includes(own);
}

/**
 * The block's own classes, then the part's stored classes (fix pass,
 * 2026-10-06). A stored class replaces the block's class for the same
 * property in its own bucket, and a BASE (unprefixed) stored class also
 * replaces that property's responsive and container variants — the hero
 * body's `@md:text-xl` otherwise beat the `text-2xl` the quick bar wrote, and
 * the person saw nothing happen while an Undo step was recorded.
 */
export function mergePartClasses(own: string, stored: string): string {
  const overrides = stored.split(/\s+/u).filter((token) => token !== '').map(splitVariant);
  if (overrides.length === 0) return own.trim();
  const kept = own
    .split(/\s+/u)
    .filter((token) => token !== '')
    .filter((token) => {
      const mine = splitVariant(token);
      return !overrides.some(
        (override) => (override.variant === '' || override.variant === mine.variant) && replaces(mine.base, override.base),
      );
    });
  return [...kept, stored.trim()].filter((part) => part !== '').join(' ');
}
// ── /block-parts ──

/**
 * Build the `part(name, options)` function for one render of one block.
 * `parts` may be `undefined` (a block that declares none): every name is then
 * undeclared.
 */
export function blockPartProps(
  render: PartRenderContext,
  parts: BlockParts | undefined,
): (name: string, options?: PartAttributeOptions) => PartAttributes {
  const styles = readPartStyles(render.props);

  return (name, options = {}) => {
    const attributes: PartAttributes = {};
    if (options.id !== undefined) attributes.id = options.id;
    const decl = parts?.[name];
    if (decl === undefined) {
      if (isTestMode()) {
        throw new Error(
          `Block "${render.node.type}" renders part "${name}", which its schema does not declare.`,
        );
      }
      if (options.className !== undefined && options.className !== '') {
        attributes.className = options.className;
      }
      return attributes;
    }

    const index = options.index ?? [];
    const all = styles[partStyleKey({ part: name, index }, 'all')];
    const one = index.length > 0 ? styles[partStyleKey({ part: name, index }, 'this')] : undefined;

    /*
      With no stored entry the block's own string is passed through untouched,
      so migrating a block to parts never changes its published classes.
    */
    const own = options.className ?? '';
    const className =
      (all?.className ?? '') === '' && (one?.className ?? '') === ''
        ? own
        : mergePartClasses(own, ckTwMerge(all?.className ?? '', one?.className ?? ''));
    if (className !== '') attributes.className = className;

    const dir = one?.dir ?? all?.dir ?? (TEXTUAL_KINDS.has(decl.kind) ? 'auto' : undefined);
    if (dir !== undefined) attributes.dir = dir;

    // gsap-pixi additions (2026-10-08): a part's scroll-timeline recipe (`this` wins over `all`).
    const timeline = one?.timeline ?? all?.timeline;
    if (timeline !== undefined) {
      attributes['data-ck-timeline'] = timeline;
      const scrub = one?.timeline !== undefined ? one.scrub : all?.scrub;
      if (scrub !== undefined) attributes['data-ck-scrub'] = scrub ? 'true' : 'false';
    }

    if (render.isCanvas) {
      attributes['data-ck-part'] = name;
      if (index.length > 0) attributes['data-ck-part-index'] = index.join('.');
      const bind = bindPathOf(decl, index);
      if (bind !== undefined) attributes['data-ck-bind'] = formatPropPath(bind);
      // ── block-parts (2026-10-06) ──
      // The block's OWN classes, unmerged: the part Design tab shows them as
      // the baseline ("Padding 3" on the hero eyebrow, not "Not set").
      if (own.trim() !== '') attributes[PART_OWN_CLASSES_ATTRIBUTE] = own.trim();
      // ── /block-parts ──
    }
    return attributes;
  };
}

// ── block-parts (2026-10-06) ──
/**
 * Stamped on a part a PARENT block draws for one of its children — Tabs draws
 * each tab panel's `label` as its trigger. The canvas hit test then gives the
 * part to that child node, and the child's part lookup finds it, so the tab
 * text is selectable and editable in place like any other part.
 */
export const PART_OWNER_ATTRIBUTE = 'data-ck-part-owner';

export type ForwardedPartAttributes = PartAttributes & { 'data-ck-part-owner'?: string };

/**
 * The attributes of a part that belongs to `child` but is drawn by its parent:
 * the child's classes, direction and canvas stamps (`blockPartProps` over the
 * child's own props and parts), plus the owner stamp on the canvas only.
 */
export function forwardedPartProps(
  child: PartRenderContext,
  parts: BlockParts | undefined,
  name: string,
  options: PartAttributeOptions = {},
): ForwardedPartAttributes {
  const attributes: ForwardedPartAttributes = blockPartProps(child, parts)(name, options);
  if (child.isCanvas) attributes[PART_OWNER_ATTRIBUTE] = child.node.id;
  return attributes;
}
// ── /block-parts ──
