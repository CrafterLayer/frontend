#!/usr/bin/env node
/*
  The verified art catalog (art catalog, 2026-10-14): brand logos, cartoon characters and
  illustrations the site agent may put on a page, as committed DATA — so the model names a
  brand, a style and seed, or an illustration, and never writes an image address itself.

    node scripts/build-art-catalog.mjs [--date=YYYY-MM-DD]

  Each source is a PINNED npm package, fetched with `npm pack` into a temporary directory and
  read as text (nothing from a package is executed, nothing becomes a dependency):

  - simple-icons@16.33.0 — brand titles, slugs, colours and aliases (data CC0-1.0; the marks
    are their owners' trademarks). Pages hotlink https://cdn.simpleicons.org/<slug>.
  - @dicebear/<style>@9.4.2 — every style @dicebear/collection@9.4.2 depends on; the ARTWORK
    licence is read from each package's `meta` (lib/index.js) and checked against the Design
    section of its LICENSE. Pages hotlink https://api.dicebear.com/9.x/<style>/svg?seed=….
  - @iconify-json/fluent-emoji-flat@1.2.6 — Microsoft's Fluent Emoji (MIT): names and
    categories. Pages hotlink https://api.iconify.design/fluent-emoji-flat/<name>.svg.

  Output, under packages/builder/ai/src/art-catalog/: brands.data.ts, characters.data.ts,
  emoji.data.ts (data-only `.data.ts` modules, loaded lazily by the agent) and PROVENANCE.md.
*/

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'packages/builder/ai/src/art-catalog');
/** The files this script owns in OUT; the modules beside them are written by hand. */
const GENERATED = ['brands.data.ts', 'characters.data.ts', 'emoji.data.ts', 'PROVENANCE.md'];

export const SIMPLE_ICONS = { name: 'simple-icons', version: '16.33.0' };
export const DICEBEAR_COLLECTION = { name: '@dicebear/collection', version: '9.4.2' };
export const FLUENT_EMOJI = { name: '@iconify-json/fluent-emoji-flat', version: '1.2.6' };

/*
  Simple Icons' own per-icon licence data covers the SVG artwork. An icon with no entry falls
  under the project's CC0 data (the mark stays its owner's trademark). An icon that names a
  licence is kept only when that licence asks nothing of a page that shows it unmodified;
  attribution (CC-BY*), share-alike, copyleft, non-commercial, no-derivatives and "custom"
  icons are left out.
*/
const BRAND_LICENCES_KEPT = new Set(['CC0-1.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause', 'Unlicense']);

/* DiceBear styles that draw an abstract pattern, a monogram or an icon, not a character. */
const NOT_CHARACTERS = new Set(['glass', 'icons', 'identicon', 'initials', 'rings', 'shapes']);

// Longest first: `-medium-light` is a tone, not `-light` on a `-medium` name.
const SKIN_TONES = ['medium-light', 'medium-dark', 'light', 'medium', 'dark'];

