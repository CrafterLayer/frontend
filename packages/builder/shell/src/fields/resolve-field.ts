import type { z } from 'zod';

import {
  bindPatternOf,
  imagePropSchema,
  isPartStylesSchema,
  type BlockParts,
  type BlockPropertyKind,
  type FieldTypeDef,
  type RegistryRead,
} from '@craftkit/builder-schema';

/**
 * Field resolution (007 contract §1, extended by block-parts DESIGN §2.10),
 * in this order:
 *
 *  1. an explicit DECLARED kind (`propertyGroups[key].kind`);
 *  2. a PART-DECLARED binding — a link part's `{ text, href }` parent object
 *     becomes a LinkField and an image part's `src` an ImageUrlField, inside
 *     repeater items too (declaration-driven through the block's `parts`,
 *     never inferred from a prop's name);
 *  3. a contributed field type (highest `match(schema)` score > 0, ties by
 *     REGISTRATION ORDER);
 *  4. the default control for the schema's SHAPE, after unwrapping
 *     optional/default/nullable;
 *  5. a read-only HUMAN SUMMARY ("3 items", "4 fields") — never raw JSON.
 */
export type DefaultControl =
  | 'text'
  | 'textarea'
  | 'select'
  | 'switch'
  | 'number'
  | 'repeater'
  | 'object'
  | 'key-value'
  | 'link'
  | 'image-url'
  | 'asset'
  | 'part-styles'
  | 'color-role'
  | 'motion'
  | 'utility-classes';

export type ResolvedField =
  | { kind: 'contributed'; def: FieldTypeDef }
  | { kind: 'default'; control: DefaultControl }
  | { kind: 'readonly' };

/**
 * Where a row sits, for the part-declared bindings (step 2): the block's
 * declared parts and the row's prop path relative to `props` — numbers for
 * array indices (`['items', 2, 'action']`).
 */
export interface FieldResolutionContext {
  readonly parts?: BlockParts | undefined;
  readonly propPath?: readonly (string | number)[] | undefined;
}

/** What a part declaration says a row is (step 2). */
export type PartBinding =
  | {
      readonly kind: 'link';
      /** The label key inside the bound object; absent when the row is the href string itself. */
      readonly textKey?: string | undefined;
      readonly hrefKey?: string | undefined;
    }
  | { readonly kind: 'image' };

/** A string at or under this many characters is one line; longer, or unbounded, is a paragraph. */
export const SHORT_TEXT_MAX = 120;

/**
 * The zod-4 introspection surface this module relies on: every schema exposes
 * `_zod.def.type`; wrapper defs carry `innerType`; enum defs carry `entries`.
 */
interface IntrospectableDef {
  type: string;
  innerType?: z.ZodType;
  entries?: Record<string, unknown>;
  shape?: Record<string, z.ZodType>;
  options?: readonly z.ZodType[];
  values?: readonly unknown[];
  valueType?: z.ZodType;
}

interface IntrospectableBag {
  maximum?: number;
  format?: string;
}

function defOf(schema: z.ZodType): IntrospectableDef {
  return schema._zod.def;
}

function bagOf(schema: z.ZodType): IntrospectableBag {
  return schema._zod.bag;
}

/** Peel optional/default/nullable wrappers down to the core schema (f2). */
export function unwrapSchema(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (;;) {
    const def = defOf(current);
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return current;
    }
    current = def.innerType;
  }
}

/** Enum member strings for select controls; empty for non-enum schemas. */
export function enumValuesOf(schema: z.ZodType): string[] {
  const def = defOf(unwrapSchema(schema));
  if (def.type !== 'enum' || def.entries === undefined) {
    return [];
  }
  return Object.values(def.entries).filter((value): value is string => typeof value === 'string');
}

/**
 * Property schemas of a block's `props` object, in DECLARATION ORDER (the
 * inspector's row order). Empty for anything that is not a zod object.
 */
export function propsShapeOf(schema: z.ZodType): Record<string, z.ZodType> {
  const def = defOf(schema);
  if (def.type !== 'object') {
    return {};
  }
  return def.shape ?? {};
}

