/*
  Tile worlds for the `tilemap` Studio library (creative engines, 2026-10-12).

    const T = s.lib.tilemap;
    const world = T.world(s.app, {
      tileSize: 32,
      rows: [
        '##########',
        '#..c...c.#',
        '#..###...#',
        '#p......e#',
        '##########',
      ],
      legend: {
        '#': { style: 'stone', solid: true },
        'c': { kind: 'coin' },          // a marker: no tile, found with world.find('c')
        'p': { kind: 'player' },
        'e': { kind: 'exit', style: 'grass' },
      },
    });
    s.stage.addChild(world.view);
    const moved = world.move({ x, y, w: 20, h: 28 }, vx * dt, vy * dt); // { x, y, hitX, hitY, onGround }

  Rendering uses @pixi/tilemap's CompositeTilemap (one batched draw for the whole level). Tiles
  are either licensed textures the scene loaded (`tiles: { '#': texture }`) or procedural ones
  drawn once from a palette — never fabricated "art assets". Collision is plain arithmetic on
  the grid, so it runs identically in tests, the editor and the published page.

  Bounds: ≤ 256 × 256 cells, ≤ 64 legend symbols, tileSize 4..256 px.
*/

import type { PixiApp, PixiContainer, PixiNamespace, PixiTexture } from '../shared/pixi-types';
import { ensureTilemapPipe, type TilemapClasses } from './pipe';

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

