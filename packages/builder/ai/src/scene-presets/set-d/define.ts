/**
 * Builders for the set-D builtin scene presets (mural libraries, 2026-10-13): murals and patterns
 * that lean on the lazy `s.lib.noise`, `s.lib.geom` and `s.lib.hex` libraries, so each preset's
 * code is a page of composition instead of a page of geometry.
 *
 * Same contract as set A (author craftkit, trust trusted, licence MIT, kind scene, a still frame
 * under reduced motion) and the same param builders; only the timestamp is set D's own. Every
 * preset draws in design units — `ck.scene({ design: { width: 1280, height: 720, fit } })` — so it
 * needs no resize code, takes its colours from `s.palette`, mirrors its drift with `s.dir`, and
 * leaves nothing behind (the libraries hold no timers; Graphics end with the stage).
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { definePreset, type PresetDefinition } from '../set-a/define';

export { range, select, sharedParams, toggle } from '../set-a/define';

/** One fixed timestamp: builtin entries never change under a clock. */
export const SET_D_SAVED_AT = '2026-10-13T00:00:00.000Z';

/** A builtin set-D preset as a ScriptEntry. */
export function defineMural(definition: PresetDefinition): ScriptEntry {
  return { ...definePreset(definition), createdAt: SET_D_SAVED_AT, updatedAt: SET_D_SAVED_AT };
}