/** A string schema as one line (`text`) or a paragraph (`textarea`), from its bounds. */
function stringControl(core: z.ZodType): DefaultControl {
  const bag = bagOf(core);
  // A formatted string (url, email, a pattern) is an identifier, not prose.
  if (bag.format !== undefined) return 'text';
  const max = bag.maximum;
  return max !== undefined && Number.isFinite(max) && max <= SHORT_TEXT_MAX ? 'text' : 'textarea';
}

/** A string or a string literal, after unwrapping. */
function isStringLike(schema: z.ZodType): boolean {
  const def = defOf(unwrapSchema(schema));
  if (def.type === 'string') return true;
  if (def.type === 'literal') {
    return (def.values ?? []).length > 0 && (def.values ?? []).every((v) => typeof v === 'string');
  }
  return false;
}

/** `imagePropSchema` by identity, or by its shape: `{ assetId }` | `{ absent, reason }`. */
export function isImagePropSchema(schema: z.ZodType): boolean {
  const core = unwrapSchema(schema);
  if (core === imagePropSchema) return true;
  const def = defOf(core);
  if (def.type !== 'union' || def.options?.length !== 2) return false;
  const keys = def.options.map((option) =>
    Object.keys(propsShapeOf(unwrapSchema(option)))
      .sort()
      .join(','),
  );
  return keys.includes('assetId') && keys.includes('absent,reason');
}

/** A record whose values are plain strings (nullable allowed) — what KeyValueField writes. */
function isStringRecord(core: z.ZodType): boolean {
  const valueType = defOf(core).valueType;
  return valueType !== undefined && defOf(unwrapSchema(valueType)).type === 'string';
}

/**
 * The default resolution for a schema, ignoring contributions and parts. Also
 * the containment target: a contributed field that fails to load or throws
 * falls back to THIS resolution for that one property (f3).
 */
export function defaultFieldFor(schema: z.ZodType): ResolvedField {
  // Markers first: they are declarations carried by the schema itself.
  if (isPartStylesSchema(schema)) {
    return { kind: 'default', control: 'part-styles' };
  }
  if (isImagePropSchema(schema)) {
    return { kind: 'default', control: 'asset' };
  }
  const core = unwrapSchema(schema);
  const def = defOf(core);
  switch (def.type) {
    case 'string':
      return { kind: 'default', control: stringControl(core) };
    case 'enum':
      return { kind: 'default', control: 'select' };
    case 'boolean':
      return { kind: 'default', control: 'switch' };
    case 'number':
      return { kind: 'default', control: 'number' };
    case 'array':
      return { kind: 'default', control: 'repeater' };
    case 'union':
      // `blankOr(pattern)` = `'' | string.regex(…)`: a string the door checks.
      return (def.options ?? []).length > 0 && (def.options ?? []).every(isStringLike)
        ? { kind: 'default', control: 'text' }
        : { kind: 'readonly' };
    case 'object':
      return Object.keys(def.shape ?? {}).length > 0
        ? { kind: 'default', control: 'object' }
        : { kind: 'readonly' };
    case 'record':
      return isStringRecord(core)
        ? { kind: 'default', control: 'key-value' }
        : { kind: 'readonly' };
    default:
      return { kind: 'readonly' };
  }
}

/** Whether a bind pattern (`items.*.action`) names this concrete row path (`['items', 2, 'action']`). */
function patternMatches(pattern: string, path: readonly (string | number)[]): boolean {
  const segments = pattern.split('.');
  if (segments.length !== path.length) return false;
  return segments.every((segment, at) => {
    const actual = path[at];
    return segment === '*' ? typeof actual === 'number' : actual === segment;
  });
}

function splitLeaf(pattern: string): { readonly parent: string; readonly leaf: string } {
  const at = pattern.lastIndexOf('.');
  return at < 0
    ? { parent: '', leaf: pattern }
    : { parent: pattern.slice(0, at), leaf: pattern.slice(at + 1) };
}

