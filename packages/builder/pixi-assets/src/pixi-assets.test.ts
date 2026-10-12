import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

import { AssetPack } from '@assetpack/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parsePixiAssetsArgs } from './cli.ts';
import { PIXI_ASSET_DEFAULTS, pixiAssetsConfig } from './config.ts';
import {
  parsePixiManifest,
  readPixiManifest,
  summarizePixiManifest,
  type PixiManifest,
} from './manifest.ts';
import { defaultPixiAssetsOutput } from './vite-plugin.ts';

/** A solid-colour RGBA PNG, encoded by hand so the test needs no image library. */
function png(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): Buffer {
  const row = width * 4 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) raw.set(rgba, y * row + 1 + x * 4);
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A tenth of a second of 8 kHz mono silence. */
function wav(): Buffer {
  const samples = 800;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + samples * 2, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(16000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(samples * 2, 40);
  return Buffer.concat([header, Buffer.alloc(samples * 2)]);
}

let root = '';
let output = '';
let manifest: PixiManifest = { bundles: [] };

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'pixi-assets-'));
  const game = join(root, 'raw', 'game{m}');
  await mkdir(join(game, 'ui{tps}'), { recursive: true });
  await writeFile(join(game, 'hero.png'), png(64, 64, [200, 40, 40, 255]));
  await writeFile(join(game, 'ui{tps}', 'btn-a.png'), png(16, 16, [40, 200, 40, 255]));
  await writeFile(join(game, 'ui{tps}', 'btn-b.png'), png(16, 16, [40, 40, 200, 255]));
  await writeFile(join(game, 'jump.wav'), wav());
  output = join(root, 'public', 'assets');
  const config = pixiAssetsConfig({
    entry: join(root, 'raw'),
    output,
    cacheLocation: join(root, '.assetpack'),
    strict: true,
    logLevel: 'error',
  });
  await new AssetPack(config).run();
  manifest = await readPixiManifest(output);
});

afterAll(async () => {
  if (root !== '') await rm(root, { recursive: true, force: true });
});

function assetNamed(alias: string) {
  return manifest.bundles
    .flatMap(({ assets }) => assets)
    .find((asset) => asset.alias.includes(alias));
}

describe('pixiAssetsConfig — a real AssetPack run', () => {
  it('makes a manifest bundle of each {m} folder, beside AssetPack’s default bundle', () => {
    const filled = manifest.bundles.filter(({ assets }) => assets.length > 0);
    expect(filled.map(({ name }) => name)).toEqual(['game']);
    expect(manifest.bundles.map(({ name }) => name)).toContain('default');
  });

  it('writes each image as WebP and PNG, at full and half resolution, with hashed names', () => {
    const hero = assetNamed('hero');
    expect(hero?.src.some((src) => src.endsWith('.webp'))).toBe(true);
    expect(hero?.src.some((src) => src.endsWith('.png'))).toBe(true);
    expect(hero?.src.some((src) => src.includes('@0.5x'))).toBe(true);
    expect(hero?.src.every((src) => /-[\w-]{4,}(@0\.5x)?\.(webp|png)$/u.test(src))).toBe(true);
  });

  it('packs a {tps} folder into one texture atlas PixiJS loads as a spritesheet', async () => {
    const atlas = assetNamed('ui');
    expect(atlas?.src.some((src) => src.endsWith('.json'))).toBe(true);
    const files = await readdir(output, { recursive: true });
    expect(files.some((file) => /ui.*\.json$/u.test(file))).toBe(true);
    expect(assetNamed('btn-a')).toBeUndefined();
  });

  it('compresses audio with ffmpeg', () => {
    const jump = assetNamed('jump');
    expect(jump?.src.length).toBeGreaterThan(0);
    expect(jump?.src.every((src) => /\.(mp3|ogg|m4a|webm)$/u.test(src))).toBe(true);
  });

  it('summarises each bundle in one line', () => {
    const lines = summarizePixiManifest(manifest);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^game: \d+ assets \(.*webp.*; 1x, 0\.5x\)$/u);
  });
});

describe('the preset and its readers', () => {
  it('keeps the guide’s defaults and adds WebP beside PNG and JPEG', () => {
    expect(PIXI_ASSET_DEFAULTS.resolutions).toEqual({ default: 1, low: 0.5 });
    expect(PIXI_ASSET_DEFAULTS.formats).toEqual({ webp: true, avif: false, png: true, jpg: true });
    const config = pixiAssetsConfig({ entry: 'raw', output: 'out' });
    expect(config.entry).toBe('raw');
    expect(config.output).toBe('out');
    expect(config.pipes?.length).toBeGreaterThan(5);
  });

  it('reads a manifest defensively', () => {
    expect(parsePixiManifest(null)).toEqual({ bundles: [] });
    expect(
      parsePixiManifest({
        bundles: [{ name: 'a', assets: [{ alias: 'x', src: ['x.png'] }, 4] }, { assets: [] }],
      }),
    ).toEqual({ bundles: [{ name: 'a', assets: [{ alias: ['x'], src: ['x.png'] }] }] });
  });

  it('reads the command line, and says how to call it when it cannot', () => {
    expect(parsePixiAssetsArgs(['build', '--entry', 'raw', '--output', 'out', '--avif'])).toEqual({
      ok: true,
      command: {
        mode: 'build',
        options: {
          entry: 'raw',
          output: 'out',
          cacheBust: true,
          strict: false,
          formats: { avif: true },
        },
      },
    });
    const refused = parsePixiAssetsArgs(['pack', '--entry', 'raw']);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? '' : refused.error).toContain('Usage: craftkit-pixi-assets');
  });

  it('writes into Vite’s public folder when no output is given', () => {
    expect(defaultPixiAssetsOutput({ publicDir: '/app/public', root: '/app' })).toBe(
      '/app/public/assets',
    );
    expect(defaultPixiAssetsOutput({ publicDir: '', root: '/app' })).toBeUndefined();
  });
});
