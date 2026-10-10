/**
 * Pixi Studio builtin scene presets, set A (DESIGN.md §B.3, items 1–17):
 * generative murals, Arabic and Islamic geometry, hand-drawn, kinetic type.
 *
 * Each entry is a `ScriptEntry` (author craftkit, trust trusted, licence MIT)
 * whose `code` is plain JavaScript written against the stable scene API
 * (`ck.params` + `ck.scene`, §B.2). The aggregate catalogue
 * (`scene-presets/catalog.ts`, package agent-studio) imports this list.
 */
import { ARABESQUE_VINES } from './arabesque-vines';
import { AURORA_CURTAINS } from './aurora-curtains';
import { CALLIGRAPHY_INK_REVEAL } from './calligraphy-ink-reveal';
import { CIRCLE_PACKING_BLOOM } from './circle-packing-bloom';
import { DIFFERENTIAL_GROWTH_CORAL } from './differential-growth-coral';
import { DOMAIN_WARP_LIQUID } from './domain-warp-liquid';
import { FLOW_FIELD_SILK } from './flow-field-silk';
import { GIRIH_STARFIELD } from './girih-starfield';
import { KINETIC_WORD_GRID } from './kinetic-word-grid';
import { LOW_POLY_TERRAIN } from './low-poly-terrain';
import { MASHRABIYA_LIGHT } from './mashrabiya-light';
import { REACTION_DIFFUSION_SKIN } from './reaction-diffusion-skin';
import { RECURSIVE_MONDRIAN } from './recursive-mondrian';
import { ROUGH_NOTEBOOK } from './rough-notebook';
import type { ScriptEntry } from './studio-types';
import { TOPOGRAPHIC_CONTOURS } from './topographic-contours';
import { VORONOI_STAINED_GLASS } from './voronoi-stained-glass';
import { ZELLIGE_MOSAIC } from './zellige-mosaic';

export type {
  Bilingual,
  ScriptEntry,
  ScriptParamSpec,
  ScriptParamValue,
  StudioLibKey,
} from './studio-types';

/** The 17 set-A presets, in catalogue order (DESIGN §B.3). */
export const PRESETS_SET_A: readonly ScriptEntry[] = [
  FLOW_FIELD_SILK,
  DOMAIN_WARP_LIQUID,
  AURORA_CURTAINS,
  CIRCLE_PACKING_BLOOM,
  RECURSIVE_MONDRIAN,
  DIFFERENTIAL_GROWTH_CORAL,
  REACTION_DIFFUSION_SKIN,
  TOPOGRAPHIC_CONTOURS,
  VORONOI_STAINED_GLASS,
  LOW_POLY_TERRAIN,
  GIRIH_STARFIELD,
  ZELLIGE_MOSAIC,
  MASHRABIYA_LIGHT,
  CALLIGRAPHY_INK_REVEAL,
  ARABESQUE_VINES,
  ROUGH_NOTEBOOK,
  KINETIC_WORD_GRID,
];

export {
  ARABESQUE_VINES,
  AURORA_CURTAINS,
  CALLIGRAPHY_INK_REVEAL,
  CIRCLE_PACKING_BLOOM,
  DIFFERENTIAL_GROWTH_CORAL,
  DOMAIN_WARP_LIQUID,
  FLOW_FIELD_SILK,
  GIRIH_STARFIELD,
  KINETIC_WORD_GRID,
  LOW_POLY_TERRAIN,
  MASHRABIYA_LIGHT,
  REACTION_DIFFUSION_SKIN,
  RECURSIVE_MONDRIAN,
  ROUGH_NOTEBOOK,
  TOPOGRAPHIC_CONTOURS,
  VORONOI_STAINED_GLASS,
  ZELLIGE_MOSAIC,
};