function quote(text) {
  const singles = (text.match(/'/gu) ?? []).length;
  const doubles = (text.match(/"/gu) ?? []).length;
  const mark = singles > doubles ? '"' : "'";
  const body = text.replaceAll('\\', '\\\\').replaceAll(mark, `\\${mark}`);
  return `${mark}${body}${mark}`;
}

/** `npm pack <spec>` into `dir`, unpacked; the tarball's integrity and sha1 as npm reports them. */
function pack(spec, dir) {
  mkdirSync(dir, { recursive: true });
  const report = JSON.parse(
    execFileSync('npm', ['pack', spec, '--json', '--pack-destination', dir], {
      encoding: 'utf8',
      // Outside the repository: its devEngines names pnpm, and npm refuses to run under it.
      cwd: dir,
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  )[0];
  execFileSync('tar', ['xzf', path.join(dir, report.filename), '-C', dir]);
  return {
    name: report.name,
    version: report.version,
    integrity: report.integrity,
    shasum: report.shasum,
    root: path.join(dir, 'package'),
  };
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

// ── Simple Icons ──────────────────────────────────────────────────────────────

function aliasesOf(icon) {
  const aliases = icon.aliases ?? {};
  const names = [
    ...(aliases.aka ?? []),
    ...(aliases.old ?? []),
    ...(aliases.dup ?? []).map((entry) => entry.title),
    ...Object.values(aliases.loc ?? {}),
  ];
  return [
    ...new Set(
      names.map((name) => name.trim()).filter((name) => name !== '' && name !== icon.title),
    ),
  ];
}

function brandRows(root) {
  const icons = readJson(path.join(root, 'data/simple-icons.json'));
  const dropped = {};
  const rows = [];
  for (const icon of icons) {
    const licence = icon.license?.type;
    if (licence !== undefined && !BRAND_LICENCES_KEPT.has(licence)) {
      dropped[licence] = (dropped[licence] ?? 0) + 1;
      continue;
    }
    if (!/^[a-z0-9_]+$/u.test(icon.slug) || !/^[0-9A-F]{6}$/u.test(icon.hex)) {
      throw new Error(`simple-icons: unexpected slug or hex in ${JSON.stringify(icon)}`);
    }
    const fields = [icon.slug, icon.title, icon.hex, aliasesOf(icon).join(';')];
    if (
      fields.some((field) => field.includes('|')) ||
      aliasesOf(icon).some((alias) => alias.includes(';'))
    ) {
      throw new Error(`simple-icons: a separator inside ${icon.slug}`);
    }
    rows.push(fields.join('|'));
  }
  rows.sort((left, right) => left.localeCompare(right, 'en'));
  return { rows, total: icons.length, dropped };
}

// ── DiceBear ──────────────────────────────────────────────────────────────────

/** The `meta` object of a style's lib/index.js, read as text (string values only). */
function styleMeta(root) {
  const source = readFileSync(path.join(root, 'lib/index.js'), 'utf8');
  const block = /export const meta = \{([\s\S]*?)\n\};/u.exec(source)?.[1];
  if (block === undefined) throw new Error(`no meta in ${root}`);
  const field = (name, text = block) =>
    new RegExp(`\\b${name}: '((?:[^'\\\\]|\\\\.)*)'`, 'u').exec(text)?.[1]?.replaceAll("\\'", "'");
  const licence = /license: \{([\s\S]*?)\}/u.exec(block)?.[1] ?? '';
  return {
    title: field('title'),
    creator: field('creator'),
    source: field('source'),
    homepage: field('homepage'),
    licence: field('name', licence),
    licenceUrl: field('url', licence),
  };
}

/** The Design section's `License:` line of a style's LICENSE file. */
function designLicence(root) {
  const text = readFileSync(path.join(root, 'LICENSE'), 'utf8');
  const design = /# Design([\s\S]*?)(?:\n# |$)/u.exec(text)?.[1] ?? text;
  return /License:\s*(.+?)(?:\s+\(|$)/mu.exec(design)?.[1]?.trim();
}

/** What a page owes the artist: commercial use allowed, and whether a visible credit is required. */
function licenceTerms(name) {
  const plain = name.replace(/\.$/u, '').trim();
  if (plain === 'CC0 1.0' || plain === 'MIT') return { commercial: true, attribution: false };
  if (plain === 'CC BY 4.0') return { commercial: true, attribution: true };
  if (/^free for personal and commercial use$/iu.test(plain))
    return { commercial: true, attribution: false };
  return { commercial: false, attribution: true };
}

function characterStyles(dir) {
  const collection = pack(
    `${DICEBEAR_COLLECTION.name}@${DICEBEAR_COLLECTION.version}`,
    path.join(dir, 'collection'),
  );
  const names = Object.keys(readJson(path.join(collection.root, 'package.json')).dependencies)
    .filter((name) => name.startsWith('@dicebear/') && name !== '@dicebear/core')
    .sort();
  const styles = [];
  const packages = [collection];
  const skipped = [];
  for (const name of names) {
    const id = name.slice('@dicebear/'.length);
    const style = pack(`${name}@${DICEBEAR_COLLECTION.version}`, path.join(dir, id));
    packages.push(style);
    const meta = styleMeta(style.root);
    const design = designLicence(style.root);
    if (design !== undefined && design.replace(/\.$/u, '') !== meta.licence.replace(/\.$/u, '')) {
      throw new Error(`${name}: meta licence "${meta.licence}" disagrees with LICENSE "${design}"`);
    }
    if (NOT_CHARACTERS.has(id)) {
      skipped.push({ id, reason: 'not a character', licence: meta.licence });
      continue;
    }
    const terms = licenceTerms(meta.licence);
    if (!terms.commercial) {
      skipped.push({ id, reason: 'no commercial use', licence: meta.licence });
      continue;
    }
    styles.push({
      id,
      title: meta.title,
      creator: meta.creator,
      licence: meta.licence.replace(/\.$/u, ''),
      licenceUrl: meta.licenceUrl,
      source: meta.source,
      attribution: terms.attribution,
    });
  }
  return { styles, skipped, packages };
}

// ── Fluent Emoji ──────────────────────────────────────────────────────────────

function emojiCatalog(root) {
  const icons = readJson(path.join(root, 'icons.json'));
  const metadata = readJson(path.join(root, 'metadata.json'));
  const info = readJson(path.join(root, 'info.json'));
  const visible = new Set(
    Object.keys(icons.icons).filter((name) => icons.icons[name].hidden !== true),
  );
  for (const [name, alias] of Object.entries(icons.aliases ?? {})) {
    if (visible.has(alias.parent)) visible.add(name);
  }
  const toneOf = (name) =>
    SKIN_TONES.find(
      (tone) => name.endsWith(`-${tone}`) && visible.has(name.slice(0, -tone.length - 1)),
    );
  const toned = new Set();
  const bases = new Set();
  for (const name of visible) {
    const tone = toneOf(name);
    if (tone === undefined) bases.add(name);
    else toned.add(name.slice(0, -tone.length - 1));
  }
  const categories = {};
  const placed = new Set();
  for (const [category, names] of Object.entries(metadata.categories).sort(([a], [b]) =>
    a.localeCompare(b, 'en'),
  )) {
    const kept = names.filter((name) => bases.has(name) && !placed.has(name));
    for (const name of kept) placed.add(name);
    categories[category] = [...new Set(kept)].sort();
  }
  // An alias without a category of its own sits with its parent's.
  for (const name of [...bases].filter((entry) => !placed.has(entry)).sort()) {
    const parent = icons.aliases?.[name]?.parent;
    const category = Object.keys(categories).find((key) => categories[key].includes(parent));
    if (category === undefined) throw new Error(`fluent-emoji-flat: no category for ${name}`);
    categories[category] = [...categories[category], name].sort();
  }
  return { categories, toned: [...toned].sort(), info, total: Object.keys(icons.icons).length };
}

// ── Output ────────────────────────────────────────────────────────────────────

const HEADER = (source) =>
  `/*\n  GENERATED by scripts/build-art-catalog.mjs from ${source} — do not edit by hand.\n  Re-run the script to update it; PROVENANCE.md records the tarball and its licence.\n*/\n`;

function writeBrands(brands) {
  const lines = [
    HEADER(`${SIMPLE_ICONS.name}@${SIMPLE_ICONS.version}`),
    `export const SIMPLE_ICONS_VERSION = ${quote(SIMPLE_ICONS.version)};`,
    '',
    '/** One brand a row: `slug|title|hex|alias;alias` (the marks are their owners’ trademarks). */',
    'export const BRAND_ROWS: readonly string[] = [',
    ...brands.rows.map((row) => `  ${quote(row)},`),
    '];',
    '',
  ];
  writeFileSync(path.join(OUT, 'brands.data.ts'), lines.join('\n'));
}

function writeCharacters(characters) {
  const entry = (style) =>
    [
      '  {',
      ...Object.entries(style).map(
        ([key, value]) =>
          `    ${key}: ${typeof value === 'string' ? quote(value) : String(value)},`,
      ),
      '  },',
    ].join('\n');
  const lines = [
    HEADER(`@dicebear/<style>@${DICEBEAR_COLLECTION.version}`),
    `export const DICEBEAR_VERSION = ${quote(DICEBEAR_COLLECTION.version)};`,
    '',
    '/** A DiceBear style whose artwork licence allows commercial use, as its package states it. */',
    'export interface DiceBearStyleEntry {',
    '  readonly id: string;',
    '  readonly title: string;',
    '  readonly creator: string;',
    '  readonly licence: string;',
    '  readonly licenceUrl: string;',
    '  readonly source: string;',
    '  /** The licence requires a visible credit (CC BY 4.0). */',
    '  readonly attribution: boolean;',
    '}',
    '',
    'export const DICEBEAR_STYLES: readonly DiceBearStyleEntry[] = [',
    ...characters.styles.map(entry),
    '];',
    '',
  ];
  writeFileSync(path.join(OUT, 'characters.data.ts'), lines.join('\n'));
}

function writeEmoji(emoji) {
  const lines = [
    HEADER(`${FLUENT_EMOJI.name}@${FLUENT_EMOJI.version}`),
    `export const FLUENT_EMOJI_VERSION = ${quote(FLUENT_EMOJI.version)};`,
    '',
    '/** Fluent Emoji Flat names by category, space-separated (skin-tone variants left out). */',
    'export const EMOJI_BY_CATEGORY: Readonly<Record<string, string>> = {',
    ...Object.entries(emoji.categories).map(
      ([category, names]) =>
        `  ${/^\w+$/u.test(category) ? category : quote(category)}:\n    ${quote(names.join(' '))},`,
    ),
    '};',
    '',
    '/** Names that also come in five skin tones: `<name>-light` … `<name>-dark`. */',
    `export const EMOJI_TONED =\n  ${quote(emoji.toned.join(' '))};`,
    '',
  ];
  writeFileSync(path.join(OUT, 'emoji.data.ts'), lines.join('\n'));
}

function writeProvenance({ date, simple, brands, characters, fluent, emoji }) {
  const row = (pkg, licence) =>
    `| \`${pkg.name}@${pkg.version}\` | \`${pkg.integrity}\` | \`${pkg.shasum}\` | ${licence} |`;
  const count = (categories) =>
    Object.values(categories).reduce((sum, names) => sum + names.length, 0);
  const lines = [
    '# Art catalog provenance',
    '',
    `Generated ${date} by \`scripts/build-art-catalog.mjs\` with \`npm pack\` (never installed as a`,
    'dependency). Re-run the script to update; it rewrites this file and the three `.data.ts` modules.',
    '',
    '| Package | Tarball integrity | sha1 | Licence |',
    '| --- | --- | --- | --- |',
    row(simple, 'CC0-1.0 (data)'),
    row(fluent, `${emoji.info.license.spdx} (${emoji.info.author.name})`),
    ...characters.packages.map((pkg) => {
      const style = characters.styles.find((entry) => `@dicebear/${entry.id}` === pkg.name);
      const skipped = characters.skipped.find((entry) => `@dicebear/${entry.id}` === pkg.name);
      return row(
        pkg,
        style?.licence ??
          (skipped === undefined
            ? 'MIT (code)'
            : `${skipped.licence} — left out: ${skipped.reason}`),
      );
    }),
    '',
    '## Brand logos (Simple Icons)',
    '',
    `${String(brands.rows.length)} of ${String(brands.total)} brands. Left out by their own icon licence: ${Object.entries(
      brands.dropped,
    )
      .map(([licence, n]) => `${licence} ${String(n)}`)
      .join(', ')}.`,
    '',
    '**Trademarks.** The Simple Icons data is CC0-1.0, but every logo is a trademark of its owner,',
    'and its use may be governed by the owner’s brand guidelines. The agent shows a logo only for',
    'a brand the person names (a client, a partner, an integration, a payment method, an app store),',
    'refuses a brand the catalog does not hold with a request to upload the logo, and never draws',
    'the person’s own company logo. Pages load `https://cdn.simpleicons.org/<slug>` (the latest',
    'release, not this pin): a brand Simple Icons later removes stops loading.',
    '',
    '## Cartoon characters (DiceBear)',
    '',
    'Artwork licences as each package states them (`meta` in `lib/index.js`, checked against the',
    'Design section of its `LICENSE`):',
    '',
    '| Style | Title | Creator | Licence | Credit required |',
    '| --- | --- | --- | --- | --- |',
    ...characters.styles.map(
      (style) =>
        `| \`${style.id}\` | ${style.title} | ${style.creator} | [${style.licence}](${style.licenceUrl}) | ${style.attribution ? 'yes' : 'no'} |`,
    ),
    '',
    `Left out: ${characters.skipped.map((entry) => `\`${entry.id}\` (${entry.reason})`).join(', ')}.`,
    '',
    '## Illustrations (Fluent Emoji Flat)',
    '',
    `${String(count(emoji.categories))} names (of ${String(emoji.total)} icons; the five skin-tone variants of`,
    `${String(emoji.toned.length)} people are addressed as \`<name>-<tone>\`), served by`,
    '`https://api.iconify.design/fluent-emoji-flat/<name>.svg`.',
    '',
  ];
  writeFileSync(path.join(OUT, 'PROVENANCE.md'), lines.join('\n'));
}

function main() {
  const dateArg = process.argv.find((arg) => arg.startsWith('--date='))?.slice('--date='.length);
  const date = dateArg ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error('--date must be YYYY-MM-DD');
  const dir = mkdtempSync(path.join(tmpdir(), 'ck-art-catalog-'));
  try {
    const simple = pack(
      `${SIMPLE_ICONS.name}@${SIMPLE_ICONS.version}`,
      path.join(dir, 'simple-icons'),
    );
    const brands = brandRows(simple.root);
    const characters = characterStyles(path.join(dir, 'dicebear'));
    const fluent = pack(`${FLUENT_EMOJI.name}@${FLUENT_EMOJI.version}`, path.join(dir, 'fluent'));
    const emoji = emojiCatalog(fluent.root);
    mkdirSync(OUT, { recursive: true });
    writeBrands(brands);
    writeCharacters(characters);
    writeEmoji(emoji);
    writeProvenance({ date, simple, brands, characters, fluent, emoji });
    // The repository's own formatter, so a re-run leaves `pnpm format:check` clean.
    execFileSync(process.execPath, [
      path.join(ROOT, 'node_modules/prettier/bin/prettier.cjs'),
      '--log-level',
      'warn',
      '--write',
      ...GENERATED.map((file) => path.join(OUT, file)),
    ]);
    process.stdout.write(
      `art catalog: ${String(brands.rows.length)} brands, ${String(characters.styles.length)} character styles, ${String(Object.values(emoji.categories).flat().length)} illustrations → ${path.relative(ROOT, OUT)}\n`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
