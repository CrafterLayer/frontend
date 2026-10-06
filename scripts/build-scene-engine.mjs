#!/usr/bin/env node
/*
  Build the canvas scene engine (media-motion DESIGN §D.3).

    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    node scripts/build-scene-engine.mjs

  1. esbuild (the catalog version, resolved from @craftkit/builder-media-engines)
     bundles packages/builder/extensions/media-engines/src/entry.ts plus a
     one-line runner `installSceneEngine(window)` into ONE minified IIFE
     (es2020, browser, no code splitting: an injected <script> cannot chunk).
  2. Every npm package that lands in the bundle is read from the esbuild
     metafile; its package.json licence AND its LICENSE file are read (never
     assumed). Anything that is not MIT, ISC or Apache-2.0 is printed loudly and
     listed for the owner; its notice still goes in the banner. Packages
     esbuild read but tree-shook to zero bytes are printed and not bannered.
  3. packages/builder/renderer/src/engines/scene-source.ts is written
     (GENERATED): PIXI_VERSION, SCENE_SHA256, SCENE_BANNER, SCENE_SOURCE.
     SCENE_SOURCE = SCENE_BANNER + bundle, so the export can emit it alone as
     assets/ck-scene.js and the licence notices travel with every copy;
     SCENE_SHA256 is the sha256 of the bundle part (everything after the banner).
  4. The gzip size is printed; above 200 kB gzip the build fails and the
     generated module is left untouched.
*/

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages/builder/extensions/media-engines');
const outFile = join(repoRoot, 'packages/builder/renderer/src/engines/scene-source.ts');
const BUDGET_GZIP_BYTES = 200 * 1000;
const ALLOWED_LICENCES = new Set(['MIT', 'ISC', 'Apache-2.0']);
const BUILD_COMMAND = 'node scripts/build-scene-engine.mjs';

const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const esbuild = requireFromPackage('esbuild');
const esbuildVersion = requireFromPackage('esbuild/package.json').version;

const RUNNER =
  "import { installSceneEngine } from './src/entry.ts';\ninstallSceneEngine(window);\n";

