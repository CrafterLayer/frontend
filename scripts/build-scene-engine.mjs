#!/usr/bin/env node
/*
  Build the canvas engines that carry PixiJS.

    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    node scripts/build-scene-engine.mjs          # both
    node scripts/build-scene-engine.mjs scene    # the scene engine (media-motion DESIGN §D.3)
    node scripts/build-scene-engine.mjs pixi     # the FULL pixi.js bundle for region scripts

  Two targets, one pipeline (`TARGETS` below):

    scene  packages/builder/extensions/media-engines/src/entry.ts   -> engines/scene-source.ts
           ck-scene.js: a Pixi SUBSET + the five CraftKit scenes. 200 kB gzip.
    pixi   packages/builder/extensions/media-engines/src/pixi-entry.ts -> engines/pixi-full-source.ts
           ck-pixi.js: the WHOLE pixi.js namespace, for a region's `js` (free-code mode,
           2026-10-09). Loaded only when some script names Pixi (`ck.pixi()` / `ck.stage()`).
           Its own, larger budget.

  For each target:

  1. esbuild (the catalog version, resolved from @craftkit/builder-media-engines)
     bundles the entry into ONE minified IIFE (es2020, browser, no code splitting:
     an injected <script> cannot chunk).
  2. Every npm package that lands in the bundle is read from the esbuild
     metafile; its package.json licence AND its LICENSE file are read (never
     assumed). Anything that is not MIT, ISC or Apache-2.0 is printed loudly and
     listed for the owner; its notice still goes in the banner. Packages
     esbuild read but tree-shook to zero bytes are printed and not bannered.
  3. The generated module under packages/builder/renderer/src/engines/ is written:
     the version, the sha256, the BANNER and the SOURCE (= BANNER + bundle), so
     the export can emit it alone as an asset and the licence notices travel with
     every copy; the sha256 is of the bundle part (everything after the banner).
  4. The gzip size is printed; above the target's budget the build fails and the
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
const enginesDir = join(repoRoot, 'packages/builder/renderer/src/engines');
const ALLOWED_LICENCES = new Set(['MIT', 'ISC', 'Apache-2.0']);

const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const esbuild = requireFromPackage('esbuild');
const esbuildVersion = requireFromPackage('esbuild/package.json').version;

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

/*
  `moduleDoc` is the leading comment of the generated module; it is the only
  free text that differs, so it lives with the target.
*/
const TARGETS = {
  scene: {
    heading: 'scene engine (ck-scene.js)',
    buildCommand: 'node scripts/build-scene-engine.mjs',
    runnerFile: 'ck-scene-runner.ts',
    runner: "import { installSceneEngine } from './src/entry.ts';\ninstallSceneEngine(window);\n",
    outFile: join(enginesDir, 'scene-source.ts'),
    budgetGzipBytes: 200 * 1000,
    names: {
      version: 'PIXI_VERSION',
      sha: 'SCENE_SHA256',
      banner: 'SCENE_BANNER',
      source: 'SCENE_SOURCE',
    },
    bannerTitle: (pixiVersion) =>
      `CraftKit canvas scene engine (ck-scene.js) — PixiJS ${pixiVersion} subset + CraftKit scenes.`,
    moduleDoc: ({ command, pixi, shipped, gzipBytes, budget }) => `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    ${command}

  Source: packages/builder/extensions/media-engines/src/entry.ts (+ src/scenes/*),
  bundled with pixi.js ${pixi.version} (MIT) from the pnpm catalog by esbuild ${esbuildVersion}
  (format iife, target es2020, minified, no splitting). The bundle ends by calling
  installSceneEngine(window), which registers \`window.ckEngines.engines.scene\`
  (media-motion DESIGN §2.3).

  Why a string and not an import: the published static site cannot import npm
  code, and the editor must not carry Pixi in its main chunk. The export emits
  SCENE_SOURCE (banner included) as \`assets/ck-scene.js\` only on pages that carry
  \`data-ck-scene\`; the canvas reaches this module only through dynamic import().

  Size: ${String(gzipBytes)} bytes gzip (budget ${String(budget)}).
  Bundled packages: ${shipped.map((entry) => `${entry.name}@${entry.version} (${entry.declared})`).join(', ')}.
*/`,
  },
  pixi: {
    heading: 'full pixi.js bundle (ck-pixi.js)',
    buildCommand: 'node scripts/build-scene-engine.mjs pixi',
    runnerFile: 'ck-pixi-runner.ts',
    runner: "import { installFullPixi } from './src/pixi-entry.ts';\ninstallFullPixi(window);\n",
    outFile: join(enginesDir, 'pixi-full-source.ts'),
    // Measured on pixi.js 8.22.0: 268.5 kB gzip, the whole library (the scene subset is ~4x smaller).
    // The headroom is for a point release of Pixi, not for our own code (a 12-line handshake).
    budgetGzipBytes: 300 * 1000,
    names: {
      version: 'PIXI_FULL_VERSION',
      sha: 'PIXI_FULL_SHA256',
      banner: 'PIXI_FULL_BANNER',
      source: 'PIXI_FULL_SOURCE',
    },
    bannerTitle: (pixiVersion) =>
      `CraftKit full pixi.js bundle (ck-pixi.js) — PixiJS ${pixiVersion}, the whole namespace, for region scripts.`,
    moduleDoc: ({ command, pixi, shipped, gzipBytes, budget }) => `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    ${command}

  Source: packages/builder/extensions/media-engines/src/pixi-entry.ts (+ src/pixi-engine.ts),
  bundled with pixi.js ${pixi.version} (MIT) from the pnpm catalog by esbuild ${esbuildVersion}
  (format iife, target es2020, minified, no splitting). The bundle ends by registering
  \`window.ckEngines.engines.pixi\`, whose mount hands the FULL pixi.js namespace to the
  region script that asked for it (\`ck.pixi()\` / \`ck.stage()\`). It writes no global.

  Why a string and not an import: the published static site cannot import npm
  code, and the editor must not carry Pixi in its main chunk. The export emits
  PIXI_FULL_SOURCE (banner included) as \`assets/ck-pixi.js\` only when some page's
  \`data-ck-js\` code names Pixi; the canvas reaches this module only through dynamic import().

  Size: ${String(gzipBytes)} bytes gzip (budget ${String(budget)}).
  Bundled packages: ${shipped.map((entry) => `${entry.name}@${entry.version} (${entry.declared})`).join(', ')}.
*/`,
  },
};

