import { enablePatches } from 'immer';

// Immer's patches plugin is opt-in and process-wide; this module is the single
// place that turns it on, and every patch producer/consumer imports from here.
enablePatches();

export { applyPatches, current, produceWithPatches } from 'immer';

import { current as immerCurrent } from 'immer';

/**
 * `current()` for a draft whose published type carries `readonly` arrays.
 *
 * Immer's own signature wants a `Draft<T>`, which for `BuilderSite` means
 * `pages` as a mutable array — but the type a site command receives is the
 * PUBLISHED `BuilderSite`, deliberately readonly so nothing outside a producer
 * can write through it. The two are the same object at runtime; only the
 * variance differs. This states that once, here, instead of at each call.
 */
export function snapshot<T>(draft: T): T {
  return immerCurrent(draft as never);
}
