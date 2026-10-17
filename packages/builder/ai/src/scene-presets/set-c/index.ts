/**
 * Pixi Studio builtin scene presets, set C (2026-10-13): the game and story KITS — whole playable
 * sections the agent applies with `scene.preset` and a few params instead of writing a game or a
 * story from scratch. Each is a `SceneKit`: its library entry (`ScriptEntry`, plain JavaScript
 * against the scene API) and its region (the tree of words and controls the code drives, in
 * English and Arabic, and its css). The aggregate catalogue (`scene-presets/catalog.ts`) imports
 * this list.
 */
import { ARCADE } from './arcade';
import { BREAKOUT } from './breakout';
import { CATCH } from './catch';
import type { SceneKit } from './define';
import { MEMORY } from './memory';
import { PICTURE_BOOK } from './picture-book';
import { PLATFORMER } from './platformer';
import { QUIZ } from './quiz';
import { RUNNER } from './runner';
import { SCROLL_STORY } from './scroll-story';
import { SNAKE } from './snake';
import { VISUAL_NOVEL } from './visual-novel';

export type { KitCategory, KitLang, KitRegion, SceneKit } from './define';
export { KIT_LANGS } from './define';

/** The set-C kits, in catalogue order: games, then stories. */
export const KITS_SET_C: readonly SceneKit[] = [
  ARCADE,
  PLATFORMER,
  RUNNER,
  BREAKOUT,
  MEMORY,
  QUIZ,
  SNAKE,
  CATCH,
  PICTURE_BOOK,
  VISUAL_NOVEL,
  SCROLL_STORY,
];