/**
 * Step 2: what the block's PART declarations say this row is.
 *
 * - A link part whose text and href share a parent object
 *   (`{ text: 'link.label', href: 'link.href' }`) makes the OBJECT row `link`
 *   a LinkField over its `label` and `href` keys.
 * - A link part whose href stands alone (`{ text: 'linkLabel', href: 'href' }`)
 *   makes the href STRING row a LinkField in href-only mode.
 * - An image part's `src` makes that string row an ImageUrlField.
 */
export function partBindingFor(
  parts: BlockParts | undefined,
  propPath: readonly (string | number)[] | undefined,
): PartBinding | undefined {
  if (parts === undefined || propPath === undefined || propPath.length === 0) return undefined;
  for (const decl of Object.values(parts)) {
    if (decl.kind === 'link') {
      const text = bindPatternOf(decl, 'text');
      const href = bindPatternOf(decl, 'href');
      if (text === undefined || href === undefined) continue;
      const textSplit = splitLeaf(text);
      const hrefSplit = splitLeaf(href);
      if (
        textSplit.parent !== '' &&
        textSplit.parent === hrefSplit.parent &&
        patternMatches(textSplit.parent, propPath)
      ) {
        return { kind: 'link', textKey: textSplit.leaf, hrefKey: hrefSplit.leaf };
      }
      if (patternMatches(href, propPath)) {
        return { kind: 'link' };
      }
    } else if (decl.kind === 'image') {
      const src = bindPatternOf(decl, 'src');
      if (src !== undefined && patternMatches(src, propPath)) {
        return { kind: 'image' };
      }
    }
  }
  return undefined;
}

function declaredResolution(
  schema: z.ZodType,
  declaredKind: BlockPropertyKind,
): ResolvedField | undefined {
  switch (declaredKind) {
    case 'color-role':
      return { kind: 'default', control: 'color-role' };
    case 'utility-classes':
      return { kind: 'default', control: 'utility-classes' };
    case 'motion':
      return { kind: 'default', control: 'motion' };
    case 'multiline':
      return { kind: 'default', control: 'textarea' };
    case 'image':
      return isImagePropSchema(schema)
        ? { kind: 'default', control: 'asset' }
        : { kind: 'default', control: 'image-url' };
    case 'link':
      return { kind: 'default', control: 'link' };
    case 'part-styles':
      return { kind: 'default', control: 'part-styles' };
    default:
      return undefined;
  }
}

function bindingResolution(schema: z.ZodType, binding: PartBinding): ResolvedField | undefined {
  const type = defOf(unwrapSchema(schema)).type;
  if (binding.kind === 'image') {
    return type === 'string' ? { kind: 'default', control: 'image-url' } : undefined;
  }
  if (binding.textKey !== undefined) {
    return type === 'object' ? { kind: 'default', control: 'link' } : undefined;
  }
  return type === 'string' ? { kind: 'default', control: 'link' } : undefined;
}

export function resolveField(
  registry: RegistryRead,
  schema: z.ZodType,
  declaredKind?: BlockPropertyKind,
  context?: FieldResolutionContext,
): ResolvedField {
  if (declaredKind !== undefined) {
    const declared = declaredResolution(schema, declaredKind);
    if (declared !== undefined) return declared;
  }

  const binding = partBindingFor(context?.parts, context?.propPath);
  if (binding !== undefined) {
    const bound = bindingResolution(schema, binding);
    if (bound !== undefined) return bound;
  }

  let winner: FieldTypeDef | undefined;
  let best = 0;
  for (const def of registry.fieldTypes()) {
    let score = 0;
    try {
      score = def.match(schema);
    } catch {
      // A broken contribution must never break resolution — treat as no match.
      score = 0;
    }
    // Strict > keeps the FIRST registration on ties (f1: registration order).
    if (score > best) {
      best = score;
      winner = def;
    }
  }
  if (winner !== undefined) {
    return { kind: 'contributed', def: winner };
  }
  return defaultFieldFor(schema);
}
