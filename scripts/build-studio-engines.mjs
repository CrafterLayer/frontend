#!/usr/bin/env node
/*
  Build the lazily loaded Pixi Studio libraries and sound engine.

    node scripts/build-studio-engines.mjs all
    node scripts/build-studio-engines.mjs kit
    node scripts/build-studio-engines.mjs sound
    node scripts/build-studio-engines.mjs anim|fx|dialogue|ink|tilemap|audio|gameai|hud

  Each output is one minified browser IIFE with no chunks. Pixi-bound libraries
  receive the page's already-loaded Pixi namespace instead of bundling another
  copy. Generated TypeScript modules live beside the renderer loaders and carry
  the complete asset string, its licence banner and a sha256 of the bundle body.
*/

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { ALLOWED_LICENCES, TARGETS } from './studio-engine-targets.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = join(repoRoot, 'packages/builder/extensions/media-engines');
// This bundle only consumes the schema's dependency-free sound contract. Resolve
// the public package import to that leaf so unrelated schema barrels cannot leak
// browser-only or import.meta code into ck-sound.js.
const schemaEntry = join(repoRoot, 'packages/builder/schema/src/sound/runtime.ts');
const outputDir = join(repoRoot, 'packages/builder/renderer/src/engines/studio');
const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const requireFromRoot = createRequire(join(repoRoot, 'package.json'));
const esbuild = requireFromPackage('esbuild');
const prettier = requireFromRoot('prettier');

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
const constant = (key, suffix) => `${key.toUpperCase().replaceAll('-', '_')}_${suffix}`;

function packageRootOf(inputPath) {
  const absolute = resolve(repoRoot, inputPath);
  const parts = absolute.split(sep);
  const index = parts.lastIndexOf('node_modules');
  if (index === -1) return undefined;
  const first = parts[index + 1] ?? '';
  const length = first.startsWith('@') ? 2 : 1;
  return parts.slice(0, index + 1 + length).join(sep);
}

function readLicenceFile(root) {
  const candidates = readdirSync(root).filter((name) => /^(licen[cs]e|copying)(\.|$)/iu.test(name));
  for (const name of candidates) {
    const text = readFileSync(join(root, name), 'utf8').trim();
    if (text !== '') return { file: name, text };
  }
  return undefined;
}

function classifyText(text) {
  if (/Permission is hereby granted, free of charge/iu.test(text)) return 'MIT';
  if (/Permission to use, copy, modify, and\/or distribute this software for any/iu.test(text)) {
    return 'ISC';
  }
  if (/Apache License,?\s+Version 2\.0/iu.test(text)) return 'Apache-2.0';
  if (/CC0 1\.0 Universal/u.test(text) && /Statement of Purpose/u.test(text)) return 'CC0-1.0';
  if (/Redistribution and use in source and binary forms/iu.test(text)) {
    return /Neither the name/iu.test(text) ? 'BSD-3-Clause' : 'BSD-2-Clause';
  }
  return 'UNKNOWN';
}

function copyrightLines(text) {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^(\(c\)|copyright|©)/iu.test(line))
    .slice(0, 3);
}

function dependencyVersion(name) {
  const root = join(packageDir, 'node_modules', ...name.split('/'));
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
}

function resolveVersion(target) {
  return target.version ?? dependencyVersion(target.versionPackage);
}

