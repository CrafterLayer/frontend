/*
  `s.lib.hex` boards (hex art, 2026-10-13): Kenney's Hexagon Pack tiles (CC0) on a pointy-top hex
  grid, in design units, for map murals and hex-board games.

    const hex = await s.lib.hex.load(s);           // decodes the bundled atlas once per scene
    const board = hex.board({ cols: 9, rows: 6 }); // a seeded island, centred, on s.world
    board.at(2, 3).name / board.pick(x, y) / board.neighbours(q, r) / board.set(q, r, 'castle')
    hex.tile('windmill')                           // one Sprite (anchor 0.5)

  Rows are "odd-r" offset rows (odd rows shifted half a tile toward the inline end); column 0 sits
  on the inline-start side, so a board mirrors in RTL. Water is not in the pack: a 'water' cell is
  a hexagon painted in the page palette. The atlas is a data: URL decoded by an <img> (nothing is
  fetched, so it works under the preview's connect-src 'none'); a board queues the reduced-motion
  still frame itself. The atlas and frame textures are destroyed with the scene, the board's display
  objects with the stage.
*/

import { HEX_ATLAS_URL, HEX_FRAMES, HEX_TILE_SIZE } from './atlas.generated';

export const HEX_TERRAINS = Object.freeze(['grass', 'dirt', 'sand', 'mars', 'stone'] as const);
export const HEX_BUILDINGS = Object.freeze([
  'house',
  'cabin',
  'farm',
  'windmill',
  'castle',
  'tower',
  'lumber',
  'camp',
] as const);
export const HEX_NAMES = Object.freeze([...Object.keys(HEX_FRAMES), 'water']);
export const HEX_LIMITS = Object.freeze({ maxCols: 40, maxRows: 40, minSize: 8, maxSize: 480 });
/** Water hexes are s.palette.mix(accent, surface, HEX_WATER_MIX): paint the sea the same. */
export const HEX_WATER_MIX = 0.6;
/** Tile height over width (the pack's 120 × 140 tiles); rows step by three quarters of it. */
const ASPECT = HEX_TILE_SIZE.height / HEX_TILE_SIZE.width;
const ROW_STEP = 0.75;

interface DisplayLike {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  destroyed?: boolean;
  anchor?: { set(x: number, y?: number): void };
  destroy(options?: unknown): void;
  removeFromParent?(): void;
}

interface ContainerLike extends DisplayLike {
  addChild(child: unknown): unknown;
  addChildAt?(child: unknown, index: number): unknown;
  getChildIndex?(child: unknown): number;
}

interface GraphicsLike extends DisplayLike {
  poly(points: number[]): GraphicsLike;
  fill(style: unknown): GraphicsLike;
}

interface TextureLike {
  readonly source?: unknown;
  destroy(destroySource?: boolean): void;
}

interface PaletteLike {
  readonly accent: number;
  readonly surface: number;
  readonly text: number;
  readonly dark?: boolean;
  mix(a: number, b: number, t: number): number;
}

interface SceneLike {
  readonly PIXI: {
    Texture: {
      new (options: { source: unknown; frame: unknown }): TextureLike;
      from(resource: unknown, skipCache?: boolean): TextureLike;
    };
    Rectangle: new (x: number, y: number, w: number, h: number) => unknown;
    Sprite: new (texture?: unknown) => DisplayLike;
    Container: new () => ContainerLike;
    Graphics: new () => GraphicsLike;
  };
  readonly width: number;
  readonly height: number;
  readonly world?: unknown;
  readonly stage?: unknown;
  readonly design?: { readonly width: number; readonly height: number } | null;
  readonly palette: PaletteLike;
  readonly dir?: number;
  random(): number;
  fbm(x: number, y: number, octaves?: number): number;
  dispose(fn: () => void): void;
  still?(fn: () => void): void;
}

export interface HexCellInfo {
  readonly q: number;
  readonly r: number;
  /** Centre in design units. */
  readonly x: number;
  readonly y: number;
  /** Seeded fbm elevation in [-1, 1] at the centre, falling toward the board's rim. */
  readonly height: number;
}

export interface HexCell extends HexCellInfo {
  name: string;
  view: DisplayLike;
}

export interface BoardOptions {
  cols?: number;
  rows?: number;
  /** Tile width in design units; default: the board fills ~90 % of the design (or region). */
  size?: number;
  /** The board's centre; default the centre of the design (or region). */
  x?: number;
  y?: number;
  /** A tile name for every cell, or a function of the cell; default: a seeded island. */
  terrain?: string | ((cell: HexCellInfo) => string);
  /** Share of land cells that get a building in the default island (0..0.5; default 0.08). */
  buildings?: number;
  /** Where the board goes: default s.world, else s.stage; null keeps it unattached. */
  parent?: ContainerLike | null;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isContainer(value: unknown): value is ContainerLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { addChild?: unknown }).addChild === 'function'
  );
}

function sceneOf(value: unknown): SceneLike {
  const s = value as Partial<SceneLike> | null;
  if (s === null || typeof s.dispose !== 'function' || typeof s.PIXI?.Sprite !== 'function')
    throw new TypeError('hex: load(s) needs the scene (s)');
  return s as SceneLike;
}

