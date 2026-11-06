#!/usr/bin/env node
/*
  Pack Kenney's Animal Pack Remastered heads (CC0) into the one atlas `s.lib.animals` ships
  (2026-11-05).

    node scripts/build-animal-atlas.mjs <unzipped pack folder>
    KENNEY_ANIMAL_PACK=<unzipped pack folder> node scripts/build-animal-atlas.mjs

  Source: https://kenney.nl/assets/animal-pack-remastered (240 assets, CC0; the old "Animal Pack
  Redux" page redirects there). The page's Download button asks
  https://kenney.nl/download-link/6173736574732f616e696d616c2d7061636b2d72656d61737465726564 for a
  signed, expiring link; fetched on 2026-11-05 it was
  https://kenney.nl/download/6173736574732f616e696d616c2d7061636b2d72656d61737465726564/a5483244173f336d18a0aa2582b0f7f7a70bfeb2548a0a17c2985faed0b5357b?expires=1793901503
  and served the pack's zip, 3,600,298 bytes,
  sha256 25c51ae89d0af358d60b75cfcebb76a72e9cb20e38453d90f0dfddd29234069a. Unzip it OUTSIDE the
  repo and pass the folder; the zip never enters the repository.

  Style: "Round" (round heads with details, no outline), the one that reads cutest small. The pack's
  PNGs are only 128 px a head, so the heads are drawn again from the pack's own vector sheet
  (Vector/round.svg, every animal on a 256 × 192 grid): each path is assigned to the grid cell its
  centre falls in, every animal is first rendered at 1× and checked against Kenney's PNG of it
  (PNG/Round/<name>.png: same size, near-identical alpha and colour), then rendered at SCALE,
  trimmed to its pixels, shelf-packed with 2 px gutters, reduced to 256 colours and encoded as one
  lossless WebP (sharp, through the @assetpack/core build pipeline @craftkit/builder-pixi-assets
  already installs). The output is a generated module with the atlas as a data: URL and its frame
  table; `scripts/build-studio-engines.mjs animals` then bundles it into ck-lib-animals.js.
*/

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages/builder/extensions/media-engines');
const outFile = join(packageDir, 'src/studio/libs/animals/atlas.generated.ts');
const fromPixiAssets = createRequire(join(repoRoot, 'packages/builder/pixi-assets/package.json'));
const sharp = createRequire(fromPixiAssets.resolve('@assetpack/core'))('sharp');
const prettier = createRequire(join(repoRoot, 'package.json'))('prettier');

/** Vector/round.svg, row by row (five columns 256 units apart, rows 192 apart, centres at 128). */
export const ANIMAL_GRID = [
  ['snake', 'giraffe', 'penguin', 'panda', 'parrot'],
  ['monkey', 'hippo', 'pig', 'elephant', 'rabbit'],
  ['whale', 'chicken', 'chick', 'horse', 'moose'],
  ['walrus', 'bear', 'narwhal', 'frog', 'buffalo'],
  ['rhino', 'zebra', 'gorilla', 'duck', 'cow'],
  ['goat', 'owl', 'crocodile', 'sloth', 'dog'],
];

/**
  Cells of the sheet that never ship (2026-11-05, the owner's decision): the grid keeps them only so
  every other path still lands in its own cell.
*/
export const EXCLUDED = new Set(['pig']);

/**
  Frame pixels per vector unit: a head is ~128 units, so ~288 px, crisp to ~144 CSS px on a 2×
  screen and still sharp at 200 (1.4× up); the packed atlas stays inside MAX_ATLAS.
*/
const SCALE = 2.25;
/** The largest texture every WebGL device Pixi supports can sample. */
const MAX_ATLAS = 2048;
const GUTTER = 2;
const CELL_W = 256;
const CELL_H = 192;
const ZIP_SHA256 = '25c51ae89d0af358d60b75cfcebb76a72e9cb20e38453d90f0dfddd29234069a';

function packDir() {
  const dir = process.argv[2] ?? process.env.KENNEY_ANIMAL_PACK;
  if (dir === undefined || dir === '') {
    throw new Error('usage: node scripts/build-animal-atlas.mjs <unzipped Animal Pack Remastered>');
  }
  const licence = readFileSync(join(dir, 'License.txt'), 'utf8');
  if (
    !licence.includes('Animal Pack Remastered') ||
    !licence.includes('Creative Commons Zero, CC0')
  ) {
    throw new Error(`${dir}/License.txt is not the Animal Pack Remastered CC0 notice`);
  }
  return dir;
}

