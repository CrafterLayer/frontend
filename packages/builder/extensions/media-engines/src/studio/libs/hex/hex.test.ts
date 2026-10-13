import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createNoise } from '../../kit/noise';
import { createRandom } from '../../kit/random';
import { createHexLibrary, HEX_CREDIT } from '../hex-entry';
import { fakePixi } from '../shared/fake-pixi.test-util';
import {
  HEX_ATLAS_SHA256,
  HEX_ATLAS_SIZE,
  HEX_ATLAS_URL,
  HEX_FRAME_SOURCES,
  HEX_FRAMES,
  HEX_TILE_SIZE,
} from './atlas.generated';
import { HEX_NAMES, loadHex } from './board';

class FrameTexture {
  destroyed = false;
  destroyedSource: boolean | undefined;

  constructor(readonly options: { source: unknown; frame: { x: number; y: number } }) {}

  destroy(destroySource?: boolean): void {
    this.destroyed = true;
    this.destroyedSource = destroySource;
  }
}

/* A scene stand-in: fake Pixi (plus Texture frames), seeded random and noise, s.texture and dispose. */
function scene(options: { seed?: number; dir?: 1 | -1 } = {}) {
  const random = createRandom(options.seed ?? 4);
  const noise = createNoise(options.seed ?? 4);
  const { PIXI, app } = fakePixi();
  const disposers: (() => void)[] = [];
  const loads: string[] = [];
  const stills: number[] = [];
  const textures: FrameTexture[] = [];
  const world = new PIXI.Container();
  const image = { label: 'decoded atlas image' };
  const atlas = {
    source: { label: 'atlas-source' },
    image,
    destroyed: false as boolean | undefined,
  };
  return {
    PIXI: {
      ...PIXI,
      Texture: class extends FrameTexture {
        constructor(init: { source: unknown; frame: { x: number; y: number } }) {
          super(init);
          textures.push(this);
        }

        static from(resource: unknown, skipCache?: boolean) {
          expect(resource).toBe(image);
          expect(skipCache).toBe(true);
          return {
            source: atlas.source,
            destroy(destroySource?: boolean) {
              atlas.destroyed = destroySource;
            },
          };
        }
      },
    },
    stage: app.stage,
    world,
    width: 1280,
    height: 720,
    design: { width: 1280, height: 720 },
    dir: options.dir ?? 1,
    palette: { accent: 0x2266aa, surface: 0x101525, text: 0xf1f5f9, mix: () => 0x335577 },
    random: () => random.random(),
    fbm: (x: number, y: number, octaves?: number) => noise.fbm(x, y, octaves),
    decode: (url: string) => {
      loads.push(url);
      return Promise.resolve(image);
    },
    dispose(fn: () => void) {
      disposers.push(fn);
    },
    still() {
      stills.push(1);
    },
    atlas,
    loads,
    stills,
    textures,
    end: () => {
      for (const fn of disposers) fn();
    },
  };
}

/* The scene's atlas through the fake decoder (an <img> in the browser; see the Chromium test). */
function load(s: ReturnType<typeof scene>) {
  return loadHex(s, s.decode);
}