/*
  The atlas is decoded by an <img>, not by Pixi's Assets loader: Assets fetches a data: URL, and
  the unreviewed preview's CSP (connect-src 'none') refuses that fetch, while img-src admits data:.
*/
export async function decodeImage(url: string): Promise<unknown> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}

/** The pack's tile for a terrain and a seeded draw: the plain tile most of the time. */
function islandTile(s: SceneLike, cell: HexCellInfo, buildings: number): string {
  const h = cell.height;
  if (h < -0.12) return 'water';
  const roll = s.random();
  const pick = (options: readonly string[]): string =>
    options[Math.floor(s.random() * options.length)] ?? options[0] ?? 'grass';
  if (h < 0.02) return roll < 0.2 ? pick(['sand-cactus', 'sand-rocks']) : 'sand';
  if (h > 0.42) return roll < 0.45 ? pick(['stone-trees', 'stone-grove']) : 'stone';
  if (h > 0.3) return roll < 0.5 ? pick(['dirt-hills', 'dirt-rocks', 'grass-rock']) : 'dirt';
  if (roll < buildings) return pick(HEX_BUILDINGS);
  return roll < 0.45
    ? pick(['grass-trees', 'grass-forest', 'grass-grove', 'grass-rocks'])
    : 'grass';
}

export interface HexBoard {
  readonly view: ContainerLike;
  readonly cols: number;
  readonly rows: number;
  /** Tile width and height in design units. */
  readonly size: number;
  readonly tileHeight: number;
  readonly cells: readonly HexCell[];
  at(q: number, r: number): HexCell | undefined;
  /** The cell under a point in design units (the board's parent space), or undefined. */
  pick(x: number, y: number): HexCell | undefined;
  /** The up-to-six cells around (q, r). */
  neighbours(q: number, r: number): HexCell[];
  /** Swaps one cell's tile; false for an unknown name or cell. */
  set(q: number, r: number, name: string): boolean;
  destroy(): void;
}

export interface HexSet {
  readonly names: readonly string[];
  tile(name: string, width?: number): DisplayLike;
  board(options?: BoardOptions): HexBoard;
}

const loaded = new WeakMap<object, Promise<HexSet>>();

export function loadHex(
  scene: unknown,
  decode: (url: string) => Promise<unknown> = decodeImage,
): Promise<HexSet> {
  const s = sceneOf(scene);
  const cached = loaded.get(s);
  if (cached !== undefined) return cached;
  const promise = decode(HEX_ATLAS_URL).then((image) => createSet(s, image));
  loaded.set(s, promise);
  return promise;
}

