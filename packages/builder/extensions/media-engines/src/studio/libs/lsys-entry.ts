import { grow, LSYS_LIMITS, type LsysOptions } from './lsys/grow';
import { LSYS_PRESET_NAMES, LSYS_PRESETS } from './lsys/presets';
import { draw, fit, upTo, type DrawOptions, type FitOptions } from './lsys/view';

export const LSYS_VERSION = '1.0.0';

/**
 * `s.lib.lsys` (mural libraries 2, 2026-10-13): L-system growth for plants, vines, ferns and
 * patterns — rewriting by lindenmayer 1.5.4 (MIT), a seeded turtle in design units, ready rule
 * sets, a fit into a box, a growth animation (`upTo`) and a stroke per branch depth. Plain
 * JavaScript: it never imports Pixi (draw strokes the scene's own Graphics) and holds nothing to
 * dispose.
 */
export function createLsysLibrary() {
  return Object.freeze({
    version: LSYS_VERSION,
    limits: LSYS_LIMITS,
    presets: LSYS_PRESETS,
    names: LSYS_PRESET_NAMES,
    grow: (first?: unknown, second?: LsysOptions) => grow(first, second),
    fit: (result: unknown, box: unknown, options?: FitOptions) => fit(result, box, options),
    upTo: (result: unknown, fraction: unknown) => upTo(result, fraction),
    draw: (g: unknown, view: unknown, options?: DrawOptions) => draw(g, view, options),
  });
}
