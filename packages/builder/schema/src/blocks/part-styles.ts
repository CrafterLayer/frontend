/**
 * Per-part styles of a registered block (block-parts DESIGN §2.2).
 *
 * One ordinary JSON prop, stored under the key `partStyles` (law L2): a record
 * from a part style key (`heading`, `item.title`, `item.title@2`) to the
 * utility classes merged onto that element and an optional direction
 * override. A `name@i` entry wins over a `name` entry, which wins over the
 * block's own classes.
 *
 * Classes go through the same door as a block's `className` prop: arbitrary
 * values and Tailwind's default palette are refused at the schema (law L4),
 * so a refused class can never be stored and discovered later.
 */
import { z } from 'zod';

import {
  CUSTOM_CODE_TIMELINE_RECIPES,
  isCustomCodeTimelineRecipe,
  type CustomCodeTimelineRecipe,
} from '../custom-code/media-vocabulary';
import { unwrapPropSchema } from './block-parts';
import { findRejectedUtilities } from './utility-classes';

/** One part's style entry. */
export interface PartStyle {
  readonly className?: string | undefined;
  readonly dir?: 'auto' | 'ltr' | 'rtl' | undefined;
  // gsap-pixi additions (2026-10-08): a named scroll-timeline recipe on this part
  // (rendered as `data-ck-timeline` / `data-ck-scrub`, played by the timeline engine).
  readonly timeline?: CustomCodeTimelineRecipe | undefined;
  readonly scrub?: boolean | undefined;
}

/** The meta marker field resolution matches on (by META, never by identity). */
export const PART_STYLES_META_KEY = 'craftkit';
export const PART_STYLES_META_VALUE = 'part-styles';

/** The longest class list one part entry may hold. */
export const PART_STYLE_CLASS_MAX = 400;

/** A part style key: a part name, optionally `@` and the instance index (`item.title@2`, `cell@1.3`). */
export const PART_STYLE_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*(@\d+(\.\d+)*)?$/;

export const PART_DIRECTIONS = ['auto', 'ltr', 'rtl'] as const;

const partClassSchema = z
  .string()
  .max(PART_STYLE_CLASS_MAX)
  .refine((value) => findRejectedUtilities(value).length === 0, {
    error: (issue) =>
      findRejectedUtilities(String(issue.input))
        .map((rejection) => rejection.message)
        .join(' '),
  });

const partStyleSchema = z.object({
  className: partClassSchema.optional(),
  dir: z.enum(PART_DIRECTIONS).optional(),
  // gsap-pixi additions (2026-10-08)
  timeline: z.enum(CUSTOM_CODE_TIMELINE_RECIPES).optional(),
  scrub: z.boolean().optional(),
});

/**
 * Declare a block's `partStyles` prop. Marketing blocks receive it through
 * `sectionCustomProps`; other blocks add `partStyles: partStylesProp()`.
 */
/*
  The return type is inferred on purpose: annotating it as a plain `z.ZodType`
  drops zod's optional marker, and every object spreading it would then require
  the key.
*/
export function partStylesProp() {
  return z
    .record(z.string().regex(PART_STYLE_KEY_PATTERN), partStyleSchema)
    .optional()
    .meta({ [PART_STYLES_META_KEY]: PART_STYLES_META_VALUE });
}

function hasMarker(schema: z.ZodType): boolean {
  const meta = (schema as { meta?: () => Record<string, unknown> | undefined }).meta?.();
  return meta?.[PART_STYLES_META_KEY] === PART_STYLES_META_VALUE;
}

const WRAPPER_TYPES: ReadonlySet<string> = new Set([
  'optional',
  'default',
  'nullable',
  'prefault',
  'readonly',
  'catch',
]);

/** True when a schema is a `partStylesProp()` declaration; reads the marker through wrappers. */
export function isPartStylesSchema(schema: unknown): boolean {
  if (typeof schema !== 'object' || schema === null || !('_zod' in schema)) return false;
  let current = schema as z.ZodType;
  for (;;) {
    if (hasMarker(current)) return true;
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    if (!WRAPPER_TYPES.has(def.type) || def.innerType === undefined) return false;
    current = def.innerType;
  }
}

/** The key of the prop carrying the part-styles marker in an object props schema. */
export function partStylesKeyOf(props: z.ZodType): string | undefined {
  const def = unwrapPropSchema(props)._zod.def as { type: string; shape?: Record<string, z.ZodType> };
  if (def.type !== 'object' || def.shape === undefined) return undefined;
  for (const [key, schema] of Object.entries(def.shape)) {
    if (isPartStylesSchema(schema)) return key;
  }
  return undefined;
}

/**
 * The stored part styles of a props object, read defensively: anything that
 * is not a record of `{ className?: string, dir?: 'auto'|'ltr'|'rtl' }` is
 * skipped, so a renderer never throws on a bad document.
 */
export function readPartStyles(
  props: unknown,
  key = 'partStyles',
): Readonly<Record<string, PartStyle>> {
  if (typeof props !== 'object' || props === null) return {};
  const raw = (props as Record<string, unknown>)[key];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const styles: Record<string, PartStyle> = {};
  for (const [styleKey, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
    const { className, dir, timeline, scrub } = entry as Record<string, unknown>;
    const style: {
      className?: string;
      dir?: PartStyle['dir'];
      timeline?: CustomCodeTimelineRecipe;
      scrub?: boolean;
    } = {};
    if (typeof className === 'string') style.className = className;
    if (dir === 'auto' || dir === 'ltr' || dir === 'rtl') style.dir = dir;
    // gsap-pixi additions (2026-10-08)
    if (typeof timeline === 'string' && isCustomCodeTimelineRecipe(timeline)) style.timeline = timeline;
    if (typeof scrub === 'boolean') style.scrub = scrub;
    styles[styleKey] = style;
  }
  return styles;
}
