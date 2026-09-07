import { enablePatches } from 'immer';

// Immer's patches plugin is opt-in and process-wide; this module is the single
// place that turns it on, and every patch producer/consumer imports from here.
enablePatches();

export { applyPatches, current, produceWithPatches } from 'immer';

import { current as immerCurrent, isDraft } from 'immer';

/**
 * `current()` for a draft whose published type carries `readonly` arrays.
 *
 * Immer's own signature wants a `Draft<T>`, which for `BuilderSite` means
 * `pages` as a mutable array — but the type a site command receives is the
 * PUBLISHED `BuilderSite`, deliberately readonly so nothing outside a producer
 * can write through it. The two are the same object at runtime; only the
 * variance differs. This states that once, here, instead of at each call.
 *
 * ## Why it tolerates a value that is not a draft
 *
 * Because inside a GROUP it will be handed one. A step that assigns a freshly
 * built object — `draft.designSystem = next` — leaves a plain value where a
 * proxy was, and the next step in the same group then reads it back. Immer's
 * own `current()` throws on that ("expects a draft"), so two `setDesignToken`
 * calls in one group failed while either alone succeeded: a bug that only a
 * group could produce, and one no single-command test could ever have found.
 *
 * A plain value IS a snapshot of itself, so returning it unchanged is the
 * honest answer rather than a special case.
 */
export function snapshot<T>(draft: T): T {
  return isDraft(draft) ? immerCurrent(draft as never) : draft;
}
