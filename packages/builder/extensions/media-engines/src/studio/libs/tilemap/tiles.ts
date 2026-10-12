/*
  The tilemap library's tiles (split from world.ts, 2026-10-12): limits, the tile styles
  and their colours, the world's public types, and makeTileTexture's drawn tiles.
*/

import type { PixiApp, PixiContainer, PixiNamespace, PixiTexture } from '../shared/pixi-types';

export const TILEMAP_LIMITS = Object.freeze({
  cols: 256,
  rows: 256,
  legend: 64,
  minTile: 4,
  maxTile: 256,
});

export type TileStyle =
  | 'plain'
  | 'stone'
  | 'brick'
  | 'grass'
  | 'dirt'
  | 'water'
  | 'wood'
  | 'ice'
  | 'lava'
  | 'sand'
  | 'metal'
  | 'cloud';

export const TILE_STYLES: readonly TileStyle[] = [
  'plain',
  'stone',
  'brick',
  'grass',
  'dirt',
  'water',
  'wood',
  'ice',
  'lava',
  'sand',
  'metal',
  'cloud',
];

export const STYLE_COLORS: Readonly<Record<TileStyle, number>> = {
  plain: 0x64748b,
  stone: 0x6b7280,
  brick: 0xb45309,
  grass: 0x16a34a,
  dirt: 0x92400e,
  water: 0x0ea5e9,
  wood: 0xa16207,
  ice: 0xbae6fd,
  lava: 0xea580c,
  sand: 0xfcd34d,
  metal: 0x94a3b8,
  cloud: 0xf8fafc,
};

export interface LegendEntry {
  /** Procedural look when no texture is given. */
  style?: TileStyle;
  /** Base colour for the procedural look. */
  color?: number;
  solid?: boolean;
  /** Solid only from above (jump-through platforms); implies a floor, never a wall. */
  oneWay?: boolean;
  /** Free label read back by tileAt/find (coin, spike, exit…). */
  kind?: string;
  /** Draw nothing: a pure marker for spawn points and pickups. */
  marker?: boolean;
}

export interface WorldOptions {
  tileSize?: number;
  rows: readonly string[];
  legend: Readonly<Record<string, LegendEntry | null>>;
  /** Licensed textures by legend symbol (loaded with s.texture). */
  tiles?: Readonly<Record<string, PixiTexture>>;
}

