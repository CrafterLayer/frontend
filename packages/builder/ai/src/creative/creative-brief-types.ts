/*
  The creative brief's types (split from creative-planner.ts, 2026-10-12): what the planner
  decides a piece is, which Studio libraries serve it, and the brief it hands the writers.
*/

import type { CreativeCharacterV1, CreativeMemoryV1 } from './creative-memory';

export type CreativeKind = 'game' | 'story' | 'scene';

export type CreativeGenre =
  | 'platformer'
  | 'maze-adventure'
  | 'arcade'
  | 'puzzle'
  | 'physics-toy'
  | 'visual-novel'
  | 'picture-book'
  | 'chapter-story'
  | 'mural';

/** The non-kit Studio libraries the planner may recommend (a subset of STUDIO_LIB_KEYS). */
export type CreativeLib =
  | 'anim'
  | 'fx'
  | 'dialogue'
  | 'ink'
  | 'tilemap'
  | 'physics'
  | 'filters'
  | 'viewport'
  | 'audio'
  | 'gameai'
  | 'hud'
  | 'brush'
  | 'rough'
  | 'peeps';

export interface CreativeBeat {
  readonly id: string;
  readonly purpose: string;
}

export interface CreativeBriefV1 {
  readonly schemaVersion: 1;
  readonly kind: CreativeKind;
  readonly genre: CreativeGenre;
  readonly language: 'ar' | 'en';
  readonly libs: readonly CreativeLib[];
  readonly mechanics: readonly string[];
  readonly beats: readonly CreativeBeat[];
  /** fx presets and weather kinds that fit the setting. */
  readonly effects: readonly string[];
  readonly weather: readonly string[];
  /** anim rig states the cast needs. */
  readonly animation: readonly string[];
  readonly settings: readonly string[];
  readonly cast: readonly CreativeCharacterV1[];
  readonly accessibility: readonly string[];
  readonly checks: readonly string[];
}

export interface CreativePlannerOptions {
  readonly memory?: CreativeMemoryV1;
  /** The page language when known; otherwise read from the request's script. */
  readonly lang?: string;
}
