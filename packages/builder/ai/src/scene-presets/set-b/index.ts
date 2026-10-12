/**
 * Pixi Studio builtin scene presets, set B (DESIGN.md §B.3): the interactive half — pointer,
 * touch and scroll, particles and light, physics, photo murals and metaballs.
 *
 * Each entry is a `ScriptEntry` (author craftkit, trust trusted, licence MIT) whose `code` is
 * plain JavaScript written against the stable scene API (`ck.params` + `ck.scene`, §B.2). The
 * aggregate catalogue (`scene-presets/catalog.ts`) imports this list.
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { BOIDS_MURMURATION } from './boids-murmuration';
import { CONFETTI_CELEBRATION } from './confetti-celebration';
import { EMBER_STORM } from './ember-storm';
import { FALLING_LETTERS_PILE } from './falling-letters-pile';
import { FIREFLY_GARDEN } from './firefly-garden';
import { LIQUID_CURSOR_RIPPLE } from './liquid-cursor-ripple';
import { MAGNETIC_DOT_GRID } from './magnetic-dot-grid';
import { PARTICLE_TEXT_MORPH } from './particle-text-morph';
import { REVEAL_SPOTLIGHT } from './reveal-spotlight';
import { SCROLL_PARALLAX_DEPTH } from './scroll-parallax-depth';
import { SOFT_BLOB_CLUSTER } from './soft-blob-cluster';
import { STARFIELD_WARP } from './starfield-warp';
import { TILT_CARD_WALL } from './tilt-card-wall';

/** The 13 set-B presets, in catalogue order. */
export const PRESETS_SET_B: readonly ScriptEntry[] = [
  BOIDS_MURMURATION,
  FIREFLY_GARDEN,
  EMBER_STORM,
  STARFIELD_WARP,
  CONFETTI_CELEBRATION,
  MAGNETIC_DOT_GRID,
  SOFT_BLOB_CLUSTER,
  FALLING_LETTERS_PILE,
  PARTICLE_TEXT_MORPH,
  LIQUID_CURSOR_RIPPLE,
  REVEAL_SPOTLIGHT,
  SCROLL_PARALLAX_DEPTH,
  TILT_CARD_WALL,
];

export {
  BOIDS_MURMURATION,
  CONFETTI_CELEBRATION,
  EMBER_STORM,
  FALLING_LETTERS_PILE,
  FIREFLY_GARDEN,
  LIQUID_CURSOR_RIPPLE,
  MAGNETIC_DOT_GRID,
  PARTICLE_TEXT_MORPH,
  REVEAL_SPOTLIGHT,
  SCROLL_PARALLAX_DEPTH,
  SOFT_BLOB_CLUSTER,
  STARFIELD_WARP,
  TILT_CARD_WALL,
};
