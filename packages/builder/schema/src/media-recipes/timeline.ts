import type { CustomCodeAttribute } from '../custom-code/custom-code-tree';
import {
  CUSTOM_CODE_TIMELINE_RECIPE_INFO,
  CUSTOM_CODE_TIMELINE_RECIPES,
  TIMELINE_DEPTHS,
  type CustomCodeTimelineRecipe,
  type MediaBilingual,
  type TimelineDepth,
} from '../custom-code/media-vocabulary';

/**
 * Timeline recipes as attribute patches (media-motion DESIGN §C.2, §F.2).
 *
 * A recipe is put on an EXISTING element, so its builder is a patch, not a
 * tree: `null` removes an attribute. The patch always removes `data-ck-motion`
 * (a CSS preset and a scroll timeline never drive the same element — the door
 * refuses the pair) and the preset-only params that would be left alone.
 */

/** An attribute patch: a value sets it, `null` removes it. */
export type MediaAttributePatch = Readonly<Partial<Record<CustomCodeAttribute, string | null>>>;

export interface TimelineAttrOptions {
  /** Tie the timeline to the scrollbar (`true`) or play it once on enter (`false`); omitted → the recipe's default. */
  readonly scrub?: boolean | undefined;
}

/** CSS-preset params with no meaning beside a timeline (ease, delay, stagger and speed are reused). */
const PRESET_ONLY_PARAMS = ['data-ck-trigger', 'data-ck-once', 'data-ck-distance', 'data-ck-target'] as const;

/** The patch that puts `recipe` on an element. */
export function timelineAttrs(
  recipe: CustomCodeTimelineRecipe,
  options: TimelineAttrOptions = {},
): MediaAttributePatch | { readonly error: string } {
  if (!(CUSTOM_CODE_TIMELINE_RECIPES as readonly string[]).includes(recipe)) {
    return { error: `recipe is one of ${CUSTOM_CODE_TIMELINE_RECIPES.join(', ')}` };
  }
  const patch: Partial<Record<CustomCodeAttribute, string | null>> = {
    'data-ck-timeline': recipe,
    'data-ck-scrub': options.scrub === undefined ? null : String(options.scrub),
    'data-ck-motion': null,
  };
  for (const param of PRESET_ONLY_PARAMS) patch[param] = null;
  return patch;
}

/** The patch that removes a timeline recipe (and its scrub). */
export function clearTimelineAttrs(): MediaAttributePatch {
  return { 'data-ck-timeline': null, 'data-ck-scrub': null };
}

/** The patch that marks a layer of a `parallax-depth` recipe (1 nearest … 3 farthest). */
export function depthAttrs(depth: TimelineDepth): MediaAttributePatch | { readonly error: string } {
  return (TIMELINE_DEPTHS as readonly string[]).includes(depth)
    ? { 'data-ck-depth': depth }
    : { error: `depth is one of ${TIMELINE_DEPTHS.join(', ')}` };
}

/** The Undo / Layers label of a timeline change. */
export function timelineLabel(recipe: CustomCodeTimelineRecipe): MediaBilingual {
  const name = CUSTOM_CODE_TIMELINE_RECIPE_INFO[recipe].label;
  return { ar: `حركة سينمائية: ${name.ar}`, en: `Cinematic motion: ${name.en}` };
}

/** Apply an attribute patch to an attribute record (pure; for previews and tests). */
export function applyAttributePatch(
  attributes: Readonly<Partial<Record<CustomCodeAttribute, string | undefined>>> | undefined,
  patch: MediaAttributePatch,
): Partial<Record<CustomCodeAttribute, string>> {
  const merged = new Map<string, string | null | undefined>(Object.entries(attributes ?? {}));
  for (const [name, value] of Object.entries(patch)) merged.set(name, value);
  return Object.fromEntries(
    [...merged].filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
