/**
 * Builders for the set-E builtin scene presets (mural libraries 2, 2026-10-13): murals and patterns
 * on the lazy `s.lib.color`, `s.lib.lsys` and `s.lib.geom` 1.2 libraries — L-system plants and
 * scrolls, perceptual OKLCH gradients, splines and arc rings — so each preset's code is a page of
 * composition instead of a page of geometry and colour maths.
 *
 * Same contract as set A and set D (author craftkit, trust trusted, licence MIT, kind scene, a
 * still frame under reduced motion) and the same param builders; only the timestamp is set E's
 * own. Every preset draws in design units — `ck.scene({ design: { width: 1280, height: 720, fit
 * } })` — takes its colours from `s.palette` (moved only in OKLCH by s.lib.color), mirrors its
 * growth or drift with `s.dir`, and leaves nothing behind (the libraries hold no timers; Graphics
 * end with the stage).
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { definePreset, type PresetDefinition } from '../set-a/define';

export { range, select, sharedParams, toggle } from '../set-a/define';

/** One fixed timestamp: builtin entries never change under a clock. */
export const SET_E_SAVED_AT = '2026-10-13T12:00:00.000Z';

/** A builtin set-E preset as a ScriptEntry. */
export function defineMuralE(definition: PresetDefinition): ScriptEntry {
  return { ...definePreset(definition), createdAt: SET_E_SAVED_AT, updatedAt: SET_E_SAVED_AT };
}
