#!/usr/bin/env node
/*
  Vendors GSAP 3.15.0 for the timeline engine (media-motion DESIGN §C.1, §C.3).

  - Downloads https://registry.npmjs.org/gsap/-/gsap-3.15.0.tgz and checks it against the
    registry's `dist.integrity` (sha512) before anything is written.
  - Copies dist/gsap.min.js, dist/ScrollTrigger.min.js and dist/SplitText.min.js VERBATIM into
    vendor/gsap/ (banners untouched: the licence forbids removing or altering notices, §III).
  - Fetches the licence page (https://gsap.com/standard-license) as text into
    vendor/gsap/LICENSE.md, with the fetch date.
  - Writes vendor/gsap/PROVENANCE.md and generates
    packages/builder/renderer/src/engines/timeline-source.ts (GSAP_VERSION, TIMELINE_BANNER,
    TIMELINE_PARTS, TIMELINE_SOURCE).

  Usage (curl is blocked in this workspace; this uses node fetch):
    export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
    node scripts/vendor-gsap.mjs            # download, verify, write
    node scripts/vendor-gsap.mjs --offline  # regenerate timeline-source.ts from vendor/gsap/

  To upgrade: change VERSION, re-run, re-read the licence page diff, update vendor/VENDOR.md,
  vendor/THIRD_PARTY_LICENSES.md and durable/media-motion/LIBRARIES.md. A new GSAP version may
  carry new licence terms (§VI Amendments), so an upgrade is an owner decision, not a chore.
*/
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const VERSION = '3.15.0';
const PACKAGE = 'gsap';
const FILES = ['gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js'];
const LICENSE_URL = 'https://gsap.com/standard-license';
const LICENSE_NAME = 'GSAP Standard No-Charge License';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIR = join(ROOT, 'vendor', 'gsap');
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

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&copy;/g, '©')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/**
 * The licence article as Markdown-ish text: from the page title to the copyright line. HTML
 * comments are dropped (the page keeps a commented-out "Plain English Summary"; it is not
 * part of the published text and is recorded separately in LIBRARIES.md).
 */
function licenceText(html) {
  const start = html.indexOf("<h2 class='ipsType_pageTitle'>");
  if (start < 0) throw new Error('licence page: title not found (page layout changed?)');
  let end = html.indexOf('<footer', start);
  if (end < 0) end = html.length;
  let s = html.slice(start, end);
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  s = s
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Math.min(Number(level), 4))} `)
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ul|ol|li|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && href.startsWith('http') && text !== href ? `${text} (${href})` : text;
    })
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  const copyright = s.indexOf('Copyright (©)');
  if (copyright < 0) throw new Error('licence page: copyright line not found');
  s = s.slice(0, s.indexOf('\n', copyright) < 0 ? s.length : s.indexOf('\n', copyright)).trim();
  for (const must of [
    'II. GRANT OF LICENSE',
    'Prohibited Uses',
    'Remove or alter any proprietary',
  ]) {
    if (!s.includes(must))
      throw new Error(`licence page: "${must}" missing from the extracted text`);
  }
  return s;
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
  const tgzResponse = await fetch(tarball);
  if (!tgzResponse.ok) throw new Error(`tarball: HTTP ${tgzResponse.status}`);
  const tgz = Buffer.from(await tgzResponse.arrayBuffer());
  const actual = `sha512-${createHash('sha512').update(tgz).digest('base64')}`;
  if (actual !== integrity) throw new Error(`integrity mismatch: ${actual} != ${integrity}`);
  const entries = untar(zlib.gunzipSync(tgz));
  const licenceResponse = await fetch(LICENSE_URL, { redirect: 'follow' });
  if (!licenceResponse.ok) throw new Error(`licence page: HTTP ${licenceResponse.status}`);
  const licence = licenceText(await licenceResponse.text());
  const fetched = new Date().toISOString().slice(0, 10);

  mkdirSync(VENDOR_DIR, { recursive: true });
  for (const file of FILES) {
    const bytes = entries.get(`package/dist/${file}`);
    if (!bytes) throw new Error(`tarball has no package/dist/${file}`);
    writeFileSync(join(VENDOR_DIR, file), bytes);
  }
  writeFileSync(
    join(VENDOR_DIR, 'LICENSE.md'),
    `<!--\n  Text of ${LICENSE_URL} (served from ${licenceResponse.url}), fetched ${fetched} by\n  scripts/vendor-gsap.mjs. Tags stripped; wording unchanged. It governs gsap@${VERSION}.\n-->\n\n${licence}\n`,
  );
  return {
    tarball,
    integrity,
    licenceFetched: fetched,
    licenceUrl: licenceResponse.url,
    npmLicense: meta.license,
  };
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
    licenceFetched: pick('Licence fetched'),
    licenceUrl: pick('Licence served from'),
    npmLicense: pick('npm "license" field'),
  };
}

const provenance = offline ? readProvenance() : await download();
const sources = FILES.map((file) => readFileSync(join(VENDOR_DIR, file), 'utf8'));
const parts = [];
let source = '';
FILES.forEach((file, index) => {
  if (index > 0) source += '\n;';
  const start = source.length;
  source += sources[index];
  parts.push({ file, sha256: sha256(sources[index]), start, end: source.length });
});
for (const [index, file] of FILES.entries()) {
  if (!sources[index].startsWith('/*!')) throw new Error(`${file}: no leading /*! banner`);
}

writeFileSync(
  join(VENDOR_DIR, 'PROVENANCE.md'),
  `# GSAP ${VERSION} — provenance

Written by \`scripts/vendor-gsap.mjs\`. The three \`.min.js\` files are byte-for-byte copies of
the npm tarball's \`dist/\` files: nothing is edited, minified again or stripped (the licence's
§III forbids removing or altering notices).

- Tarball: \`${provenance.tarball}\`
- Integrity: \`${provenance.integrity}\`
- npm "license" field: \`${provenance.npmLicense}\`
- Licence: ${LICENSE_NAME} (Webflow), NOT OSI — text in \`LICENSE.md\`
- Licence fetched: \`${provenance.licenceFetched}\`
- Licence served from: \`${provenance.licenceUrl}\`
- Adopted: owner request 2026-10-06, under the conditions in media-motion DESIGN.md §C.1
  (agent recipes only; no visual timeline editor; pinned version; unmodified files)

| File | Bytes | sha256 |
| --- | --- | --- |
${parts.map((part, index) => `| \`${part.file}\` | ${Buffer.byteLength(sources[index], 'utf8')} | \`${part.sha256}\` |`).join('\n')}

Generated string module: \`packages/builder/renderer/src/engines/timeline-source.ts\`
(\`TIMELINE_SOURCE\` = the three files joined by \`"\\n;"\`; \`sources.test.ts\` hashes each slice).
`,
);

const banner = `/*! CraftKit timeline engine asset | GSAP ${VERSION} (gsap.min.js, ScrollTrigger.min.js, SplitText.min.js)
 * Licence: ${LICENSE_NAME} (Webflow, NOT OSI) | https://gsap.com/standard-license
 * GSAP: @license Copyright 2026, GreenSock (Webflow). All rights reserved.
 * The GSAP files below are unmodified copies of npm ${PACKAGE}@${VERSION} dist/ (${provenance.integrity}),
 * each with its own notice intact.
${parts.map((part) => ` *   sha256(${part.file}) = ${part.sha256}`).join('\n')}
 * Used under the licence's Permitted Uses (use on any website). Conditions (owner request 2026-10-06):
 * fixed agent-chosen recipes only, no visual GSAP timeline or keyframe editor, version pinned,
 * files unmodified. The CraftKit recipe runner after the GSAP files is CraftKit's own code.
 */
