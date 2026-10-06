#!/usr/bin/env node
/*
  Vendors lottie-web 5.13.0 (the "light" SVG-only player, no eval) for the lottie engine
  (media-motion DESIGN §E, Lottie row).

  - Downloads https://registry.npmjs.org/lottie-web/-/lottie-web-5.13.0.tgz and checks it against
    the registry's `dist.integrity` (sha512) before anything is written.
  - Copies build/player/lottie_light.min.js VERBATIM and the package's LICENSE.md (checked to be
    the MIT licence) into vendor/lottie/.
  - Writes vendor/lottie/PROVENANCE.md and generates
    packages/builder/renderer/src/engines/lottie-source.ts (LOTTIE_VERSION, LOTTIE_SHA256,
    LOTTIE_BANNER, LOTTIE_SOURCE).

  Usage (curl is blocked in this workspace; this uses node fetch):
    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    node scripts/vendor-lottie.mjs            # download, verify, write
    node scripts/vendor-lottie.mjs --offline  # regenerate lottie-source.ts from vendor/lottie/
*/
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const VERSION = '5.13.0';
const PACKAGE = 'lottie-web';
const FILE = 'lottie_light.min.js';
const TAR_PATH = `package/build/player/${FILE}`;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = join(ROOT, 'vendor', 'lottie');
const OUT = join(ROOT, 'packages/builder/renderer/src/engines/lottie-source.ts');
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

async function download() {
  const metaResponse = await fetch(`https://registry.npmjs.org/${PACKAGE}/${VERSION}`);
  if (!metaResponse.ok) throw new Error(`registry metadata: HTTP ${metaResponse.status}`);
  const meta = await metaResponse.json();
  const { tarball, integrity } = meta.dist;
  if (meta.license !== 'MIT') throw new Error(`npm license field is "${meta.license}", not MIT`);
  const tgzResponse = await fetch(tarball);
  if (!tgzResponse.ok) throw new Error(`tarball: HTTP ${tgzResponse.status}`);
  const tgz = Buffer.from(await tgzResponse.arrayBuffer());
  const actual = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
  if (actual !== integrity) throw new Error(`integrity mismatch: ${actual} != ${integrity}`);
  const entries = untar(zlib.gunzipSync(tgz));
  const player = entries.get(TAR_PATH);
  if (!player) throw new Error(`tarball has no ${TAR_PATH}`);
  const licenceEntry = [...entries.keys()].find((name) =>
    /^package\/LICENSE(\.md|\.txt)?$/i.test(name),
  );
  if (!licenceEntry) throw new Error('tarball has no LICENSE file');
  const licence = entries.get(licenceEntry).toString('utf8');
  if (
    !/MIT License/i.test(licence) ||
    !/Permission is hereby granted, free of charge/.test(licence)
  ) {
    throw new Error(`${licenceEntry} is not the MIT licence text`);
  }
  mkdirSync(VENDOR_DIR, { recursive: true });
  writeFileSync(join(VENDOR_DIR, FILE), player);
  writeFileSync(join(VENDOR_DIR, 'LICENSE'), licence);
  return { tarball, integrity, gitHead: meta.gitHead ?? 'not published', licenceEntry };
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
    gitHead: pick('Upstream gitHead'),
    licenceEntry: pick('Licence file'),
  };
}

const provenance = offline ? readProvenance() : await download();
const source = readFileSync(join(VENDOR_DIR, FILE), 'utf8');
const licence = readFileSync(join(VENDOR_DIR, 'LICENSE'), 'utf8');
const copyright = /^Copyright.*$/m.exec(licence)?.[0] ?? 'Copyright (c) Airbnb';
const hash = sha256(source);

writeFileSync(
  join(VENDOR_DIR, 'PROVENANCE.md'),
  `# lottie-web ${VERSION} (light player) — provenance

Written by \`scripts/vendor-lottie.mjs\`. \`${FILE}\` is a byte-for-byte copy of the npm tarball's
\`build/player/${FILE}\`; \`LICENSE\` is the tarball's licence file, unchanged.

- Tarball: \`${provenance.tarball}\`
- Integrity: \`${provenance.integrity}\`
- Upstream gitHead: \`${provenance.gitHead}\`
- Licence file: \`${provenance.licenceEntry}\`
- Licence: MIT (${copyright})

| File | Bytes | sha256 |
| --- | --- | --- |
| \`${FILE}\` | ${Buffer.byteLength(source, 'utf8')} | \`${hash}\` |

Generated string module: \`packages/builder/renderer/src/engines/lottie-source.ts\`
(\`LOTTIE_SOURCE\` is the file verbatim; \`sources.test.ts\` hashes it).
`,
);

const banner = `/*! lottie-web ${VERSION} (lottie_light.min.js, SVG renderer, no eval) | MIT License | ${copyright}
 * https://github.com/airbnb/lottie-web | npm ${PACKAGE}@${VERSION} (${provenance.integrity})
 * sha256(${FILE}) = ${hash} (unmodified). Licence text: vendor/lottie/LICENSE in the CraftKit repository.
 */
`;

const module = `/*
  GENERATED FILE: do not edit by hand. Regenerate with \`node scripts/vendor-lottie.mjs\`
  (see vendor/VENDOR.md, "lottie-web — the light Lottie player for published sites").

  lottie-web ${VERSION} — https://github.com/airbnb/lottie-web
  npm tarball: ${provenance.tarball}
    (integrity ${provenance.integrity}, upstream gitHead ${provenance.gitHead})
  Verbatim copies: vendor/lottie/${FILE}, vendor/lottie/LICENSE
    sha256(${FILE}) = ${hash}
  Licence: MIT (${copyright}).

  Why a string and not an import: the published static site cannot import npm code, and the
  editor bundle must not grow by an engine. The export emits LOTTIE_BANNER + LOTTIE_SOURCE + the
  serialised \`installLottieEngine\` (./lottie-runner) as \`assets/ck-lottie.js\`, only on pages that
  carry \`data-ck-lottie\`; the canvas reaches this module only by dynamic import().
*/

export const LOTTIE_VERSION = '${VERSION}';

/** sha256 (hex) of vendor/lottie/${FILE}, which LOTTIE_SOURCE reproduces byte for byte. */
export const LOTTIE_SHA256 = '${hash}';

/** Licence banner an emitter prepends to \`assets/ck-lottie.js\`; MIT asks for the notice to travel with copies. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: keep the literal out of the type
export const LOTTIE_BANNER: string =
  ${literal(banner)};

/** build/player/${FILE} of lottie-web@${VERSION}, verbatim (UMD: defines window.lottie). */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole file as a literal type
export const LOTTIE_SOURCE: string =
  ${literal(source)};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, module);
const prettier = join(ROOT, 'node_modules/.bin/prettier');
if (existsSync(prettier))
  execFileSync(prettier, ['--write', '--log-level', 'warn', OUT], { stdio: 'inherit' });

const gzip = zlib.gzipSync(Buffer.from(source, 'utf8'), { level: 9 }).length;
console.log(`${FILE}\t${Buffer.byteLength(source, 'utf8')} B\tgzip ${gzip} B\tsha256 ${hash}`);
console.log(`wrote ${OUT}`);
