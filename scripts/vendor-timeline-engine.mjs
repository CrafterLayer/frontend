#!/usr/bin/env node
/*
  Vendors the MIT timeline engine: an anime.js 4.5.0 subset (gsap-pixi, 2026-10-08).

  It replaces GSAP (scripts/vendor-gsap.mjs, removed). GSAP's Standard "No Charge" licence
  prohibits use in tools that let users build visual animations without code, which is what the
  CraftKit editor is (durable/gsap-pixi/LICENCE.md).

  - Downloads https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz, checks the registry's
    `dist.integrity` (sha512) and that the npm `license` field and the tarball's LICENSE.md are MIT,
    before anything is written.
  - Bundles ONLY the surface the recipes use (createTimeline, animate, stagger, onScroll,
    splitText) from the tarball's ESM `dist/modules/` with esbuild (the catalog version, resolved
    from @craftkit/builder-media-engines like scripts/build-scene-engine.mjs): one minified IIFE,
    es2020, that sets `window.ckAnime` and nothing else. Tree-shaking keeps it at about 22 kB gzip
    (the full UMD bundle is about 41 kB; the GSAP trio was 49 kB).
  - Writes vendor/animejs/anime.ck.min.js (the bundle), vendor/animejs/LICENSE.md (the tarball's,
    verbatim) and vendor/animejs/PROVENANCE.md, then generates
    packages/builder/renderer/src/engines/timeline-source.ts.

  Usage (curl is blocked in this workspace; this uses node fetch):
    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    node scripts/vendor-timeline-engine.mjs            # download, verify, bundle, write
    node scripts/vendor-timeline-engine.mjs --offline  # regenerate timeline-source.ts from vendor/animejs/

  To upgrade: change VERSION (respect pnpm's minimumReleaseAge: a release older than a day), re-run,
  re-read the tarball's LICENSE.md, update vendor/VENDOR.md, vendor/THIRD_PARTY_LICENSES.md and
  durable/media-motion/LIBRARIES.md. Run the renderer's src/engines tests: they evaluate the bundle.
*/
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const VERSION = '4.5.0';
const PACKAGE = 'animejs';
/** The anime.js exports the recipe runner calls (timeline-runner.ts `AnimeLike`). */
const EXPORTS = ['createTimeline', 'animate', 'stagger', 'onScroll', 'splitText'];
/** The one global the bundle defines; timeline-runner.ts reads `win.ckAnime`. */
const GLOBAL = 'ckAnime';
const BUNDLE_FILE = 'anime.ck.min.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = join(ROOT, 'vendor', 'animejs');
const OUT = join(ROOT, 'packages/builder/renderer/src/engines/timeline-source.ts');
const offline = process.argv.includes('--offline');

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** Entries of a ustar tarball (gunzipped), as Map<path, Buffer>. */
function untar(buffer) {
  const entries = new Map();
  let offset = 0;
  let longName = null;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (from, to) =>
      header
        .subarray(from, to)
        .toString('utf8')
        .replace(/\0[\s\S]*$/, '');
    const size = Number.parseInt(field(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    const prefix = field(345, 500);
    const name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    longName = null;
    if (type === 'L') longName = body.toString('utf8').replace(/\0[\s\S]*$/, '');
    else if (type === '0' || type === '\0') entries.set(name, Buffer.from(body));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

/** A JS string literal in the quote style prettier would keep (single unless more single quotes). */
function literal(text) {
  const singles = (text.match(/'/g) ?? []).length;
  const doubles = (text.match(/"/g) ?? []).length;
  const json = JSON.stringify(text);
  if (singles > doubles) return json;
  return `'${json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
}

function assertMit(text, where) {
  if (!/^The MIT License/m.test(text) || !/Permission is hereby granted, free of charge/.test(text)) {
    throw new Error(`${where}: not the MIT licence text`);
  }
}

async function download() {
  const metaResponse = await fetch(`https://registry.npmjs.org/${PACKAGE}/${VERSION}`);
  if (!metaResponse.ok) throw new Error(`registry metadata: HTTP ${metaResponse.status}`);
  const meta = await metaResponse.json();
  if (meta.license !== 'MIT') throw new Error(`npm "license" is ${String(meta.license)}, not MIT`);
  const { tarball, integrity } = meta.dist;
  const tgzResponse = await fetch(tarball);
  if (!tgzResponse.ok) throw new Error(`tarball: HTTP ${tgzResponse.status}`);
  const tgz = Buffer.from(await tgzResponse.arrayBuffer());
  const actual = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
  if (actual !== integrity) throw new Error(`integrity mismatch: ${actual} != ${integrity}`);
  const entries = untar(zlib.gunzipSync(tgz));
  const licence = entries.get('package/LICENSE.md');
  if (!licence) throw new Error('tarball has no package/LICENSE.md');
  assertMit(licence.toString('utf8'), 'package/LICENSE.md');

  /* esbuild reads the ESM modules from a scratch copy of the tarball, deleted afterwards. */
  const scratch = mkdtempSync(join(tmpdir(), 'ck-animejs-'));
  try {
    for (const [name, bytes] of entries) {
      if (!name.startsWith('package/')) continue;
      const file = join(scratch, name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    }
    const requireFromPackage = createRequire(
      join(ROOT, 'packages/builder/extensions/media-engines/package.json'),
    );
    const esbuild = requireFromPackage('esbuild');
    const esbuildVersion = requireFromPackage('esbuild/package.json').version;
    const entry =
      `import { ${EXPORTS.join(', ')} } from './dist/modules/index.js';\n` +
      `window.${GLOBAL} = { ${EXPORTS.join(', ')}, version: '${VERSION}' };\n`;
    const result = await esbuild.build({
      stdin: {
        contents: entry,
        resolveDir: join(scratch, 'package'),
        sourcefile: 'ck-anime-entry.js',
        loader: 'js',
      },
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      minify: true,
      splitting: false,
      write: false,
      legalComments: 'none',
      charset: 'utf8',
      logLevel: 'warning',
    });
    const bundle = `${result.outputFiles[0].text.replace(/\s+$/u, '')}\n`;
    if (/\bimport\(\s*["'`]/u.test(bundle)) throw new Error('bundle contains a dynamic import()');
    mkdirSync(VENDOR_DIR, { recursive: true });
    writeFileSync(join(VENDOR_DIR, BUNDLE_FILE), bundle);
    writeFileSync(join(VENDOR_DIR, 'LICENSE.md'), licence);
    return { tarball, integrity, npmLicense: meta.license, esbuildVersion };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function readProvenance() {
  const text = readFileSync(join(VENDOR_DIR, 'PROVENANCE.md'), 'utf8');
  const pick = (label) => {
    const match = new RegExp(`^- ${label}: \`([^\`]+)\``, 'm').exec(text);
    if (!match) throw new Error(`PROVENANCE.md: no "${label}" line`);
    return match[1];
  };
  return {
    tarball: pick('Tarball'),
    integrity: pick('Integrity'),
    npmLicense: pick('npm "license" field'),
    esbuildVersion: pick('esbuild'),
  };
}

const provenance = offline ? readProvenance() : await download();
const source = readFileSync(join(VENDOR_DIR, BUNDLE_FILE), 'utf8');
const licenceText = readFileSync(join(VENDOR_DIR, 'LICENSE.md'), 'utf8').trim();
assertMit(licenceText, 'vendor/animejs/LICENSE.md');
const hash = sha256(source);
const gzip = (text) => zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).length;
const bytes = Buffer.byteLength(source, 'utf8');
const gzipped = gzip(source);

writeFileSync(
  join(VENDOR_DIR, 'PROVENANCE.md'),
  `# anime.js ${VERSION} subset — provenance

Written by \`scripts/vendor-timeline-engine.mjs\` (gsap-pixi, 2026-10-08). \`${BUNDLE_FILE}\` is an
esbuild bundle of the npm tarball's ESM \`dist/modules/\`, keeping only
\`${EXPORTS.join('`, `')}\` and setting \`window.${GLOBAL}\`. MIT permits the modification;
the notice travels in the asset banner (\`TIMELINE_BANNER\`). \`LICENSE.md\` is the tarball's,
verbatim.

- Tarball: \`${provenance.tarball}\`
- Integrity: \`${provenance.integrity}\`
- npm "license" field: \`${provenance.npmLicense}\`
- esbuild: \`${provenance.esbuildVersion}\`
- Build: format iife, target es2020, minified, legal comments dropped (the banner carries the licence)

| File | Bytes | gzip -9 | sha256 |
| --- | --- | --- | --- |
| \`${BUNDLE_FILE}\` | ${bytes} | ${gzipped} | \`${hash}\` |

Generated string module: \`packages/builder/renderer/src/engines/timeline-source.ts\`
(\`TIMELINE_SOURCE\` = \`${BUNDLE_FILE}\` byte for byte; \`sources.test.ts\` hashes it).
`,
);

const banner = `/*! CraftKit timeline engine asset (ck-timeline.js) | anime.js ${VERSION} subset: ${EXPORTS.join(', ')}
 * Bundled from npm ${PACKAGE}@${VERSION} dist/modules (${provenance.integrity})
 * by esbuild ${provenance.esbuildVersion} (iife, es2020, minified); it defines window.${GLOBAL} only.
 * sha256(bundle) = ${hash}
 * anime.js: https://animejs.com | https://github.com/juliangarnier/anime
 *
${licenceText
  .split('\n')
  .map((line) => (line === '' ? ' *' : ` * ${line.replaceAll('*/', '* /')}`))
  .join('\n')}
 *
 * The CraftKit recipe runner after the bundle (installTimelineEngine) is CraftKit's own code.
 */
`;

const module = `/*
  GENERATED FILE: do not edit by hand. Regenerate with \`node scripts/vendor-timeline-engine.mjs\`
  (see vendor/VENDOR.md, "animejs — the MIT timeline engine").

  anime.js ${VERSION} (MIT, Julian Garnier) — https://animejs.com
  npm tarball: ${provenance.tarball}
    (integrity ${provenance.integrity})
  Subset bundle: vendor/animejs/${BUNDLE_FILE} (esbuild ${provenance.esbuildVersion}; ${EXPORTS.join(', ')})
    sha256 = ${hash}
    ${bytes} bytes, ${gzipped} bytes gzip -9
  Licence: MIT — vendor/animejs/LICENSE.md. It replaced GSAP on 2026-10-08: GSAP's licence prohibits
  no-code visual animation builders (durable/gsap-pixi/LICENCE.md).

  Why a string and not an import: the published static site cannot import npm code, and the
  editor bundle must not grow by an engine. The export emits TIMELINE_BANNER + TIMELINE_SOURCE +
  the serialised \`installTimelineEngine\` (./timeline-runner) as \`assets/ck-timeline.js\`, only on
  pages that carry \`data-ck-timeline\`; the canvas reaches this module only by dynamic import().
*/

/** The library the timeline recipes run on. */
export const TIMELINE_ENGINE = 'anime.js';

export const ANIME_VERSION = '${VERSION}';

/** The licence the bundled library is used under. */
export const TIMELINE_LICENSE = 'MIT';

/** The one global TIMELINE_SOURCE defines; the runner reads \`window.${GLOBAL}\`. */
export const TIMELINE_GLOBAL = '${GLOBAL}';

/** The anime.js exports the bundle keeps (and \`window.${GLOBAL}\` carries). */
export const TIMELINE_EXPORTS: readonly string[] = [${EXPORTS.map((name) => `'${name}'`).join(', ')}];

/** sha256 (hex) of TIMELINE_SOURCE, i.e. vendor/animejs/${BUNDLE_FILE}. */
export const TIMELINE_SHA256 = '${hash}';

/** Provenance + MIT licence banner an emitter prepends to \`assets/ck-timeline.js\`. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: keep the literal out of the type
export const TIMELINE_BANNER: string =
  ${literal(banner)};

/** vendor/animejs/${BUNDLE_FILE}, verbatim: an IIFE that sets window.${GLOBAL} = { ${EXPORTS.join(', ')}, version }. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole bundle as a literal type
export const TIMELINE_SOURCE: string =
  ${literal(source)};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, module);
const prettier = join(ROOT, 'node_modules/.bin/prettier');
if (existsSync(prettier))
  execFileSync(prettier, ['--write', '--log-level', 'warn', OUT], { stdio: 'inherit' });

console.log(`${BUNDLE_FILE}\t${bytes} B\tgzip ${gzipped} B\tsha256 ${hash}`);
console.log(`asset (banner + bundle)\tgzip ${gzip(banner + source)} B`);
console.log(`wrote ${OUT}`);