describe('hex library', () => {
  it('ships 28 Kenney tiles in one lossless WebP whose hash and frames are what the build wrote', () => {
    const lib = createHexLibrary();
    expect(Object.isFrozen(lib)).toBe(true);
    expect(lib.credit).toBe(HEX_CREDIT);
    expect(lib.credit).toMatch(/Kenney.*CC0 1\.0/u);
    expect(lib.names).toEqual([...Object.keys(HEX_FRAMES), 'water']);
    expect(Object.keys(HEX_FRAMES)).toHaveLength(28);
    expect(lib.terrains).toEqual(['grass', 'dirt', 'sand', 'mars', 'stone']);
    for (const terrain of lib.terrains) expect(HEX_FRAMES[terrain]).toBeDefined();
    for (const building of lib.buildings) expect(HEX_FRAMES[building]).toBeDefined();
    expect(lib.sources['castle']).toBe('medieval_smallCastle');
    expect(Object.keys(HEX_FRAME_SOURCES)).toEqual(Object.keys(HEX_FRAMES));

    const bytes = Buffer.from(HEX_ATLAS_URL.replace(/^data:image\/webp;base64,/u, ''), 'base64');
    expect(HEX_ATLAS_URL.startsWith('data:image/webp;base64,')).toBe(true);
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
    // VP8L: the lossless bitstream; its header carries the atlas size.
    expect(bytes.subarray(12, 16).toString('latin1')).toBe('VP8L');
    const bits = bytes.readUInt32LE(21);
    expect((bits & 0x3fff) + 1).toBe(HEX_ATLAS_SIZE.width);
    expect(((bits >> 14) & 0x3fff) + 1).toBe(HEX_ATLAS_SIZE.height);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(HEX_ATLAS_SHA256);
    expect(lib.atlasSha256).toBe(HEX_ATLAS_SHA256);
    for (const [x, y] of Object.values(HEX_FRAMES)) {
      expect(x + HEX_TILE_SIZE.width).toBeLessThanOrEqual(HEX_ATLAS_SIZE.width);
      expect(y + HEX_TILE_SIZE.height).toBeLessThanOrEqual(HEX_ATLAS_SIZE.height);
    }
  });

  it('records the pack it came from: kenney-hexagon-pack 1.0.0, CC0, and its licence travels', () => {
    const root = resolve(import.meta.dirname, '../../../..');
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'node_modules/kenney-hexagon-pack/package.json'), 'utf8'),
    ) as { version: string; license: string };
    expect(manifest).toMatchObject({ version: '1.0.0', license: 'CC0 1.0' });
    const licence = readFileSync(resolve(root, 'vendor/kenney-hexagon-pack/LICENSE'), 'utf8');
    expect(licence).toContain('by Kenney Vleugels for Kenney (www.kenney.nl)');
    expect(licence).toContain('License (Creative Commons Zero, CC0)');
    expect(licence).toContain('CC0 1.0 Universal');
    expect(licence).toContain('Statement of Purpose');
  });

  it('decodes the atlas once per scene (an <img>, no fetch) and frees it with the scene', async () => {
    const s = scene();
    const [first, second] = await Promise.all([loadHex(s, s.decode), loadHex(s, s.decode)]);
    expect(first).toBe(second);
    expect(s.loads).toEqual([HEX_ATLAS_URL]);
    expect(s.textures).toHaveLength(28);
    expect(s.textures.every((texture) => texture.options.source === s.atlas.source)).toBe(true);
    const castle = s.textures[Object.keys(HEX_FRAMES).indexOf('castle')];
    expect(castle?.options.frame).toMatchObject({
      x: HEX_FRAMES['castle']?.[0],
      y: HEX_FRAMES['castle']?.[1],
    });
    s.end();
    expect(
      s.textures.every((texture) => texture.destroyed && texture.destroyedSource === false),
    ).toBe(true);
    expect(s.atlas.destroyed).toBe(true);
    expect(() => loadHex({})).toThrow(/needs the scene/u);
  });

  it('lays a seeded island board, centred on the design, that mirrors in RTL', async () => {
    const ltr = await load(scene({ seed: 9 }));
    const board = ltr.board({ cols: 9, rows: 6 });
    expect(board.cells).toHaveLength(54);
    for (const cell of board.cells) expect(HEX_NAMES).toContain(cell.name);
    expect(board.cells.some((cell) => cell.name === 'water')).toBe(true);
    expect(board.cells.some((cell) => cell.name.startsWith('grass'))).toBe(true);
    const xs = board.cells.map((cell) => cell.x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(640, 0);
    expect(board.size * 9.5).toBeLessThanOrEqual(1280 * 0.9 + 1e-6);
    const again = (await load(scene({ seed: 9 }))).board({ cols: 9, rows: 6 });
    expect(again.cells.map((cell) => cell.name)).toEqual(board.cells.map((cell) => cell.name));

    const rtl = (await load(scene({ seed: 9, dir: -1 }))).board({ cols: 9, rows: 6 });
    const a = rtl.at(0, 2)!;
    const b = rtl.at(1, 2)!;
    expect(a.x).toBeGreaterThan(b.x);
    expect(a.x).toBeCloseTo(1280 - (board.at(0, 2)?.x ?? 0), 6);
  });

  it('picks, finds neighbours, swaps tiles and takes a terrain of the author’s', async () => {
    const s = scene();
    const set = await load(s);
    const board = set.board({
      cols: 7,
      rows: 5,
      terrain: (cell) => (cell.q === 3 ? 'water' : 'sand'),
    });
    expect(board.at(3, 1)?.name).toBe('water');
    expect(board.at(2, 1)?.name).toBe('sand');
    const middle = board.at(3, 2)!;
    expect(board.pick(middle.x, middle.y)).toBe(middle);
    expect(board.pick(middle.x + board.size * 0.2, middle.y)).toBe(middle);
    expect(board.pick(-500, -500)).toBeUndefined();
    expect(board.neighbours(3, 2)).toHaveLength(6);
    expect(board.neighbours(0, 0).length).toBeLessThan(6);
    for (const cell of board.neighbours(3, 2)) {
      expect(Math.hypot(cell.x - middle.x, cell.y - middle.y)).toBeLessThan(board.size * 1.1);
    }
    const before = board.at(1, 1)?.view;
    expect(board.set(1, 1, 'castle')).toBe(true);
    expect(board.at(1, 1)?.name).toBe('castle');
    expect(before?.destroyed).toBe(true);
    expect(board.set(1, 1, 'dragon')).toBe(false);
    expect(board.set(99, 1, 'castle')).toBe(false);
    expect(s.world.children).toContain(board.view);
    expect(s.stills.length).toBeGreaterThan(0);
    expect(() => set.tile('dragon')).toThrow(/no tile "dragon"/u);
    const sprite = set.tile('windmill', 60);
    expect(sprite.width).toBe(60);
    expect(sprite.height).toBeCloseTo(70, 6);
    board.destroy();
    expect(board.view.destroyed).toBe(true);
  });
});
