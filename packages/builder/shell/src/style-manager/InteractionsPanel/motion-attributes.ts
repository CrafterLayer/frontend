import {
  CUSTOM_CODE_MOTION_ATTRIBUTES,
  motionTriggersFor,
  type CustomCodeMotionTrigger,
} from '@craftkit/builder-schema';

export type MotionAttributes = Readonly<Record<string, string | undefined>>;
export type AttributePatch = Record<string, string | null>;

/** The trigger a motion plays on (absent ⇒ `view`). */
export function triggerOf(attributes: MotionAttributes): CustomCodeMotionTrigger {
  const trigger = attributes['data-ck-trigger'];
  return trigger === 'load' || trigger === 'hover' || trigger === 'click' || trigger === 'scroll'
    ? trigger
    : 'view';
}

/**
 * The timeline-recipe attributes (media-motion vocabulary). They live outside
 * CUSTOM_CODE_MOTION_ATTRIBUTES, so they are named here: an element animated
 * only by a recipe must still count as animated and still be clearable.
 */
const TIMELINE_ATTRIBUTES = ['data-ck-timeline', 'data-ck-scrub'] as const;

/**
 * Whether a motion preset, hover preset or timeline recipe is set — what makes
 * the params valid and Preview / Remove usable. 2026-10-08: an element with only
 * `data-ck-timeline` could not be previewed (the owner "can't use" the motion).
 */
export function hasAnimation(attributes: MotionAttributes): boolean {
  return (
    attributes['data-ck-motion'] !== undefined ||
    attributes['data-ck-hover'] !== undefined ||
    attributes['data-ck-timeline'] !== undefined
  );
}

/**
 * The patch that clears every motion attribute, timeline recipes included.
 * `data-ck-speed` is shared with behaviours (marquee, count-up), so it stays
 * when one is set.
 */
export function clearMotionPatch(attributes: MotionAttributes): AttributePatch {
  const patch: AttributePatch = {};
  for (const name of CUSTOM_CODE_MOTION_ATTRIBUTES) {
    if (attributes[name] !== undefined) patch[name] = null;
  }
  for (const name of TIMELINE_ATTRIBUTES) {
    if (attributes[name] !== undefined) patch[name] = null;
  }
  if (attributes['data-ck-speed'] !== undefined && attributes['data-ck-behavior'] === undefined) {
    patch['data-ck-speed'] = null;
  }
  return patch;
}

/**
 * The patch for choosing a trigger: the trigger itself (absent for the
 * default `view`), and the preset dropped when it cannot play on it — the
 * door would refuse the pair, and a preset that silently never plays is
 * worse than none.
 */
export function triggerPatch(attributes: MotionAttributes, trigger: CustomCodeMotionTrigger): AttributePatch {
  const patch: AttributePatch = { 'data-ck-trigger': trigger === 'view' ? null : trigger };
  const preset = attributes['data-ck-motion'];
  if (preset !== undefined && !motionTriggersFor(preset).includes(trigger)) {
    patch['data-ck-motion'] = null;
  }
  if (attributes['data-ck-trigger'] === undefined && trigger === 'view') delete patch['data-ck-trigger'];
  return patch;
}

/**
 * The patch for choosing (or clearing) a motion preset. Choosing one carries
 * a pending trigger along; clearing the last animation clears the params too,
 * since a param means nothing alone.
 */
export function presetPatch(
  attributes: MotionAttributes,
  name: 'data-ck-motion' | 'data-ck-hover',
  preset: string | null,
  pendingTrigger: CustomCodeMotionTrigger,
): AttributePatch {
  if (preset !== null) {
    const patch: AttributePatch = { [name]: preset };
    if (name === 'data-ck-motion' && pendingTrigger !== 'view' && attributes['data-ck-trigger'] === undefined) {
      patch['data-ck-trigger'] = pendingTrigger;
    }
    return patch;
  }
  const other = name === 'data-ck-motion' ? 'data-ck-hover' : 'data-ck-motion';
  if (attributes[other] === undefined) return clearMotionPatch(attributes);
  return attributes[name] === undefined ? {} : { [name]: null };
}