/** Each <path> with its bounding box (M, L and Q only, absolute: control points bound the curve). */
function pathsOf(svg) {
  const paths = [];
  for (const match of svg.matchAll(/<path ([^>]*?)\/>/gu)) {
    const d = /\bd="([^"]+)"/u.exec(match[1])?.[1];
    if (d === undefined || /[^MLQ\d\s.,-]/u.test(d))
      throw new Error(`unexpected path: ${match[0]}`);
    const numbers = d.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      x0 = Math.min(x0, numbers[i]);
      x1 = Math.max(x1, numbers[i]);
      y0 = Math.min(y0, numbers[i + 1]);
      y1 = Math.max(y1, numbers[i + 1]);
    }
    paths.push({ element: `<path ${match[1]}/>`, box: [x0, y0, x1, y1] });
  }
  return paths;
}

/** RGBA pixels of an SVG fragment rendered at `scale`, trimmed to its non-transparent pixels. */
async function render(elements, box, scale) {
  const [x0, y0, x1, y1] = [box[0] - 4, box[1] - 4, box[2] + 4, box[3] + 4];
  const width = Math.ceil((x1 - x0) * scale);
  const height = Math.ceil((y1 - y0) * scale);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${(width / scale).toFixed(4)} ${(height / scale).toFixed(4)}">${elements.join('')}</svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return trim(data, info.width, info.height);
}

function trim(data, width, height) {
  let [left, top, right, bottom] = [width, height, -1, -1];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  const w = right - left + 1;
  const h = bottom - top + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    data.copy(out, y * w * 4, ((top + y) * width + left) * 4, ((top + y) * width + right + 1) * 4);
  }
  return { data: out, width: w, height: h };
}

/**
  Our 1× render against Kenney's PNG of the same animal, at the PNG's size: mean |Δalpha| over
  every pixel and mean |Δrgb| over the pixels both draw opaque (0..255). A wrong grid cell or name
  differs in size or by tens; a right one only by anti-aliasing.
*/
async function difference(ours, pngPath) {
  const png = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = png.info;
  if (Math.abs(width - ours.width) > 2 || Math.abs(height - ours.height) > 2) {
    return {
      size: `${ours.width} × ${ours.height} vs ${width} × ${height}`,
      alpha: Infinity,
      rgb: Infinity,
    };
  }
  const resized = await sharp(ours.data, {
    raw: { width: ours.width, height: ours.height, channels: 4 },
  })
    .resize(width, height, { fit: 'fill' })
    .raw()
    .toBuffer();
  let [alpha, rgb, opaque] = [0, 0, 0];
  for (let i = 0; i < resized.length; i += 4) {
    alpha += Math.abs(resized[i + 3] - png.data[i + 3]);
    if (resized[i + 3] < 250 || png.data[i + 3] < 250) continue;
    opaque += 1;
    for (let c = 0; c < 3; c += 1) rgb += Math.abs(resized[i + c] - png.data[i + c]) / 3;
  }
  return {
    size: `${width} × ${height}`,
    alpha: alpha / (width * height),
    rgb: rgb / Math.max(1, opaque),
  };
}

/** Tallest first, then by name; rows fill a fixed width chosen to keep the atlas near-square. */
function shelfPack(frames) {
  const area = frames.reduce((sum, f) => sum + (f.width + GUTTER * 2) * (f.height + GUTTER * 2), 0);
  const atlasWidth = Math.max(
    Math.ceil(Math.sqrt(area * 1.1) / 4) * 4,
    ...frames.map((f) => f.width + GUTTER * 2),
  );
  const order = [...frames].sort((a, b) => b.height - a.height || a.name.localeCompare(b.name));
  let [x, y, rowHeight] = [0, 0, 0];
  for (const frame of order) {
    const w = frame.width + GUTTER * 2;
    if (x + w > atlasWidth) [x, y, rowHeight] = [0, y + rowHeight, 0];
    frame.left = x + GUTTER;
    frame.top = y + GUTTER;
    x += w;
    rowHeight = Math.max(rowHeight, frame.height + GUTTER * 2);
  }
  return { width: atlasWidth, height: y + rowHeight };
}

