/**
 * Pixi Studio builtin scene presets, set E (mural libraries 2, 2026-10-13): murals and patterns
 * on the lazy `s.lib.lsys`, `s.lib.color` and `s.lib.geom` 1.2 libraries — a growing botanical
 * garden, a mirrored arabesque scroll, OKLCH gradient waves and astrolabe-like arc rings. Like set
 * D, the mural playbook names them and they stay out of the cached tool menu (its edit lane is at
 * its cap); `scene.preset` applies any of them in one call.
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { ARABESQUE_SCROLL } from './arabesque-scroll';
import { ARC_RINGS } from './arc-rings';
import { BOTANICAL_GARDEN } from './botanical-garden';
import { GRADIENT_WAVES } from './gradient-waves';

/** The set-E presets and their categories, in catalogue order. */
export const PRESETS_SET_E: readonly (readonly [ScriptEntry, 'mural' | 'pattern'])[] = [
  [BOTANICAL_GARDEN, 'mural'],
  [GRADIENT_WAVES, 'mural'],
  [ARC_RINGS, 'mural'],
  [ARABESQUE_SCROLL, 'pattern'],
];

export { ARABESQUE_SCROLL, ARC_RINGS, BOTANICAL_GARDEN, GRADIENT_WAVES };