/* ── Licence helpers ───────────────────────────────────────────────────── */

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

/* ── One target, end to end. Returns true when it failed. ──────────────── */

async function buildTarget(target) {
  const result = await esbuild.build({
    stdin: {
      contents: target.runner,
      resolveDir: packageDir,
      sourcefile: target.runnerFile,
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

  const packages = new Map();
  const ownInputs = [];
  for (const inputPath of Object.keys(result.metafile.inputs)) {
    if (inputPath.startsWith('<stdin>') || inputPath === target.runnerFile) {
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
          ? [typeof manifest.author === 'string' ? `author: ${manifest.author}` : ''].filter(
              Boolean,
            )
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

  /* ── Banner ──────────────────────────────────────────────────────────── */

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
    ` * ${target.bannerTitle(pixi.version)}`,
    ` * GENERATED by \`${target.buildCommand}\` (esbuild ${esbuildVersion}, iife, es2020, minified).`,
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

  /* ── Generated module ────────────────────────────────────────────────── */

  const { names } = target;
  const moduleText = `${target.moduleDoc({
    command: target.buildCommand,
    pixi,
    shipped,
    gzipBytes,
    budget: target.budgetGzipBytes,
  })}

export const ${names.version} = '${pixi.version}';

/** sha256 (hex) of the bundle, i.e. ${names.source} without its leading ${names.banner}. */
export const ${names.sha} = '${sha256}';

/** The licence banner ${names.source} starts with (MIT and friends ask for notices to travel with copies). */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole banner as a literal type
export const ${names.banner}: string =
  ${JSON.stringify(banner)};

/** The complete asset: ${names.banner} followed by the IIFE bundle. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole file as a literal type
export const ${names.source}: string =
  ${JSON.stringify(source)};
`;

  /* ── Report ──────────────────────────────────────────────────────────── */

  console.log(`${target.heading}:`);
  console.log(
    `  minified ${kb(Buffer.byteLength(source))}, gzip ${kb(gzipBytes)} (bundle alone ${kb(gzipBundleBytes)}), budget ${kb(target.budgetGzipBytes)}`,
  );
  console.log(`  gzip bytes ${String(gzipBytes)}`);
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
  if (gzipBytes > target.budgetGzipBytes) {
    failed = true;
    console.error(
      `${target.heading} is ${kb(gzipBytes)} gzip, over the ${kb(target.budgetGzipBytes)} budget`,
    );
  }
  if (failed) {
    console.error(`not written: ${relative(repoRoot, target.outFile)} keeps its previous content`);
    return true;
  }
  mkdirSync(dirname(target.outFile), { recursive: true });
  // Format with the repo's prettier so `format:check` stays green; the string VALUES are unchanged.
  const prettier = createRequire(join(repoRoot, 'package.json'))('prettier');
  const options = (await prettier.resolveConfig(target.outFile)) ?? {};
  writeFileSync(
    target.outFile,
    await prettier.format(moduleText, { ...options, filepath: target.outFile }),
  );
  console.log(`  wrote ${relative(repoRoot, target.outFile)}`);
  return false;
}

const requested = process.argv[2] ?? 'all';
const keys = requested === 'all' ? Object.keys(TARGETS) : [requested];
for (const key of keys) {
  if (!(key in TARGETS)) {
    console.error(
      `unknown target "${key}"; expected one of: all, ${Object.keys(TARGETS).join(', ')}`,
    );
    process.exitCode = 1;
    break;
  }
}
if (process.exitCode !== 1) {
  for (const key of keys) {
    if (await buildTarget(TARGETS[key])) {
      process.exitCode = 1;
    }
  }
}