const result = await esbuild.build({
  stdin: {
    contents: RUNNER,
    resolveDir: packageDir,
    sourcefile: 'ck-scene-runner.ts',
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  splitting: false,
  write: false,
  metafile: true,
  legalComments: 'none',
  charset: 'utf8',
  tsconfig: join(packageDir, 'tsconfig.json'),
  logLevel: 'warning',
});

const outputFile = result.outputFiles?.[0];
if (outputFile === undefined) {
  throw new Error('esbuild produced no output');
}
const bundle = outputFile.text.replace(/\s+$/u, '');
if (bundle.includes('import(') && /\bimport\(\s*["'`]/u.test(bundle)) {
  throw new Error(
    'bundle still contains a dynamic import(); an injected <script> cannot load chunks',
  );
}

/* ── Licences of every bundled package ─────────────────────────────────── */

/** `.../node_modules/@scope/name/lib/x.mjs` → the package root of the LAST node_modules segment. */
function packageRootOf(inputPath) {
  const absolute = resolve(repoRoot, inputPath);
  const parts = absolute.split(sep);
  const index = parts.lastIndexOf('node_modules');
  if (index === -1) {
    return undefined;
  }
  const first = parts[index + 1] ?? '';
  const length = first.startsWith('@') ? 2 : 1;
  return parts.slice(0, index + 1 + length).join(sep);
}

function readLicenceFile(root) {
  const candidates = readdirSync(root).filter((name) => /^(licen[cs]e|copying)(\.|$)/iu.test(name));
  for (const name of candidates) {
    const text = readFileSync(join(root, name), 'utf8').trim();
    if (text !== '') {
      return { file: name, text };
    }
  }
  return undefined;
}

function classifyText(text) {
  if (/Permission is hereby granted, free of charge/iu.test(text)) return 'MIT';
  if (/Permission to use, copy, modify, and\/or distribute this software for any/iu.test(text))
    return 'ISC';
  if (/Apache License,?\s+Version 2\.0/iu.test(text)) return 'Apache-2.0';
  if (
    /Redistribution and use in source and binary forms/iu.test(text) &&
    /Neither the name/iu.test(text)
  )
    return 'BSD-3-Clause';
  return 'UNKNOWN';
}

function copyrightLines(text) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^(\(c\)|copyright|©)/iu.test(line))
    .slice(0, 3);
}

const packages = new Map();
const ownInputs = [];
for (const inputPath of Object.keys(result.metafile.inputs)) {
  if (inputPath.startsWith('<stdin>') || inputPath === 'ck-scene-runner.ts') {
    continue;
  }
  const root = packageRootOf(inputPath);
  if (root === undefined) {
    ownInputs.push(relative(repoRoot, resolve(repoRoot, inputPath)));
    continue;
  }
  if (!packages.has(root)) {
    packages.set(root, { bytes: 0 });
  }
  const outputInputs =
    result.metafile.outputs[Object.keys(result.metafile.outputs)[0]]?.inputs ?? {};
  packages.get(root).bytes += outputInputs[inputPath]?.bytesInOutput ?? 0;
}

const licences = [];
for (const [root, { bytes }] of packages) {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const declared =
    typeof manifest.license === 'string'
      ? manifest.license
      : JSON.stringify(manifest.license ?? manifest.licenses ?? null);
  const file = readLicenceFile(root);
  const fromText = file === undefined ? 'MISSING' : classifyText(file.text);
  licences.push({
    name: manifest.name,
    version: manifest.version,
    declared,
    fromText,
    file: file?.file ?? null,
    text: file?.text ?? '',
    copyright:
      file === undefined
        ? [typeof manifest.author === 'string' ? `author: ${manifest.author}` : ''].filter(Boolean)
        : copyrightLines(file.text),
    bytesInOutput: bytes,
  });
}
licences.sort((a, b) =>
  a.name === 'pixi.js' ? -1 : b.name === 'pixi.js' ? 1 : a.name.localeCompare(b.name),
);

// Inputs esbuild read but tree-shook to zero bytes ship nothing; they are printed, not bannered.
const shipped = licences.filter((entry) => entry.bytesInOutput > 0);
const shakenOut = licences.filter((entry) => entry.bytesInOutput === 0);

const rejected = shipped.filter(
  (entry) =>
    !ALLOWED_LICENCES.has(entry.declared) ||
    (entry.fromText !== entry.declared && entry.fromText !== 'MISSING'),
);
const missingText = shipped.filter((entry) => entry.fromText === 'MISSING');

const pixi = licences.find((entry) => entry.name === 'pixi.js');
if (pixi === undefined) {
  throw new Error('pixi.js is not in the bundle metafile; did the entry change?');
}

/* ── Banner ────────────────────────────────────────────────────────────── */

const sha256 = createHash('sha256').update(bundle, 'utf8').digest('hex');
const safe = (text) => text.replaceAll('*/', '* /');
const licenceBodies = new Map();
for (const entry of shipped) {
  if (entry.text !== '' && !licenceBodies.has(entry.fromText)) {
    // The first package of each licence kind supplies the body; the permission text is identical across them.
    licenceBodies.set(entry.fromText, entry);
  }
}

const bannerLines = [
  '/*!',
  ` * CraftKit canvas scene engine (ck-scene.js) — PixiJS ${pixi.version} subset + CraftKit scenes.`,
  ` * GENERATED by \`${BUILD_COMMAND}\` (esbuild ${esbuildVersion}, iife, es2020, minified).`,
  ` * sha256(bundle after this banner) = ${sha256}`,
  ' *',
  ' * Bundled third-party packages (name@version — licence — copyright):',
  ...shipped.map(
    (entry) =>
      ` *   ${entry.name}@${entry.version} — ${entry.declared}${entry.copyright.length > 0 ? ` — ${entry.copyright.join('; ')}` : ''}`,
  ),
  ' *',
  ...[...licenceBodies.values()].flatMap((entry) => [
    ` * ${entry.fromText} licence text (as shipped by ${entry.name}; it applies to every ${entry.fromText} package above with its own copyright line):`,
    ...entry.text.split(/\r?\n/u).map((line) => ` *   ${line}`.trimEnd()),
    ' *',
  ]),
];
// Licence text may contain `*/`; neutralise it in the body, then close the comment.
const banner = `${safe(bannerLines.join('\n'))}\n */\n`;
if (banner.indexOf('*/') !== banner.length - 3) {
  throw new Error('banner comment would close early');
}
const source = `${banner}${bundle}\n`;

const gzipBytes = gzipSync(source, { level: 9 }).length;
const gzipBundleBytes = gzipSync(bundle, { level: 9 }).length;

/* ── Generated module ──────────────────────────────────────────────────── */

const moduleText = `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    ${BUILD_COMMAND}

  Source: packages/builder/extensions/media-engines/src/entry.ts (+ src/scenes/*),
  bundled with pixi.js ${pixi.version} (MIT) from the pnpm catalog by esbuild ${esbuildVersion}
  (format iife, target es2020, minified, no splitting). The bundle ends by calling
  installSceneEngine(window), which registers \`window.ckEngines.engines.scene\`
  (media-motion DESIGN §2.3).

  Why a string and not an import: the published static site cannot import npm
  code, and the editor must not carry Pixi in its main chunk. The export emits
  SCENE_SOURCE (banner included) as \`assets/ck-scene.js\` only on pages that carry
  \`data-ck-scene\`; the canvas reaches this module only through dynamic import().

  Size: ${String(gzipBytes)} bytes gzip (budget ${String(BUDGET_GZIP_BYTES)}).
  Bundled packages: ${shipped.map((entry) => `${entry.name}@${entry.version} (${entry.declared})`).join(', ')}.
*/

export const PIXI_VERSION = '${pixi.version}';

/** sha256 (hex) of the bundle, i.e. SCENE_SOURCE without its leading SCENE_BANNER. */
export const SCENE_SHA256 = '${sha256}';

/** The licence banner SCENE_SOURCE starts with (MIT and friends ask for notices to travel with copies). */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole banner as a literal type
export const SCENE_BANNER: string =
  ${JSON.stringify(banner)};

/** The complete asset: SCENE_BANNER followed by the IIFE bundle. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole file as a literal type
export const SCENE_SOURCE: string =
  ${JSON.stringify(source)};
`;

/* ── Report ────────────────────────────────────────────────────────────── */

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
console.log('scene engine (ck-scene.js):');
console.log(
  `  minified ${kb(Buffer.byteLength(source))}, gzip ${kb(gzipBytes)} (bundle alone ${kb(gzipBundleBytes)}), budget ${kb(BUDGET_GZIP_BYTES)}`,
);
console.log(`  sha256 ${sha256}`);
console.log(`  own sources: ${ownInputs.length} files`);
console.log('  bundled packages:');
for (const entry of licences) {
  if (entry.bytesInOutput === 0) {
    continue;
  }
  console.log(
    `    ${entry.name}@${entry.version}  declared=${entry.declared}  LICENSE=${entry.file ?? 'none'}(${entry.fromText})  ${kb(entry.bytesInOutput)} pre-gzip`,
  );
}

if (shakenOut.length > 0) {
  console.log(
    `  read but tree-shaken to 0 bytes (not shipped): ${shakenOut.map((entry) => `${entry.name}@${entry.version}`).join(', ')}`,
  );
}

let failed = false;
if (rejected.length > 0) {
  // Not a build failure: the notice is in the banner; the owner decides (DESIGN §D.3, recorded in LIBRARIES.md).
  console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.error('!!  LICENCE CHECK: bundled packages outside MIT / ISC / Apache-2.0 (or whose');
  console.error(
    '!!  LICENSE text disagrees with package.json). Their full notice is in the banner.',
  );
  console.error('!!  Report to the owner and record in durable/media-motion/LIBRARIES.md:');
  for (const entry of rejected) {
    console.error(
      `!!    ${entry.name}@${entry.version}: declared ${entry.declared}, LICENSE reads ${entry.fromText}`,
    );
  }
  console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
}
if (missingText.length > 0) {
  console.warn(
    `  note: no LICENSE file shipped by ${missingText.map((entry) => entry.name).join(', ')} (licence taken from package.json)`,
  );
}
if (gzipBytes > BUDGET_GZIP_BYTES) {
  failed = true;
  console.error(`scene engine is ${kb(gzipBytes)} gzip, over the ${kb(BUDGET_GZIP_BYTES)} budget`);
}
if (failed) {
  console.error(`not written: ${relative(repoRoot, outFile)} keeps its previous content`);
  process.exitCode = 1;
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  // Format with the repo's prettier so `format:check` stays green; the string VALUES are unchanged.
  const prettier = createRequire(join(repoRoot, 'package.json'))('prettier');
  const options = (await prettier.resolveConfig(outFile)) ?? {};
  writeFileSync(outFile, await prettier.format(moduleText, { ...options, filepath: outFile }));
  console.log(`  wrote ${relative(repoRoot, outFile)}`);
}