function createSet(s: SceneLike, image: unknown): HexSet {
  const { PIXI } = s;
  const atlas = PIXI.Texture.from(image, true);
  const frames = new Map<string, TextureLike>();
  for (const [name, [x, y]] of Object.entries(HEX_FRAMES)) {
    frames.set(
      name,
      new PIXI.Texture({
        source: atlas.source,
        frame: new PIXI.Rectangle(x, y, HEX_TILE_SIZE.width, HEX_TILE_SIZE.height),
      }),
    );
  }
  s.dispose(() => {
    for (const texture of frames.values()) texture.destroy(false);
    frames.clear();
    atlas.destroy(true);
  });
  const dir = s.dir === -1 ? -1 : 1;

  function water(width: number): GraphicsLike {
    const g = new PIXI.Graphics();
    const w = width / 2;
    const h = (width * ASPECT) / 2;
    const ring = (k: number) => [
      0,
      -h * k,
      w * k,
      -h * 0.5 * k,
      w * k,
      h * 0.5 * k,
      0,
      h * k,
      -w * k,
      h * 0.5 * k,
      -w * k,
      -h * 0.5 * k,
    ];
    // The sea colour a scene can paint behind the board to make the water seamless; a lighter
    // inner hexagon (toward whichever of surface and text is lighter) reads as a glint.
    const { palette } = s;
    const light = palette.dark === true ? palette.text : palette.surface;
    g.poly(ring(1)).fill(palette.mix(palette.accent, palette.surface, HEX_WATER_MIX));
    g.poly(ring(0.55)).fill({ color: palette.mix(palette.accent, light, 0.45), alpha: 0.18 });
    return g;
  }

  function tile(name: string, width: number = HEX_TILE_SIZE.width): DisplayLike {
    const size = Math.min(HEX_LIMITS.maxSize, Math.max(HEX_LIMITS.minSize, finite(width, 120)));
    if (name === 'water') return water(size);
    const texture = frames.get(name);
    if (texture === undefined)
      throw new TypeError(`hex: no tile "${name}" (${HEX_NAMES.join(', ')})`);
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor?.set(0.5);
    sprite.width = size;
    sprite.height = size * ASPECT;
    return sprite;
  }

  function board(input?: unknown): HexBoard {
    const options = (input !== null && typeof input === 'object' ? input : {}) as BoardOptions;
    const cols = Math.min(HEX_LIMITS.maxCols, Math.max(1, Math.round(finite(options.cols, 9))));
    const rows = Math.min(HEX_LIMITS.maxRows, Math.max(1, Math.round(finite(options.rows, 6))));
    const areaW = s.design?.width ?? s.width;
    const areaH = s.design?.height ?? s.height;
    const fit = Math.min(
      (areaW * 0.9) / (cols + (rows > 1 ? 0.5 : 0)),
      (areaH * 0.9) / (ASPECT * (1 + (rows - 1) * ROW_STEP)),
    );
    const size = Math.min(
      HEX_LIMITS.maxSize,
      Math.max(HEX_LIMITS.minSize, finite(options.size, fit)),
    );
    const tileHeight = size * ASPECT;
    const cx = finite(options.x, areaW / 2);
    const cy = finite(options.y, areaH / 2);
    const spanX = (cols - 1 + (rows > 1 ? 0.5 : 0)) * size;
    const spanY = (rows - 1) * ROW_STEP * tileHeight;
    const view = new PIXI.Container();
    view.label = 'hex-board';
    const buildings = Math.min(0.5, Math.max(0, finite(options.buildings, 0.08)));
    const cells: HexCell[] = [];
    const centre = (q: number, r: number): [number, number] => {
      const along = q * size + (r % 2 === 1 ? size / 2 : 0) - spanX / 2;
      return [cx + along * dir, cy + r * ROW_STEP * tileHeight - spanY / 2];
    };
    for (let r = 0; r < rows; r += 1) {
      for (let q = 0; q < cols; q += 1) {
        const [x, y] = centre(q, r);
        const nx = cols > 1 ? (q / (cols - 1)) * 2 - 1 : 0;
        const ny = rows > 1 ? (r / (rows - 1)) * 2 - 1 : 0;
        const rim = Math.max(Math.abs(nx), Math.abs(ny)) ** 2.2;
        const height = Math.max(
          -1,
          Math.min(1, s.fbm(x * 0.004, y * 0.004, 3) * 0.8 + 0.35 - rim * 0.9),
        );
        const info: HexCellInfo = { q, r, x, y, height };
        const wanted =
          typeof options.terrain === 'function' ? options.terrain(info) : options.terrain;
        const name =
          typeof wanted === 'string' && HEX_NAMES.includes(wanted)
            ? wanted
            : islandTile(s, info, buildings);
        const piece = tile(name, size);
        piece.x = x;
        piece.y = y;
        view.addChild(piece);
        cells.push({ ...info, name, view: piece });
      }
    }
    const parent =
      options.parent === null
        ? null
        : isContainer(options.parent)
          ? options.parent
          : isContainer(s.world)
            ? s.world
            : isContainer(s.stage)
              ? s.stage
              : null;
    parent?.addChild(view);
    // Reduced motion draws one still frame: queue it now the tiles are on the stage.
    s.still?.(() => undefined);
    const at = (q: number, r: number): HexCell | undefined =>
      Number.isInteger(q) && Number.isInteger(r) && q >= 0 && r >= 0 && q < cols && r < rows
        ? cells[r * cols + q]
        : undefined;
    return {
      view,
      cols,
      rows,
      size,
      tileHeight,
      cells,
      at,
      pick(x: number, y: number) {
        const row = Math.round(
          (finite(y, Number.NaN) - (cy - spanY / 2)) / (ROW_STEP * tileHeight),
        );
        let best: HexCell | undefined;
        let bestDistance = Infinity;
        for (let r = row - 1; r <= row + 1; r += 1)
          for (let q = 0; q < cols; q += 1) {
            const cell = at(q, r);
            if (cell === undefined) continue;
            const d = Math.hypot((cell.x - x) / size, (cell.y - y) / tileHeight);
            if (d < bestDistance) {
              bestDistance = d;
              best = cell;
            }
          }
        return bestDistance <= 0.58 ? best : undefined;
      },
      neighbours(q: number, r: number) {
        const odd = r % 2 === 1;
        const steps = odd
          ? [
              [1, 0],
              [-1, 0],
              [1, -1],
              [0, -1],
              [1, 1],
              [0, 1],
            ]
          : [
              [1, 0],
              [-1, 0],
              [0, -1],
              [-1, -1],
              [0, 1],
              [-1, 1],
            ];
        return steps
          .map(([dq = 0, dr = 0]) => at(q + dq, r + dr))
          .filter((cell): cell is HexCell => cell !== undefined);
      },
      set(q: number, r: number, name: string) {
        const cell = at(q, r);
        if (cell === undefined || !HEX_NAMES.includes(name)) return false;
        const next = tile(name, size);
        next.x = cell.x;
        next.y = cell.y;
        // Same place in the draw order, so rows still overlap top to bottom.
        const index = view.getChildIndex?.(cell.view) ?? 0;
        if (view.addChildAt === undefined) view.addChild(next);
        else view.addChildAt(next, index);
        cell.view.destroy();
        cell.view = next;
        cell.name = name;
        s.still?.(() => undefined);
        return true;
      },
      destroy() {
        if (view.destroyed !== true) view.destroy({ children: true });
      },
    };
  }

  return Object.freeze({ names: HEX_NAMES, tile, board });
}