async function main() {
  const dir = packDir();
  const svgPath = join(dir, 'Vector/round.svg');
  const paths = pathsOf(readFileSync(svgPath, 'utf8'));
  const groups = ANIMAL_GRID.flat().map((name) => ({
    name,
    elements: [],
    box: [Infinity, Infinity, -Infinity, -Infinity],
  }));
  for (const { element, box } of paths) {
    const col = Math.round(((box[0] + box[2]) / 2 - 128) / CELL_W);
    const row = Math.round(((box[1] + box[3]) / 2 - 128) / CELL_H);
    const group = groups[row * 5 + col];
    if (col < 0 || col > 4 || group === undefined)
      throw new Error(`a path outside the grid: ${box}`);
    group.elements.push(element);
    group.box = [
      Math.min(group.box[0], box[0]),
      Math.min(group.box[1], box[1]),
      Math.max(group.box[2], box[2]),
      Math.max(group.box[3], box[3]),
    ];
  }
  const frames = [];
  for (const group of groups) {
    if (EXCLUDED.has(group.name)) continue;
    const png = join(dir, 'PNG/Round', `${group.name}.png`);
    if (!existsSync(png))
      throw new Error(`${group.name}: no PNG/Round/${group.name}.png in the pack`);
    const check = await difference(await render(group.elements, group.box, 1), png);
    if (!(check.alpha < 8 && check.rgb < 8)) {
      throw new Error(
        `${group.name}: the vector cell does not match Kenney's PNG (${check.size}, Δα ${check.alpha}, Δrgb ${check.rgb})`,
      );
    }
    const art = await render(group.elements, group.box, SCALE);
    frames.push({ name: group.name, paths: group.elements.length, check, ...art });
  }
  const { width, height } = shelfPack(frames);
  if (width > MAX_ATLAS || height > MAX_ATLAS) {
    throw new Error(`atlas ${width} × ${height} exceeds ${MAX_ATLAS} px: lower SCALE`);
  }
  const composites = await Promise.all(
    frames.map(async (f) => ({
      input: await sharp(f.data, { raw: { width: f.width, height: f.height, channels: 4 } })
        .png()
        .toBuffer(),
      left: f.left,
      top: f.top,
    })),
  );
  const canvas = await sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
  // Flat-colour art: 256 colours (libimagequant, undithered) then lossless WebP, which keeps the
  // palette, is about half the bytes of lossless RGBA and a third smaller than lossy WebP q85.
  const quantized = await sharp(canvas)
    .png({ palette: true, colours: 256, dither: 0, effort: 10 })
    .toBuffer();
  const webp = await sharp(quantized).webp({ lossless: true, quality: 100, effort: 6 }).toBuffer();
  const sha256 = createHash('sha256').update(webp).digest('hex');
  const names = ANIMAL_GRID.flat()
    .filter((name) => !EXCLUDED.has(name))
    .sort();
  const byName = new Map(frames.map((f) => [f.name, f]));
  const table = Object.fromEntries(
    names.map((name) => {
      const f = byName.get(name);
      return [name, [f.left, f.top, f.width, f.height]];
    }),
  );
  const moduleText = `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    node scripts/build-animal-atlas.mjs <the unzipped Animal Pack Remastered zip>

  ${names.length} heads of Kenney's Animal Pack Remastered, "Round" style (details, no outline), drawn
  from the pack's Vector/round.svg at ${SCALE}× (a head is ~${Math.round(128 * SCALE)} px wide), as one
  256-colour lossless WebP: ${width} × ${height} px, ${webp.length} bytes. The zip's sha256 is
  ${ZIP_SHA256}.

  Animal Pack Remastered by Kenney Vleugels (Kenney.nl).
  License (Creative Commons Zero, CC0): http://creativecommons.org/publicdomain/zero/1.0/
  "You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl)
  would be nice but is not mandatory."
*/

export const ANIMAL_ATLAS_SIZE = { width: ${width}, height: ${height} } as const;

/** Frame pixels per unit of the pack's vector art (Kenney's PNGs are 1×). */
export const ANIMAL_ATLAS_SCALE = ${SCALE};

/** sha256 (hex) of the WebP bytes inside ANIMAL_ATLAS_URL. */
export const ANIMAL_ATLAS_SHA256 = ${JSON.stringify(sha256)};

/** Each head's frame in the atlas: [x, y, width, height], by name (sorted). */
export const ANIMAL_FRAMES: Readonly<Record<string, readonly [number, number, number, number]>> = ${JSON.stringify(table)};

// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- keep the generated asset out of the inferred literal type
export const ANIMAL_ATLAS_URL: string = ${JSON.stringify(`data:image/webp;base64,${webp.toString('base64')}`)};
`;
  const options = (await prettier.resolveConfig(outFile)) ?? {};
  writeFileSync(outFile, await prettier.format(moduleText, { ...options, filepath: outFile }));
  for (const f of frames) {
    console.log(
      `  ${f.name.padEnd(10)} ${f.paths} paths, ${f.width} × ${f.height}, 1× check ${f.check.size} Δα ${f.check.alpha.toFixed(2)} Δrgb ${f.check.rgb.toFixed(2)}`,
    );
  }
  console.log(
    `animal atlas: ${frames.length} heads at ${SCALE}×, ${width} × ${height}, ${webp.length} bytes WebP, sha256 ${sha256}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
