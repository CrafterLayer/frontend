/*
  A generated map drawn with the scene's own Pixi Graphics (procedural maps, 2026-10-13): one
  floor rectangle behind, then every horizontal run of wall cells as one rectangle, filled once —
  a 160 × 160 cave is a few thousand rects in a single Graphics, not 25 600 sprites. Colours come
  from the scene palette (the site's tokens) unless given. For textured tiles, collision and
  pickups use `map.rows()` with `s.lib.tilemap.world` instead.
*/

import type { GridData } from './grid';

interface GraphicsLike {
  x: number;
  y: number;
  label?: string;
  rect(x: number, y: number, width: number, height: number): GraphicsLike;
  fill(style: unknown): GraphicsLike;
}

interface ParentLike {
  addChild(child: unknown): unknown;
}

interface PaletteLike {
  readonly surface: number;
  readonly muted: number;
  readonly text: number;
  mix?(a: number, b: number, t: number): number;
}

export interface DrawOptions {
  /** Pixels (or design units) per cell, 2..128; default 16. */
  tile?: number;
  x?: number;
  y?: number;
  /** 0xRRGGBB or a CSS colour; defaults follow s.palette. */
  wall?: number | string;
  /** The floor colour; null leaves the floor unpainted. */
  floor?: number | string | null;
  /** Where the Graphics goes (default s.world, else s.stage); null keeps it unattached. */
  parent?: ParentLike | null;
}

interface DrawTarget {
  readonly PIXI: { readonly Graphics: new () => GraphicsLike };
  readonly palette?: PaletteLike;
  readonly world?: unknown;
  readonly stage?: unknown;
}

function isParent(value: unknown): value is ParentLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { addChild?: unknown }).addChild === 'function'
  );
}

function targetOf(value: unknown): DrawTarget {
  const graphics = (value as { PIXI?: { Graphics?: unknown } } | null)?.PIXI?.Graphics;
  if (typeof graphics !== 'function') {
    throw new TypeError('procgen: map.draw needs the scene (s) as its first argument');
  }
  return value as DrawTarget;
}

function mixed(
  palette: PaletteLike | undefined,
  a: 'surface' | 'muted',
  b: 'muted' | 'text',
  t: number,
  fallback: number,
): number {
  if (palette === undefined) return fallback;
  if (typeof palette.mix === 'function') return palette.mix(palette[a], palette[b], t);
  return palette[b];
}

function colour(value: unknown, fallback: number): number | string {
  return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
    ? value
    : fallback;
}

export function drawMap(scene: unknown, grid: GridData, options: DrawOptions = {}): GraphicsLike {
  const target = targetOf(scene);
  // Authored code is plain JavaScript: a string or NaN tile falls back to 16.
  const tileInput: unknown = options.tile ?? 16;
  const tile =
    typeof tileInput === 'number' && Number.isFinite(tileInput)
      ? Math.min(128, Math.max(2, tileInput))
      : 16;
  const palette = target.palette;
  const wall = colour(options.wall, mixed(palette, 'muted', 'text', 0.35, 0x475569));
  const graphics = new target.PIXI.Graphics();
  graphics.label = 'procgen-map';
  graphics.x = Number.isFinite(options.x) ? (options.x ?? 0) : 0;
  graphics.y = Number.isFinite(options.y) ? (options.y ?? 0) : 0;
  if (options.floor !== null) {
    const floor = colour(options.floor, mixed(palette, 'surface', 'muted', 0.18, 0x1e293b));
    graphics.rect(0, 0, grid.width * tile, grid.height * tile).fill(floor);
  }
  let runs = 0;
  for (let y = 0; y < grid.height; y += 1) {
    let x = 0;
    while (x < grid.width) {
      if (grid.cells[y * grid.width + x] !== 1) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < grid.width && grid.cells[y * grid.width + x] === 1) x += 1;
      graphics.rect(start * tile, y * tile, (x - start) * tile, tile);
      runs += 1;
    }
  }
  if (runs > 0) graphics.fill(wall);
  const parent =
    options.parent === null
      ? null
      : isParent(options.parent)
        ? options.parent
        : isParent(target.world)
          ? target.world
          : isParent(target.stage)
            ? target.stage
            : null;
  parent?.addChild(graphics);
  return graphics;
}
