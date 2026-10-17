import { createGameAi } from './gameai/agents';
import { AI_LIMITS, createNavGrid } from './gameai/grid';
import type { GameAiOptions, GameAiSceneLike } from './gameai/types';

export const GAMEAI_VERSION = '0.7.8';

/**
 * `s.lib.gameai` (game libraries, 2026-10-12): yuka 0.7 (MIT) steering — seek, flee, arrive,
 * pursue, evade, seeded wander, follow/patrol paths, obstacle avoidance, separation — on agents
 * that drive Pixi display objects, A* chase paths over `s.lib.tilemap` worlds (or any solid
 * grid), and small finite-state machines; bounded, deterministic with the scene's seed, stepped
 * by the scene's own ticker and disposed with it. Plain JavaScript; it never imports Pixi.
 */
export function createGameAiLibrary() {
  return Object.freeze({
    version: GAMEAI_VERSION,
    limits: AI_LIMITS,
    create: (scene: unknown, options?: GameAiOptions) =>
      createGameAi(scene as GameAiSceneLike | null | undefined, options),
    /** A standalone grid (no controller): path(from, to), move(box, dx, dy), free(x, y). */
    grid: (source: unknown, options?: { diagonal?: boolean }) =>
      createNavGrid(source as Parameters<typeof createNavGrid>[0], options),
  });
}