const STYLE_COLORS: Readonly<Record<TileStyle, number>> = {
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

function shade(color: number, amount: number): number {
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

export function createWorld(
  PIXI: PixiNamespace,
  classes: TilemapClasses,
  app: PixiApp,
  // Authored scene code is plain JavaScript: the options, rows or legend may be missing.
  input: Partial<WorldOptions> | null | undefined,
): TileWorld {
  if (typeof input !== 'object' || input === null)
    throw new TypeError('tilemap.world needs options');
  const options = input;
  const tileSize = Math.round(options.tileSize ?? 32);
  if (!(tileSize >= TILEMAP_LIMITS.minTile && tileSize <= TILEMAP_LIMITS.maxTile)) {
    throw new RangeError(
      `tilemap: tileSize must be ${String(TILEMAP_LIMITS.minTile)}..${String(TILEMAP_LIMITS.maxTile)}`,
    );
  }
  if (
    !Array.isArray(options.rows) ||
    options.rows.length < 1 ||
    options.rows.length > TILEMAP_LIMITS.rows
  ) {
    throw new RangeError(`tilemap: rows must hold 1..${String(TILEMAP_LIMITS.rows)} strings`);
  }
  const grid = options.rows.map((row) => {
    if (typeof row !== 'string') throw new TypeError('tilemap: every row must be a string');
    return Array.from(row);
  });
  const cols = Math.max(...grid.map((row) => row.length));
  if (cols < 1 || cols > TILEMAP_LIMITS.cols)
    throw new RangeError(`tilemap: rows must be 1..${String(TILEMAP_LIMITS.cols)} characters wide`);
  const legendInput = options.legend ?? {};
  const symbols = Object.keys(legendInput);
  if (symbols.length > TILEMAP_LIMITS.legend)
    throw new RangeError(`tilemap: at most ${String(TILEMAP_LIMITS.legend)} legend symbols`);
  const legend = new Map<string, LegendEntry>();
  for (const symbol of symbols) {
    if (Array.from(symbol).length !== 1)
      throw new TypeError(`tilemap: legend key "${symbol}" must be one character`);
    const entry = legendInput[symbol];
    if (entry !== null && entry !== undefined) {
      if (entry.style !== undefined && !TILE_STYLES.includes(entry.style)) {
        // Authored code can pass any value as a style; String() prints even a symbol.
        const style: unknown = entry.style;
        throw new RangeError(
          `tilemap: unknown style "${String(style)}" (${TILE_STYLES.join(', ')})`,
        );
      }
      legend.set(symbol, entry);
    }
  }

  const ensured = ensureTilemapPipe(classes, app.renderer);
  if (!ensured) throw new Error('tilemap: this renderer cannot draw tilemaps');
  const view = new PIXI.Container();
  const map = new classes.CompositeTilemap();
  view.addChild(map as unknown as PixiContainer);
  const owned = new Map<string, PixiTexture>();
  let disposed = false;

  function textureFor(symbol: string, entry: LegendEntry): PixiTexture | undefined {
    if (entry.marker === true) return undefined;
    const given = options.tiles?.[symbol];
    if (given !== undefined) return given;
    if (entry.style === undefined && entry.color === undefined) return undefined;
    const key = symbol;
    let made = owned.get(key);
    if (made === undefined) {
      made = makeTileTexture(PIXI, app, entry.style ?? 'plain', tileSize, entry.color);
      owned.set(key, made);
    }
    return made;
  }

  function redraw(): void {
    if (disposed) return;
    map.clear();
    for (const [row, line] of grid.entries()) {
      for (const [col, symbol] of line.entries()) {
        const entry = legend.get(symbol);
        if (entry === undefined) continue;
        const texture = textureFor(symbol, entry);
        if (texture !== undefined)
          map.tile(texture, col * tileSize, row * tileSize, {
            tileWidth: tileSize,
            tileHeight: tileSize,
          });
      }
    }
  }

  const symbolAt = (col: number, row: number): string => grid[row]?.[col] ?? '';
  const isSolid = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= cols || row >= grid.length) return true; // the world's edge is a wall
    const entry = legend.get(symbolAt(col, row));
    return entry?.solid === true || entry?.oneWay === true;
  };
  const isOneWay = (col: number, row: number): boolean =>
    legend.get(symbolAt(col, row))?.oneWay === true;

  function cell(col: number, row: number): Cell | undefined {
    if (col < 0 || row < 0 || col >= cols || row >= grid.length) return undefined;
    const symbol = symbolAt(col, row);
    const entry = legend.get(symbol);
    return Object.freeze({
      col,
      row,
      x: col * tileSize,
      y: row * tileSize,
      symbol,
      kind: entry?.kind ?? '',
      solid: entry?.solid === true,
    });
  }

  function move(box: Box, dx: number, dy: number): MoveResult {
    const step = (value: number): number =>
      Number.isFinite(value) ? Math.max(-tileSize * 64, Math.min(tileSize * 64, value)) : 0;
    let x = box.x;
    let y = box.y;
    const w = Math.max(1, box.w);
    const h = Math.max(1, box.h);
    let hitX = false;
    let hitY = false;
    let onGround = false;
    let onCeiling = false;
    // Sub-step so a fast body never tunnels through a one-tile wall.
    const total = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(step(dx)), Math.abs(step(dy))) / (tileSize / 2)),
    );
    const sx = step(dx) / total;
    const sy = step(dy) / total;
    for (let i = 0; i < total; i += 1) {
      if (sx !== 0 && !hitX) {
        const nx = x + sx;
        const edge = sx > 0 ? nx + w - 0.001 : nx;
        const col = Math.floor(edge / tileSize);
        const top = Math.floor(y / tileSize);
        const bottom = Math.floor((y + h - 0.001) / tileSize);
        let blocked = false;
        for (let row = top; row <= bottom; row += 1)
          if (isSolid(col, row) && !isOneWay(col, row)) blocked = true;
        if (blocked) {
          x = sx > 0 ? col * tileSize - w : (col + 1) * tileSize;
          hitX = true;
        } else x = nx;
      }
      if (sy !== 0 && !hitY) {
        const ny = y + sy;
        const edge = sy > 0 ? ny + h - 0.001 : ny;
        const row = Math.floor(edge / tileSize);
        const left = Math.floor(x / tileSize);
        const right = Math.floor((x + w - 0.001) / tileSize);
        let blocked = false;
        for (let col = left; col <= right; col += 1) {
          if (!isSolid(col, row)) continue;
          // One-way platforms only stop a body falling onto them from above.
          if (isOneWay(col, row) && !(sy > 0 && y + h <= row * tileSize + 0.001)) continue;
          blocked = true;
        }
        if (blocked) {
          if (sy > 0) {
            y = row * tileSize - h;
            onGround = true;
          } else {
            y = (row + 1) * tileSize;
            onCeiling = true;
          }
          hitY = true;
        } else y = ny;
      }
    }
    if (!onGround) {
      // Standing still on the floor still counts as grounded.
      const below = Math.floor((y + h + 0.5) / tileSize);
      const left = Math.floor(x / tileSize);
      const right = Math.floor((x + w - 0.001) / tileSize);
      for (let col = left; col <= right; col += 1)
        if (isSolid(col, below) && Math.abs(below * tileSize - (y + h)) < 0.75) onGround = true;
    }
    return { x, y, hitX, hitY, onGround, onCeiling };
  }

  redraw();

  return {
    view,
    cols,
    rows: grid.length,
    tileSize,
    width: cols * tileSize,
    height: grid.length * tileSize,
    symbolAt,
    tileAt: cell,
    cellOf: (x, y) => ({ col: Math.floor(x / tileSize), row: Math.floor(y / tileSize) }),
    solidAt(x, y) {
      return isSolid(Math.floor(x / tileSize), Math.floor(y / tileSize));
    },
    find(symbolOrKind) {
      const found: Cell[] = [];
      for (const [row, line] of grid.entries()) {
        for (const [col, symbol] of line.entries()) {
          if (symbol !== symbolOrKind && (legend.get(symbol)?.kind ?? '') !== symbolOrKind)
            continue;
          // Every grid cell is inside the world, so cell() always returns one here.
          const match = cell(col, row);
          if (match !== undefined) found.push(match);
        }
      }
      return found;
    },
    set(col, row, symbol) {
      const line = grid[row];
      if (
        disposed ||
        line === undefined ||
        col < 0 ||
        col >= cols ||
        Array.from(symbol).length !== 1
      )
        return false;
      while (line.length <= col) line.push(' ');
      if (line[col] === symbol) return true;
      line[col] = symbol;
      redraw();
      return true;
    },
    move,
    overlaps(box) {
      const cells: Cell[] = [];
      const left = Math.floor(box.x / tileSize);
      const right = Math.floor((box.x + Math.max(1, box.w) - 0.001) / tileSize);
      const top = Math.floor(box.y / tileSize);
      const bottom = Math.floor((box.y + Math.max(1, box.h) - 0.001) / tileSize);
      for (let row = top; row <= bottom; row += 1) {
        for (let col = left; col <= right; col += 1) {
          const found = cell(col, row);
          if (found !== undefined) cells.push(found);
        }
      }
      return cells.slice(0, 256);
    },
    redraw,
    dispose() {
      if (disposed) return;
      disposed = true;
      view.destroy({ children: true });
      for (const texture of owned.values()) texture.destroy(true);
      owned.clear();
    },
  };
}
