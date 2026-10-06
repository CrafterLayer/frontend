/**
 * Block parts: the named inner elements of a registered block
 * (block-parts DESIGN §1, §2.1).
 *
 * A part is identified by `(nodeId, part, index)`. `part` is the declared,
 * locale-independent name; `index` holds the array indices of a repeated part,
 * one per `*` in its bind. The declaration is DATA in the block schema, so the
 * canvas, the Inspector, Layers and the agent all address the same elements
 * the same way, and nothing infers a part from a prop's name (law L3).
 *
 * A part's value lives in an ordinary prop (law L2): `bind` is a dotted path
 * into the block's props where `*` stands for one array level, for example
 * `'heading'`, `'items.*.title'`, `{ text: 'link.label', href: 'link.href' }`.
 */
import type { z } from 'zod';

import { builderError } from '../errors';
import { isRichTextSchema } from '../rich-text/rich-text';
import type { StyleSectorId } from '../style/catalogue';
import type { StyleLabels } from '../style/types';
import type { BlockSchema } from './define-block-schema';
import { getAtPropPath, type PropPath } from './prop-path';

export type { PropPath } from './prop-path';

/** What a part is; it decides the canvas gesture, the Inspector row and the quick bar. */
export type BlockPartKind = 'text' | 'rich' | 'link' | 'image' | 'list' | 'item' | 'box';

/** Where a part's value lives in the block's props. `*` stands for one array level. */
export type PartBind =
  | string
  | { readonly text: string; readonly href: string }
  | { readonly src: string; readonly alt?: string | undefined };

/** One declared part. */
export interface BlockPartDecl {
  readonly kind: BlockPartKind;
  /** Dotted prop path; `*` = one array level. Absent only for `box`. */
  readonly bind?: PartBind | undefined;
  /** Display only: `{ en, ar }`. */
  readonly label: StyleLabels;
  /** Words the agent may use for this part, in any locale: `['title', 'العنوان']`. */
  readonly aliases?: readonly string[] | undefined;
  /** Text parts: Shift+Enter inserts `\n`; Enter alone still commits. */
  readonly multiline?: boolean | undefined;
  /** Item parts: the list part this item belongs to. */
  readonly list?: string | undefined;
  /** The style sectors the panel and quick bar offer (a default by kind when absent). */
  readonly styleSections?: readonly StyleSectorId[] | undefined;
}

/** A block's parts, by name. */
export type BlockParts = Readonly<Record<string, BlockPartDecl>>;

/** A part instance inside one node: the part's name plus the indices of its `*` levels. */
export interface PartRef {
  readonly part: string;
  readonly index: readonly number[];
}

/** One part instance that exists in a node's props, in declaration then document order. */
export interface PartInstance extends PartRef {
  /** The formatted primary bind path (`'items.2.title'`); absent for a box. */
  readonly bind?: string;
  readonly decl: BlockPartDecl;
}

/** A part name: ASCII camelCase segments joined by dots (`heading`, `item.title`). */
export const PART_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/;

/* One bind segment: an identifier or `*`. */
const BIND_SEGMENT = /^(?:\*|[A-Za-z_$][A-Za-z0-9_$]*)$/;
const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Which bound value of a part: plain parts have `text`; links add `href`; images have `src`/`alt`. */
export type PartValueSlot = 'text' | 'href' | 'src' | 'alt';

/** The raw (unexpanded) bind pattern for one slot of a declaration, or undefined. */
export function bindPatternOf(decl: BlockPartDecl, which?: PartValueSlot): string | undefined {
  const bind = decl.bind;
  if (bind === undefined) return undefined;
  if (typeof bind === 'string') {
    return which === undefined || which === 'text' ? bind : undefined;
  }
  if ('href' in bind) {
    if (which === undefined || which === 'text') return bind.text;
    return which === 'href' ? bind.href : undefined;
  }
  if (which === undefined || which === 'src') return bind.src;
  return which === 'alt' ? bind.alt : undefined;
}

/**
 * The concrete prop path of one part instance. Each `*` takes the next entry
 * of `index`; `undefined` when the slot is not bound, or when `index` does not
 * hold exactly one entry per `*`.
 */
export function bindPathOf(
  decl: BlockPartDecl,
  index: readonly number[],
  which?: PartValueSlot,
): PropPath | undefined {
  const pattern = bindPatternOf(decl, which);
  if (pattern === undefined) return undefined;
  const path: (string | number)[] = [];
  let used = 0;
  for (const segment of pattern.split('.')) {
    if (segment === '*') {
      const at = index[used];
      if (at === undefined) return undefined;
      path.push(at);
      used += 1;
    } else {
      path.push(segment);
    }
  }
  return used === index.length ? path : undefined;
}

/** `['items', 2, 'title']` → `'items.2.title'`. */
export function formatPropPath(path: PropPath): string {
  return path.map(String).join('.');
}

