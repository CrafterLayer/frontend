#!/usr/bin/env node
/*
  Pack the curated Kenney Hexagon Pack tiles (CC0) into the one atlas `s.lib.hex` ships.

    node scripts/build-hex-atlas.mjs

  Reads kenney-hexagon-pack@1.0.0 (a devDependency of @craftkit/builder-media-engines; the package
  itself never ships) as data: its unmodified Kenney sprite sheets and their Starling XML frame
  lists. 28 tiles of 120 × 140 px — twenty terrain tiles and eight buildings — are cut out
  unscaled, packed 7 × 4 with 2 px gutters and encoded as one lossless WebP (sharp, through the
  @assetpack/core build pipeline @craftkit/builder-pixi-assets already installs). The output is a
  generated module with the atlas as a data: URL, its frame table and the source of every frame;
  `scripts/build-studio-engines.mjs hex` then bundles it into ck-lib-hex.js.
*/

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages/builder/extensions/media-engines');
const outFile = join(packageDir, 'src/studio/libs/hex/atlas.generated.ts');
const pack = join(packageDir, 'node_modules/kenney-hexagon-pack');
const sheets = join(pack, 'assets/spritesheets');
const fromPixiAssets = createRequire(join(repoRoot, 'packages/builder/pixi-assets/package.json'));
const sharp = createRequire(fromPixiAssets.resolve('@assetpack/core'))('sharp');
const prettier = createRequire(join(repoRoot, 'package.json'))('prettier');

/** Our tile name → the pack's frame name. Order is the atlas order. */
export const HEX_TILES = [
  ['grass', 'grass_05'],
  ['grass-trees', 'grass_10'],
  ['grass-forest', 'grass_12'],
  ['grass-grove', 'grass_13'],
  ['grass-rock', 'grass_14'],
  ['grass-rocks', 'grass_15'],
  ['dirt', 'dirt_06'],
  ['dirt-trees', 'dirt_12'],
  ['dirt-rocks', 'dirt_15'],
  ['dirt-hills', 'dirt_17'],
  ['sand', 'sand_07'],
  ['sand-cactus', 'sand_12'],
  ['sand-cacti', 'sand_14'],
  ['sand-rocks', 'sand_17'],
  ['mars', 'mars_07'],
  ['mars-crystals', 'mars_13'],
  ['mars-rocks', 'mars_18'],
  ['stone', 'stone_07'],
  ['stone-trees', 'stone_12'],
  ['stone-grove', 'stone_13'],
  ['house', 'medieval_house'],
  ['cabin', 'medieval_cabin'],
  ['farm', 'medieval_farm'],
  ['windmill', 'medieval_windmill'],
  ['castle', 'medieval_smallCastle'],
  ['tower', 'medieval_tower'],
  ['lumber', 'medieval_lumber'],
  ['camp', 'modern_campsite'],
];

const TILE_W = 120;
const TILE_H = 140;
const GUTTER = 2;
const COLS = 7;

function framesOf(sheet) {
  const xml = readFileSync(join(sheets, `${sheet}.xml`), 'utf8');
  const frames = new Map();
  for (const match of xml.matchAll(
    /<SubTexture name="([\w-]+)\.png" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/gu,
  )) {
    frames.set(match[1], {
      sheet,
      x: +match[2],
      y: +match[3],
      width: +match[4],
      height: +match[5],
    });
  }
  return frames;
}

async function main() {
  const manifest = JSON.parse(readFileSync(join(pack, 'package.json'), 'utf8'));
  if (manifest.version !== '1.0.0' || manifest.license !== 'CC0 1.0') {
    throw new Error(`unexpected kenney-hexagon-pack ${manifest.version} (${manifest.license})`);
  }
  const frames = new Map([
    ...framesOf('hexagonTerrain_sheet'),
    ...framesOf('hexagonBuildings_sheet'),
  ]);
  const rows = Math.ceil(HEX_TILES.length / COLS);
  const width = COLS * (TILE_W + GUTTER * 2);
  const height = rows * (TILE_H + GUTTER * 2);
  const composites = [];
  const table = {};
  for (const [index, [name, frameName]] of HEX_TILES.entries()) {
    const frame = frames.get(frameName);
    if (frame === undefined || frame.width !== TILE_W || frame.height !== TILE_H) {
      throw new Error(`${frameName}: missing, or not a ${TILE_W} × ${TILE_H} tile`);
    }
    const left = (index % COLS) * (TILE_W + GUTTER * 2) + GUTTER;
    const top = Math.floor(index / COLS) * (TILE_H + GUTTER * 2) + GUTTER;
    const input = await sharp(join(sheets, `${frame.sheet}.png`))
      .extract({ left: frame.x, top: frame.y, width: TILE_W, height: TILE_H })
      .png()
      .toBuffer();
    composites.push({ input, left, top });
    table[name] = [left, top];
  }
  const webp = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .webp({ lossless: true, quality: 100, effort: 6 })
    .toBuffer();
  const sha256 = createHash('sha256').update(webp).digest('hex');
  const sources = Object.fromEntries(HEX_TILES);
  const moduleText = `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    node scripts/build-hex-atlas.mjs

  ${HEX_TILES.length} tiles of Kenney's Hexagon Pack (kenney-hexagon-pack@1.0.0), unscaled, as one
  lossless WebP: ${width} × ${height} px, ${webp.length} bytes.

  Hexagon pack by Kenney Vleugels for Kenney (www.kenney.nl).
  License (Creative Commons Zero, CC0): http://creativecommons.org/publicdomain/zero/1.0/
  "You may use these textures/photographs in personal and commercial projects. Credit (Kenney or
  www.kenney.nl) would be nice but is not mandatory."
*/

export const HEX_ATLAS_SIZE = { width: ${width}, height: ${height} } as const;
export const HEX_TILE_SIZE = { width: ${TILE_W}, height: ${TILE_H} } as const;

/** sha256 (hex) of the WebP bytes inside HEX_ATLAS_URL. */
export const HEX_ATLAS_SHA256 = ${JSON.stringify(sha256)};

/** Each tile's top-left corner in the atlas. */
export const HEX_FRAMES: Readonly<Record<string, readonly [number, number]>> = ${JSON.stringify(table)};

/** Each tile's frame in kenney-hexagon-pack's sprite sheets. */
export const HEX_FRAME_SOURCES: Readonly<Record<string, string>> = ${JSON.stringify(sources)};

// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- keep the generated asset out of the inferred literal type
export const HEX_ATLAS_URL: string = ${JSON.stringify(`data:image/webp;base64,${webp.toString('base64')}`)};
`;
  const options = (await prettier.resolveConfig(outFile)) ?? {};
  writeFileSync(outFile, await prettier.format(moduleText, { ...options, filepath: outFile }));
  console.log(
    `hex atlas: ${HEX_TILES.length} tiles, ${width} × ${height}, ${webp.length} bytes WebP, sha256 ${sha256}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