/*
  Module-scope `const x = new Vector3()` scratch objects, marked pure so an unused one does not
  keep its class alive. Only the listed value classes may be marked: a constructor that is not on
  the list (a future release adding a registry or a side effect) fails the build instead.
*/
function pureScratchPlugin(rule) {
  return {
    name: 'pure-module-scratch',
    setup(build) {
      build.onLoad({ filter: rule.file }, (args) => {
        const text = readFileSync(args.path, 'utf8');
        const contents = text.replace(/^(?:const|let) [^\n]*$/gmu, (line) =>
          line.replaceAll(/\bnew ([A-Z]\w*)(?=\()/gu, (_match, name) => {
            if (!rule.classes.includes(name)) {
              throw new Error(
                `pure-module-scratch: unexpected module-scope "new ${name}" in ${args.path}`,
              );
            }
            return `/* @__PURE__ */ new ${name}`;
          }),
        );
        return { contents, loader: 'js' };
      });
    },
  };
}

function buildPlugins(pixiBound, target = {}) {
  const plugins = [
    {
      name: 'craftkit-schema-source',
      setup(build) {
        build.onResolve({ filter: /^@craftkit\/builder-schema$/ }, () => ({ path: schemaEntry }));
      },
    },
  ];
  if (target.pureScratch !== undefined) plugins.push(pureScratchPlugin(target.pureScratch));
  if (pixiBound) {
    plugins.push({
      name: 'shared-pixi-namespace',
      setup(build) {
        build.onResolve({ filter: /^pixi\.js(?:\/.*)?$/ }, (args) => ({
          path: args.path,
          namespace: 'craftkit-pixi',
        }));
        build.onLoad({ filter: /.*/, namespace: 'craftkit-pixi' }, () => ({
          contents: 'module.exports = __ckPixi;',
          loader: 'js',
        }));
      },
    });
  }
  return plugins;
}

function registryWrapper(key, body, target) {
  const create = target.pixi
    ? `function(__ckPixi){var module={exports:{}};var exports=module.exports;${body};return module.exports.${target.factory}(__ckPixi)}`
    : `function(){var module={exports:{}};var exports=module.exports;${body};return module.exports.${target.factory}()}`;
  return `(()=>{function ensure(win){var current=win.ckEngines;if(current&&typeof current.ready==="function")return current;var api={engines:{},queue:[],ready:function(kind,engine){api.engines[kind]=engine;for(var i=0;i<api.queue.length;i++){var entry=api.queue[i];if(entry.kind!==kind||entry.dispose!==undefined)continue;try{entry.dispose=engine.mount(entry.el,entry.ctx)}catch(_error){entry.dispose=function(){}}}}};win.ckEngines=api;return api}var factory={pixi:${String(target.pixi)},create:${create}};ensure(window).ready("lib-${key}",{mount:function(_element,context){if(context.provide)context.provide(factory);return function(){}}})})();`;
}

async function bundleTarget(key, target) {
  const result = await esbuild.build({
    ...(key === 'sound'
      ? {
          stdin: {
            contents: `import { installSoundEngine } from './${target.entry}';\ninstallSoundEngine(window);`,
            resolveDir: packageDir,
            sourcefile: 'ck-sound-runner.ts',
            loader: 'ts',
          },
        }
      : { entryPoints: [join(packageDir, target.entry)] }),
    absWorkingDir: repoRoot,
    bundle: true,
    format: key === 'sound' ? 'iife' : 'cjs',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    splitting: false,
    write: false,
    metafile: true,
    legalComments: 'none',
    charset: 'utf8',
    tsconfig: join(packageDir, 'tsconfig.json'),
    plugins: buildPlugins(target.pixi === true, target),
    logLevel: 'warning',
  });
  const output = result.outputFiles?.[0];
  if (output === undefined) throw new Error(`${key}: esbuild produced no output`);
  if (process.env.CK_STUDIO_ANALYZE === '1') {
    console.log(await esbuild.analyzeMetafile(result.metafile, { verbose: true }));
  }
  const built = output.text.replace(/\s+$/u, '');
  const bundle = key === 'sound' ? built : registryWrapper(key, built, target);
  if (/\bimport\s*\(/u.test(bundle)) {
    throw new Error(`${key}: bundle contains a dynamic import()`);
  }
  return { bundle, metafile: result.metafile };
}

function inspectLicences(metafile, target) {
  const output = metafile.outputs[Object.keys(metafile.outputs)[0]];
  const packages = new Map();
  const ownInputs = [];
  for (const inputPath of Object.keys(metafile.inputs)) {
    if (inputPath.startsWith('craftkit-pixi:')) continue;
    const root = packageRootOf(inputPath);
    if (root === undefined) {
      ownInputs.push(relative(repoRoot, resolve(repoRoot, inputPath)));
      continue;
    }
    const bytes = output?.inputs[inputPath]?.bytesInOutput ?? 0;
    packages.set(root, (packages.get(root) ?? 0) + bytes);
  }

  const licences = [];
  for (const [root, bytesInOutput] of packages) {
    if (bytesInOutput === 0) continue;
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const declared =
      typeof manifest.license === 'string'
        ? manifest.license
        : JSON.stringify(manifest.license ?? manifest.licenses ?? null);
    const file = readLicenceFile(root);
    licences.push({
      name: manifest.name,
      version: manifest.version,
      declared,
      fromText: file === undefined ? 'MISSING' : classifyText(file.text),
      file: file?.file ?? null,
      text: file?.text ?? '',
      copyright: file === undefined ? [] : copyrightLines(file.text),
      bytesInOutput,
    });
  }
  for (const vendored of target.vendored ?? []) {
    const text = readFileSync(join(packageDir, vendored.licence), 'utf8').trim();
    licences.push({
      name: vendored.name,
      version: vendored.version,
      declared: vendored.declared,
      fromText: classifyText(text),
      file: relative(packageDir, join(packageDir, vendored.licence)),
      text,
      copyright: copyrightLines(text),
      bytesInOutput: 0,
    });
  }
  licences.sort((left, right) => left.name.localeCompare(right.name));

  const rejected = licences.filter(
    (entry) =>
      !ALLOWED_LICENCES.has(entry.declared) ||
      entry.fromText === 'MISSING' ||
      entry.fromText === 'UNKNOWN' ||
      entry.fromText !== entry.declared,
  );
  if (rejected.length > 0) {
    throw new Error(
      `licence audit failed: ${rejected
        .map(
          (entry) =>
            `${entry.name}@${entry.version} declared=${entry.declared} text=${entry.fromText}`,
        )
        .join(', ')}`,
    );
  }
  return { licences, ownInputs };
}

function makeBanner(licences, key) {
  // First-party libraries bundle no package: say so instead of shipping an empty notice.
  if (licences.length === 0) {
    return `/*!\n * CraftKit ck-lib-${key}.js: first-party source; bundles no third-party package.\n */\n`;
  }
  const bodies = new Map();
  for (const entry of licences) {
    const hash = createHash('sha256').update(entry.text, 'utf8').digest('hex');
    if (!bodies.has(hash)) bodies.set(hash, entry.text);
  }
  const safe = (text) => text.replaceAll('*/', '* /');
  const lines = [
    '/*!',
    ...[...bodies.values()].flatMap((text) =>
      text.split(/\r?\n/u).map((line) => ` * ${line}`.trimEnd()),
    ),
  ];
  const banner = `${safe(lines.join('\n'))}\n */\n`;
  if (banner.indexOf('*/') !== banner.length - 3) throw new Error('unsafe licence banner');
  return banner;
}

async function writeGenerated(key, target, bundle, licences, ownInputs) {
  const version = resolveVersion(target);
  const sha256 = createHash('sha256').update(bundle, 'utf8').digest('hex');
  const banner = makeBanner(licences, key);
  const source = `${banner}${bundle}`;
  const gzipBytes = gzipSync(source, { level: 9 }).length;
  const gzipBundleBytes = gzipSync(bundle, { level: 9 }).length;
  if (gzipBytes > target.budget) {
    throw new Error(
      `${key}: ${String(gzipBytes)} bytes gzip (bundle ${String(gzipBundleBytes)}) exceeds the ${String(target.budget)} byte budget`,
    );
  }

  const outFile = join(outputDir, `${key}-source.ts`);
  const versionName = constant(key, 'VERSION');
  const shaName = constant(key, 'SHA256');
  const bannerName = constant(key, 'BANNER');
  const sourceName = constant(key, 'SOURCE');
  const moduleText = `/*
  GENERATED FILE: do not edit by hand. Regenerate with:

    node scripts/build-studio-engines.mjs ${key}

  Source: packages/builder/extensions/media-engines/${target.entry}.
  One minified browser IIFE, no splitting and no dynamic import.
  Size: ${String(gzipBytes)} bytes gzip (budget ${String(target.budget)}).
  Bundled/adapted packages: ${licences.length === 0 ? 'none (first-party source)' : licences.map((entry) => `${entry.name}@${entry.version} (${entry.declared})`).join(', ')}.
*/

export const ${versionName} = ${JSON.stringify(version)};

/** sha256 (hex) of ${sourceName} after its leading ${bannerName}. */
export const ${shaName} = ${JSON.stringify(sha256)};

// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- keep generated notice out of the inferred literal type
export const ${bannerName}: string = ${JSON.stringify(banner)};

// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- keep generated asset out of the inferred literal type
export const ${sourceName}: string = ${JSON.stringify(source)};
`;
  mkdirSync(outputDir, { recursive: true });
  const options = (await prettier.resolveConfig(outFile)) ?? {};
  writeFileSync(outFile, await prettier.format(moduleText, { ...options, filepath: outFile }));
  console.log(
    `${key}: wrote ${relative(repoRoot, outFile)} — ${kb(gzipBytes)} gzip / ${kb(target.budget)}, ${ownInputs.length} own source files, sha256 ${sha256}`,
  );
}

export async function buildStudioEngines(requested = 'all') {
  const keys = requested === 'all' ? Object.keys(TARGETS) : [requested];
  for (const key of keys) {
    const target = TARGETS[key];
    if (target === undefined) {
      throw new Error(
        `unknown target "${key}"; expected one of: all, ${Object.keys(TARGETS).join(', ')}`,
      );
    }
    const { bundle, metafile } = await bundleTarget(key, target);
    const { licences, ownInputs } = inspectLicences(metafile, target);
    await writeGenerated(key, target, bundle, licences, ownInputs);
  }
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    await buildStudioEngines(process.argv[2] ?? 'all');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