/** `'items.2.title'` → `['items', 2, 'title']`: an all-digit segment becomes an index. */
export function parsePropPath(text: string): PropPath {
  if (text === '') return [];
  return text.split('.').map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

/**
 * The key of a part's entry in the block's `partStyles` prop. `all` is the
 * part's name (every instance); `this` adds the instance index (`item.title@2`).
 * A part with no index has one instance, so both scopes give its name.
 */
export function partStyleKey(ref: PartRef, scope: 'all' | 'this'): string {
  return scope === 'this' && ref.index.length > 0 ? `${ref.part}@${ref.index.join('.')}` : ref.part;
}

/** A block's declared parts; `{}` when it declares none. */
export function blockPartsOf(schema: BlockSchema | undefined): BlockParts {
  return schema?.parts ?? {};
}

/* Expand a bind pattern over the arrays present in `props`. */
function expandPattern(
  pattern: string,
  props: Readonly<Record<string, unknown>>,
): { readonly path: PropPath; readonly index: readonly number[] }[] {
  let frontier: { path: (string | number)[]; index: number[] }[] = [{ path: [], index: [] }];
  for (const segment of pattern.split('.')) {
    if (segment !== '*') {
      for (const entry of frontier) entry.path.push(segment);
      continue;
    }
    const next: { path: (string | number)[]; index: number[] }[] = [];
    for (const entry of frontier) {
      const array = getAtPropPath(props, entry.path);
      if (!Array.isArray(array)) continue;
      for (let at = 0; at < array.length; at += 1) {
        next.push({ path: [...entry.path, at], index: [...entry.index, at] });
      }
    }
    frontier = next;
  }
  return frontier;
}

/**
 * Every part instance present in `props`, in declaration order and, within a
 * repeated part, in array order. A bound part exists while its primary value
 * does (a cleared optional prop removes it); a box always exists once.
 */
export function partInstances(
  parts: BlockParts,
  props: Readonly<Record<string, unknown>>,
): readonly PartInstance[] {
  const instances: PartInstance[] = [];
  for (const [part, decl] of Object.entries(parts)) {
    const pattern = bindPatternOf(decl);
    if (pattern === undefined) {
      instances.push({ part, index: [], decl });
      continue;
    }
    for (const { path, index } of expandPattern(pattern, props)) {
      if (getAtPropPath(props, path) === undefined) continue;
      instances.push({ part, index, bind: formatPropPath(path), decl });
    }
  }
  return instances;
}

/** Whether `ref` names a part instance present in `props`. */
export function hasPartInstance(
  parts: BlockParts,
  props: Readonly<Record<string, unknown>>,
  ref: PartRef,
): boolean {
  return partInstances(parts, props).some(
    (instance) =>
      instance.part === ref.part &&
      instance.index.length === ref.index.length &&
      instance.index.every((at, position) => at === ref.index[position]),
  );
}

// ── Schema walking ───────────────────────────────────────────────────────────

interface ZodDefLike {
  readonly type: string;
  readonly innerType?: z.ZodType;
  readonly shape?: Record<string, z.ZodType>;
  readonly element?: z.ZodType;
}

const WRAPPERS: ReadonlySet<string> = new Set([
  'optional',
  'default',
  'nullable',
  'prefault',
  'readonly',
  'catch',
]);

function defOf(schema: z.ZodType): ZodDefLike {
  return schema._zod.def;
}

/** Strip optional/default/nullable (and readonly/prefault/catch) wrappers. */
export function unwrapPropSchema(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (;;) {
    const def = defOf(current);
    if (!WRAPPERS.has(def.type) || def.innerType === undefined) return current;
    current = def.innerType;
  }
}

/**
 * The schema a bind pattern reaches inside a props schema, or a sentence
 * saying where it stops. Wrappers are unwrapped at each step; `*` must sit on
 * an array; every other segment must be a key of an object.
 */
function walkBind(
  props: z.ZodType,
  pattern: string,
): { readonly ok: true; readonly schema: z.ZodType } | { readonly ok: false; readonly why: string } {
  if (pattern === '') return { ok: false, why: 'the bind is empty' };
  let current = props;
  const walked: string[] = [];
  for (const segment of pattern.split('.')) {
    if (!BIND_SEGMENT.test(segment) || RESERVED_SEGMENTS.has(segment)) {
      return { ok: false, why: `segment "${segment}" is not a prop key or "*"` };
    }
    const def = defOf(unwrapPropSchema(current));
    const at = walked.length === 0 ? 'the props' : `"${walked.join('.')}"`;
    if (segment === '*') {
      if (def.type !== 'array' || def.element === undefined) {
        return { ok: false, why: `"*" must sit on an array, but ${at} is ${def.type}` };
      }
      current = def.element;
    } else {
      if (def.type !== 'object' || def.shape === undefined) {
        return { ok: false, why: `${at} is ${def.type}, not an object with "${segment}"` };
      }
      const next = def.shape[segment];
      if (next === undefined) {
        return { ok: false, why: `${at} has no prop "${segment}"` };
      }
      current = next;
    }
    walked.push(segment);
  }
  return { ok: true, schema: current };
}

/**
 * The (unwrapped) schema at a bind pattern such as `'items.*'`, or undefined.
 * Consumers use it to find an item schema for `planPartListOp`.
 */
export function propSchemaAt(props: z.ZodType, pattern: string): z.ZodType | undefined {
  const walked = walkBind(props, pattern);
  return walked.ok ? unwrapPropSchema(walked.schema) : undefined;
}

function leafType(schema: z.ZodType): string {
  return defOf(unwrapPropSchema(schema)).type;
}

/**
 * The registration gate (DESIGN §2.1). Throws `block/non-json-props` at
 * `['parts', name]` for the first declaration that cannot work:
 *
 * - a name outside `PART_NAME_PATTERN`, or a label without both locales;
 * - a bind that does not resolve through the props shape (wrappers unwrapped,
 *   `*` only on arrays), or whose leaf does not fit the kind: a string for
 *   text, link text and href and image src/alt; rich text for rich; an array
 *   for list; `<array>.*` for item;
 * - a box with a bind, or any other kind without one of the right shape;
 * - an item whose `list` does not name a list part binding the same array;
 * - an `inlineEditable` prop that no text or rich part binds exactly.
 */
export function validateBlockParts(
  type: string,
  props: z.ZodType,
  parts: BlockParts,
  inlineEditable?: string,
): void {
  function refuse(name: string, why: string): never {
    throw builderError('block/non-json-props', `Block "${type}" part "${name}": ${why}.`, [
      'parts',
      name,
    ]);
  }

  function expectLeaf(name: string, pattern: string, wanted: 'string' | 'rich' | 'array'): void {
    const walked = walkBind(props, pattern);
    if (!walked.ok) refuse(name, `bind "${pattern}" does not resolve: ${walked.why}`);
    if (wanted === 'rich') {
      if (!isRichTextSchema(walked.schema)) refuse(name, `bind "${pattern}" is not rich text`);
      return;
    }
    const found = leafType(walked.schema);
    if (found !== wanted) refuse(name, `bind "${pattern}" ends on ${found}, not a ${wanted}`);
  }

  function checkBind(name: string, decl: BlockPartDecl): void {
    const bind = decl.bind;
    switch (decl.kind) {
      case 'box': {
        if (bind !== undefined) refuse(name, 'a box part has no data, so it takes no bind');
        return;
      }
      case 'text':
      case 'rich':
      case 'list': {
        if (typeof bind !== 'string') refuse(name, `a ${decl.kind} part binds one dotted prop path`);
        const wanted = decl.kind === 'text' ? 'string' : decl.kind === 'rich' ? 'rich' : 'array';
        expectLeaf(name, bind, wanted);
        return;
      }
      case 'item': {
        if (typeof bind !== 'string' || !bind.endsWith('.*')) {
          refuse(name, 'an item part binds "<array>.*", e.g. "items.*"');
        }
        const arrayPath = bind.slice(0, -2);
        expectLeaf(name, arrayPath, 'array');
        if (decl.list !== undefined) {
          const owner = parts[decl.list];
          if (owner?.kind !== 'list') {
            refuse(name, `list "${decl.list}" is not a list part of this block`);
          }
          if (owner.bind !== arrayPath) {
            refuse(name, `list "${decl.list}" binds ${JSON.stringify(owner.bind ?? null)}, not "${arrayPath}"`);
          }
        }
        return;
      }
      case 'link': {
        if (typeof bind !== 'object' || !('href' in bind)) {
          refuse(name, 'a link part binds { text, href }');
        }
        expectLeaf(name, bind.text, 'string');
        expectLeaf(name, bind.href, 'string');
        return;
      }
      case 'image': {
        if (typeof bind !== 'object' || !('src' in bind)) {
          refuse(name, 'an image part binds { src, alt? }');
        }
        expectLeaf(name, bind.src, 'string');
        if (bind.alt !== undefined) expectLeaf(name, bind.alt, 'string');
        return;
      }
      default: {
        refuse(name, `unknown kind "${String((decl as { kind: unknown }).kind)}"`);
      }
    }
  }

  for (const [name, decl] of Object.entries(parts)) {
    if (!PART_NAME_PATTERN.test(name)) {
      refuse(name, 'the name must be camelCase ASCII segments joined by dots, e.g. "item.title"');
    }
    if (decl.label.en.trim() === '' || decl.label.ar.trim() === '') {
      refuse(name, 'the label needs both an English and an Arabic text');
    }
    if (decl.aliases?.some((alias) => alias.trim() === '') === true) {
      refuse(name, 'an alias is empty');
    }
    if (decl.list !== undefined && decl.kind !== 'item') {
      refuse(name, 'only an item part names a list');
    }
    checkBind(name, decl);
  }

  if (inlineEditable !== undefined && Object.keys(parts).length > 0) {
    const bound = Object.values(parts).some(
      (decl) => (decl.kind === 'text' || decl.kind === 'rich') && decl.bind === inlineEditable,
    );
    if (!bound) {
      throw builderError(
        'block/non-json-props',
        `Block "${type}" declares inlineEditable "${inlineEditable}", but no text or rich part binds it — declare a part with bind "${inlineEditable}".`,
        ['parts', inlineEditable],
      );
    }
  }
}
