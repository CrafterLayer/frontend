import { cave, dungeon, maze, PROCGEN_LIMITS } from './procgen/map';

export const PROCGEN_VERSION = '2.2.1';

/**
 * `s.lib.procgen` (procedural maps, 2026-10-13): rot.js 2.2.1 (BSD-3-Clause) dungeons (rooms and
 * corridors), cellular caves and perfect mazes, seeded by the scene, always connected, with a
 * reachable start and exit, BFS paths, precise-shadowcasting field of view, spaced scattering, ASCII
 * rows for `s.lib.tilemap.world` and a palette-coloured Graphics. Plain JavaScript; it never
 * imports Pixi (map.draw uses the scene's s.PIXI).
 */
export function createProcgenLibrary() {
  return Object.freeze({
    version: PROCGEN_VERSION,
    limits: PROCGEN_LIMITS,
    styles: Object.freeze({
      dungeon: Object.freeze(['digger', 'rooms']),
      maze: Object.freeze(['divided', 'icey', 'eller']),
    }),
    dungeon: (s: unknown, options?: Parameters<typeof dungeon>[1]) => dungeon(s, options),
    cave: (s: unknown, options?: Parameters<typeof cave>[1]) => cave(s, options),
    maze: (s: unknown, options?: Parameters<typeof maze>[1]) => maze(s, options),
  });
}
