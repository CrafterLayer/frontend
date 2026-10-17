import type { z } from 'zod';

import { customCodeJsMetaSchema, customCodeJsParamsSchema } from './schemas';
import type { CustomCodeJsMeta, CustomCodeJsParams } from './types';

/**
 * The customCode props that sit beside `js` (pixi-studio DESIGN.md D8):
 *
 * - `jsParams` — the VALUES a person or the agent chose, rendered on the region
 *   as `data-ck-params` and read by `ck.params(defaults)`; a change re-runs it.
 * - `jsMeta` — the library reference and the param SPEC; never rendered.
 *
 * Declared like `customJs()`: by a meta marker, so the Inspector field types
 * find them by DECLARATION, never by prop name. Both are optional, so every
 * stored document without them still validates byte-for-byte.
 */
export const STUDIO_META_KEY = 'craftkit-studio';
export const JS_PARAMS_META_VALUE = 'script-params';
export const JS_META_META_VALUE = 'script-meta';

export function customCodeJsParams(): z.ZodOptional<z.ZodType<CustomCodeJsParams>> {
  return customCodeJsParamsSchema.meta({ [STUDIO_META_KEY]: JS_PARAMS_META_VALUE }).optional();
}

export function customCodeJsMeta(): z.ZodOptional<z.ZodType<CustomCodeJsMeta>> {
  return customCodeJsMetaSchema.meta({ [STUDIO_META_KEY]: JS_META_META_VALUE }).optional();
}

function hasStudioMarker(schema: z.ZodType, value: string): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[STUDIO_META_KEY] === value) return true;
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) return false;
    current = def.innerType;
  }
}

/** True when a property schema is a `jsParams` declaration; unwraps wrappers. */
export function isCustomCodeJsParamsSchema(schema: z.ZodType): boolean {
  return hasStudioMarker(schema, JS_PARAMS_META_VALUE);
}

/** True when a property schema is a `jsMeta` declaration; unwraps wrappers. */
export function isCustomCodeJsMetaSchema(schema: z.ZodType): boolean {
  return hasStudioMarker(schema, JS_META_META_VALUE);
}

/** A script's data (`jsParams` or `jsMeta`): authored values, like the script itself. */
export function isScriptDataSchema(schema: z.ZodType): boolean {
  return isCustomCodeJsParamsSchema(schema) || isCustomCodeJsMetaSchema(schema);
}