export interface Cell {
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  readonly symbol: string;
  readonly kind: string;
  readonly solid: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveResult {
  x: number;
  y: number;
  hitX: boolean;
  hitY: boolean;
  onGround: boolean;
  onCeiling: boolean;
}

export interface TileWorld {
  readonly view: PixiContainer;
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly width: number;
  readonly height: number;
  symbolAt(col: number, row: number): string;
  tileAt(col: number, row: number): Cell | undefined;
  cellOf(x: number, y: number): { col: number; row: number };
  solidAt(x: number, y: number): boolean;
  /** Every cell with this symbol or kind, in reading order. */
  find(symbolOrKind: string): Cell[];
  /** Change one cell (a collected coin becomes '.'); redraws on the next frame of use. */
  set(col: number, row: number, symbol: string): boolean;
  /** Move an axis-aligned box by (dx, dy) against solid tiles, x then y. */
  move(box: Box, dx: number, dy: number): MoveResult;
  /** Overlapping cells of a box (pickups, hazards). */
  overlaps(box: Box): Cell[];
  redraw(): void;
  dispose(): void;
}

export function shade(color: number, amount: number): number {
  const f = (channel: number): number =>
    Math.max(0, Math.min(255, Math.round(channel + amount * 255)));
  return (f((color >> 16) & 255) << 16) | (f((color >> 8) & 255) << 8) | f(color & 255);
}

/** Draw one procedural tile texture; details scale with the tile size. */
export function makeTileTexture(
  PIXI: PixiNamespace,
  app: PixiApp,
  style: TileStyle,
  size: number,
  color?: number,
): PixiTexture {
  const base = color ?? STYLE_COLORS[style];
  const g = new PIXI.Graphics();
  const s = size;
  g.rect(0, 0, s, s).fill(base);
  switch (style) {
    case 'brick': {
      const h = s / 4;
      for (let r = 0; r < 4; r += 1) {
        const offset = r % 2 === 0 ? 0 : s / 4;
        for (let c = -1; c < 3; c += 1) {
          g.rect(offset + c * (s / 2) + 1, r * h + 1, s / 2 - 2, h - 2).fill(
            shade(base, (r + c) % 2 === 0 ? 0.04 : -0.03),
          );
        }
      }
      break;
    }
    case 'stone':
      g.rect(0, 0, s, s * 0.12).fill(shade(base, 0.12));
      g.circle(s * 0.3, s * 0.4, s * 0.12).fill(shade(base, -0.08));
      g.circle(s * 0.7, s * 0.7, s * 0.09).fill(shade(base, -0.06));
      g.rect(0, s * 0.9, s, s * 0.1).fill(shade(base, -0.12));
      break;
    case 'grass':
      g.rect(0, s * 0.28, s, s * 0.72).fill(STYLE_COLORS.dirt);
      g.rect(0, 0, s, s * 0.3).fill(base);
      for (let i = 0; i < 4; i += 1)
        g.rect((i + 0.3) * (s / 4), s * 0.28, s / 10, s * 0.12).fill(base);
      break;
    case 'dirt':
    case 'sand':
      for (let i = 0; i < 6; i += 1)
        g.circle((((i * 37) % 97) / 97) * s, (((i * 61) % 89) / 89) * s, s * 0.05).fill(
          shade(base, -0.1),
        );
      break;
    case 'water':
      g.rect(0, 0, s, s * 0.15).fill(shade(base, 0.2));
      g.rect(s * 0.1, s * 0.45, s * 0.35, s * 0.06).fill(shade(base, 0.12));
      g.rect(s * 0.55, s * 0.7, s * 0.3, s * 0.06).fill(shade(base, 0.12));
      break;
    case 'wood':
      for (let i = 1; i < 4; i += 1) g.rect(0, (i * s) / 4 - 1, s, 2).fill(shade(base, -0.12));
      g.circle(s * 0.75, s * 0.35, s * 0.05).fill(shade(base, -0.18));
      break;
    case 'ice':
      g.poly([s * 0.15, s * 0.2, s * 0.4, s * 0.2, s * 0.15, s * 0.45]).fill(shade(base, 0.15));
      g.rect(0, s * 0.92, s, s * 0.08).fill(shade(base, -0.1));
      break;
    case 'lava':
      g.circle(s * 0.3, s * 0.35, s * 0.14).fill(0xfde047);
      g.circle(s * 0.72, s * 0.65, s * 0.1).fill(0xfacc15);
      break;
    case 'metal':
      g.rect(1, 1, s - 2, s - 2).stroke({ color: shade(base, 0.15), width: 2 });
      for (const [cx, cy] of [
        [0.18, 0.18],
        [0.82, 0.18],
        [0.18, 0.82],
        [0.82, 0.82],
      ] as const)
        g.circle(s * cx, s * cy, s * 0.05).fill(shade(base, -0.2));
      break;
    case 'cloud':
      g.clear();
      g.circle(s * 0.3, s * 0.6, s * 0.28).fill(base);
      g.circle(s * 0.6, s * 0.45, s * 0.34).fill(base);
      g.rect(s * 0.1, s * 0.6, s * 0.8, s * 0.3).fill(base);
      break;
    default:
      g.rect(0, 0, s, s * 0.1).fill(shade(base, 0.1));
      g.rect(0, s * 0.9, s, s * 0.1).fill(shade(base, -0.1));
  }
  const texture = app.renderer.generateTexture({
    target: g,
    frame: new PIXI.Rectangle(0, 0, s, s),
    resolution: 1,
  });
  g.destroy();
  return texture;
}
