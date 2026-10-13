/**
 * Pixi Studio builtin scene presets, set D (mural libraries, 2026-10-13): murals and patterns on
 * the lazy `s.lib.noise`, `s.lib.geom` and `s.lib.hex` libraries — terraced contours, cut paper,
 * flowing ribbons, a hex island, a mosaic arch window and ebru marbling. The mural playbook
 * names them (like the game and story kits, they stay out of the cached tool menu, whose edit lane
 * is at its cap); `scene.preset` applies any of them in one call.
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { EBRU_MARBLING } from './ebru-marbling';
import { HEX_ISLAND } from './hex-island';
import { MOSAIC_ARCH_WINDOW } from './mosaic-arch-window';
import { PAPER_CUT_LANDSCAPE } from './paper-cut-landscape';
import { RIBBON_FLOW } from './ribbon-flow';
import { TERRACED_TOPOGRAPHY } from './terraced-topography';

/** The set-D presets and their categories, in catalogue order. */
export const PRESETS_SET_D: readonly (readonly [ScriptEntry, 'mural' | 'pattern'])[] = [
  [TERRACED_TOPOGRAPHY, 'mural'],
  [PAPER_CUT_LANDSCAPE, 'mural'],
  [RIBBON_FLOW, 'mural'],
  [HEX_ISLAND, 'mural'],
  [MOSAIC_ARCH_WINDOW, 'pattern'],
  [EBRU_MARBLING, 'pattern'],
];

export {
  EBRU_MARBLING,
  HEX_ISLAND,
  MOSAIC_ARCH_WINDOW,
  PAPER_CUT_LANDSCAPE,
  RIBBON_FLOW,
  TERRACED_TOPOGRAPHY,
};
