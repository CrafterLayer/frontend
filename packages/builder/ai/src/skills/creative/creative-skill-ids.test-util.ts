/*
  The creative skill ids the built-in registry must hold, pinned literally (game libraries,
  2026-10-12): the playbooks, the creative engines with their director, the game libraries, and
  (creative power) physics, scroll murals and the page planner's shapes.
  Kept beside them so builtins.test.ts (at its size baseline) pins the set without growing.
*/
export const PIXI_CREATIVE_SKILL_IDS: readonly string[] = [
  'craftkit.pixi-animation',
  'craftkit.pixi-audio',
  'craftkit.pixi-dialogue',
  'craftkit.pixi-director',
  'craftkit.pixi-effects',
  'craftkit.pixi-game-ai',
  'craftkit.pixi-games',
  'craftkit.pixi-hud',
  'craftkit.pixi-murals',
  'craftkit.pixi-page-shapes',
  'craftkit.pixi-physics',
  'craftkit.pixi-scroll-murals',
  'craftkit.pixi-stories',
  'craftkit.pixi-tile-worlds',
];
