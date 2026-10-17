import type { StylePropertyDef } from '@craftkit/builder-schema';

import {
  namedModel,
  numberModel,
  spacingModel,
  type ScaleModel,
} from './controls/ScaleNumberControl';

/** How a property's scale maps to numbers (see ScaleNumberControl). */
export function modelFor(def: StylePropertyDef): ScaleModel {
  const scale = def.scale ?? [];
  switch (def.tokens) {
    case 'spacing':
    case 'inline-size':
    case 'block-size':
      return spacingModel(scale);
    case 'number':
      return numberModel(scale, def.units?.find((unit) => unit !== '') ?? '', true);
    default:
      return namedModel(scale);
  }
}

/** Scale entries with no number (`auto`, `full`, `tight`): offered by name in the unit menu. */
export function keywordsFor(def: StylePropertyDef, model: ScaleModel): readonly string[] {
  return (def.scale ?? []).filter((token) => model.amountOf(token) === undefined);
}

/** Free units a typed value may carry; empty for unitless properties. */
export function unitsFor(def: StylePropertyDef): readonly string[] {
  return (def.units ?? []).filter((unit) => unit !== '');
}

/** Whether tokens mode (registered blocks) can show this property at all. */
export function isTokenCapable(def: StylePropertyDef): boolean {
  if (def.storage !== 'class' || def.baseOnly === true || def.control === 'text') return false;
  if ((def.options ?? []).some((option) => option.legacy !== true)) return true;
  return def.tokens !== undefined || (def.scale ?? []).length > 0;
}

/** Tags whose media-only rows (object fit/position) make sense. */
const MEDIA_TAGS: ReadonlySet<string> = new Set(['img', 'video', 'iframe', 'picture', 'svg']);
const LIST_TAGS: ReadonlySet<string> = new Set(['ul', 'ol', 'li']);

/** Hide rows that cannot apply to this tag (when the tag is known). */
export function appliesToTag(def: StylePropertyDef, tag: string | undefined): boolean {
  if (tag === undefined) return true;
  if (def.id === 'objectFit' || def.id === 'objectPosition') return MEDIA_TAGS.has(tag);
  if (def.id === 'listStyle') return LIST_TAGS.has(tag);
  return true;
}
