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

import {
  TILEMAP_LIMITS,
  TILE_STYLES,
  makeTileTexture,
  type Box,
  type Cell,
  type LegendEntry,
  type MoveResult,
  type TileWorld,
  type WorldOptions,
} from './tiles';
export { TILEMAP_LIMITS, TILE_STYLES, makeTileTexture } from './tiles';
export type {
  Box,
  Cell,
  LegendEntry,
  MoveResult,
  TileStyle,
  TileWorld,
  WorldOptions,
} from './tiles';

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
