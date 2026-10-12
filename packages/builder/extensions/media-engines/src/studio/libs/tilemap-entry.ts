import { CompositeTilemap, Tilemap, TilemapPipe } from '@pixi/tilemap';

import type { PixiApp, PixiNamespace } from './shared/pixi-types';
import { createCamera, type CameraOptions, type CameraTarget } from './tilemap/camera';
import { ensureTilemapPipe, type TilemapClasses } from './tilemap/pipe';
import {
  createWorld,
  makeTileTexture,
  TILE_STYLES,
  TILEMAP_LIMITS,
  type TileStyle,
  type WorldOptions,
} from './tilemap/world';

export const TILEMAP_VERSION = '5.0.2';

/**
 * `s.lib.tilemap` (creative engines, 2026-10-12): @pixi/tilemap 5 (MIT) for batched tile levels,
 * plus `world()` (ASCII rows + legend → rendered level, collision, pickups), procedural tile
 * textures and a follow camera. Binds to the page's ONE Pixi namespace; the render pipe is added
 * to an already-running renderer on first use.
 */
export function createTilemapLibrary(PIXI: unknown) {
  const pixi = PIXI as PixiNamespace;
  const classes = { CompositeTilemap, TilemapPipe } as unknown as TilemapClasses;
  return Object.freeze({
    version: TILEMAP_VERSION,
    limits: TILEMAP_LIMITS,
    styles: TILE_STYLES,
    CompositeTilemap,
    Tilemap,
    ensure: (app: unknown) => ensureTilemapPipe(classes, (app as PixiApp).renderer),
    world: (app: unknown, options: WorldOptions) =>
      createWorld(pixi, classes, app as PixiApp, options),
    tile: (app: unknown, style: TileStyle, size = 32, color?: number) =>
      makeTileTexture(pixi, app as PixiApp, style, size, color),
    camera: (view: CameraTarget, options: CameraOptions) => createCamera(view, options),
  });
}
