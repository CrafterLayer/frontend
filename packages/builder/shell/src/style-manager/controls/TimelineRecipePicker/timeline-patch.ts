import {
  clearTimelineAttrs,
  timelineAttrs,
  TIMELINE_REUSED_MOTION_PARAMS,
  type CustomCodeTimelineRecipe,
} from '@craftkit/builder-schema';

/** An attribute patch: a value sets it, `null` removes it. */
export type TimelinePatch = Readonly<Record<string, string | null>>;

/**
 * The patch that takes a recipe off: the recipe and its scrub, and — when no
 * CSS preset or hover effect is left to own them — the motion params the
 * recipe reused (a param alone is a door problem).
 */
export function clearTimelinePatch(attributes: Readonly<Record<string, string | undefined>>): TimelinePatch {
  const patch: Record<string, string | null> = { ...clearTimelineAttrs() };
  const animated = attributes['data-ck-motion'] !== undefined || attributes['data-ck-hover'] !== undefined;
  if (!animated) {
    for (const name of TIMELINE_REUSED_MOTION_PARAMS) {
      if (attributes[name] !== undefined) patch[name] = null;
    }
    if (attributes['data-ck-speed'] !== undefined && attributes['data-ck-behavior'] === undefined) {
      patch['data-ck-speed'] = null;
    }
  }
  return patch;
}

/**
 * The patch that puts `recipe` on an element (the schema's `timelineAttrs`):
 * it removes `data-ck-motion` and the preset-only params in the same patch.
 */
export function recipePatch(recipe: CustomCodeTimelineRecipe, scrub: boolean | undefined): TimelinePatch | undefined {
  const patch = timelineAttrs(recipe, { scrub });
  return 'error' in patch ? undefined : patch;
}