`;

const module = `/*
  GENERATED FILE: do not edit by hand. Regenerate with \`node scripts/vendor-gsap.mjs\`
  (see vendor/VENDOR.md, "gsap — timeline recipes for agent-chosen motion").

  GSAP ${VERSION} — https://gsap.com
  npm tarball: ${provenance.tarball}
    (integrity ${provenance.integrity})
  Verbatim copies: ${FILES.map((file) => `vendor/gsap/${file}`).join(', ')}
${parts.map((part) => `    sha256(${part.file}) = ${part.sha256}`).join('\n')}
  Licence: ${LICENSE_NAME} (Webflow), NOT OSI — vendor/gsap/LICENSE.md (fetched ${provenance.licenceFetched}).
  Adopted on the owner's explicit request (2026-10-06) under media-motion DESIGN.md §C.1:
  agent recipes only, no visual timeline editor, pinned version, unmodified files.

  Why a string and not an import: the published static site cannot import npm code, and the
  editor bundle must not grow by an engine. The export emits TIMELINE_BANNER + TIMELINE_SOURCE +
  the serialised \`installTimelineEngine\` (./timeline-runner) as \`assets/ck-timeline.js\`, only on
  pages that carry \`data-ck-timeline\`; the canvas reaches this module only by dynamic import().
*/

export const GSAP_VERSION = '${VERSION}';

/** The licence the GSAP files below are used under. */
export const TIMELINE_LICENSE = '${LICENSE_NAME}';

/** One vendored file inside TIMELINE_SOURCE: \`TIMELINE_SOURCE.slice(start, end)\` is the file, byte for byte. */
export interface TimelineSourcePart {
  readonly file: string;
  readonly sha256: string;
  readonly start: number;
  readonly end: number;
}

export const TIMELINE_PARTS: readonly TimelineSourcePart[] = [
${parts.map((part) => `  { file: '${part.file}', sha256: '${part.sha256}', start: ${part.start}, end: ${part.end} },`).join('\n')}
];

/** Provenance + licence banner an emitter prepends to \`assets/ck-timeline.js\`. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: keep the literal out of the type
export const TIMELINE_BANNER: string =
  ${literal(banner)};

/** ${FILES.join(' + ')} of gsap@${VERSION}, verbatim, joined by "\\n;". Defines window.gsap, window.ScrollTrigger, window.SplitText. */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- widen to string: a const would otherwise carry the whole file as a literal type
export const TIMELINE_SOURCE: string =
  ${literal(source)};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, module);
const prettier = join(ROOT, 'node_modules/.bin/prettier');
if (existsSync(prettier))
  execFileSync(prettier, ['--write', '--log-level', 'warn', OUT], { stdio: 'inherit' });

const gzip = (text) => zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).length;
for (const [index, part] of parts.entries()) {
  console.log(
    `${part.file}\t${Buffer.byteLength(sources[index], 'utf8')} B\tgzip ${gzip(sources[index])} B\tsha256 ${part.sha256}`,
  );
}
console.log(`TIMELINE_SOURCE\t${Buffer.byteLength(source, 'utf8')} B\tgzip ${gzip(source)} B`);
console.log(`wrote ${OUT}`);
