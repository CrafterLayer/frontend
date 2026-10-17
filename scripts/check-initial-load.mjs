#!/usr/bin/env node
/*
  The first-load budget of a Vite application build (performance pass, 2026-10-12).

    node scripts/check-initial-load.mjs <dist> entry=<gzip bytes> js=<gzip bytes> css=<gzip bytes>

  `check-bundle-size.mjs` measures one file at a fixed path; an application's entry chunk is
  content-hashed, and what a first visit downloads before the app can start is the entry, every
  chunk the entry imports statically (Vite emits them as `<link rel="modulepreload">`) and every
  stylesheet `index.html` links. This reads `<dist>/index.html`, sums those files at gzip level 9
  and fails when any of the three exceeds its budget:

  - entry: the `<script type="module" src>` chunk alone;
  - js: the entry plus every modulepreloaded chunk;
  - css: every linked stylesheet (render-blocking).

  Lazily loaded chunks (`import()`) are not counted: they are not part of the first load.
*/

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const KINDS = ['entry', 'js', 'css'];

/** The files `index.html` loads up front, as paths relative to `dist`. */
export function initialFiles(html) {
  const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]+)"`, 'u').exec(tag)?.[1];
  const tags = html.match(/<(?:script|link)\b[^>]*>/gu) ?? [];
  const local = (href) => (href.startsWith('/') ? href.slice(1) : href);
  let entry;
  const preloads = [];
  const styles = [];
  for (const tag of tags) {
    const src = attribute(tag, 'src');
    const href = attribute(tag, 'href');
    const rel = attribute(tag, 'rel');
    if (tag.startsWith('<script') && /\stype="module"/u.test(tag) && src !== undefined) {
      entry ??= local(src);
    } else if (rel === 'modulepreload' && href !== undefined) {
      preloads.push(local(href));
    } else if (rel === 'stylesheet' && href !== undefined && !/^(?:https?:)?\/\//u.test(href)) {
      styles.push(local(href));
    }
  }
  if (entry === undefined) throw new Error('index.html has no <script type="module" src>');
  return { entry, preloads, styles };
}

async function gzipBytes(dist, file) {
  return gzipSync(await readFile(join(dist, file)), { level: 9 }).length;
}

/** Measured gzip bytes of the first load: the entry chunk, all initial JS and all initial CSS. */
export async function measureInitialLoad(dist) {
  const { entry, preloads, styles } = initialFiles(
    await readFile(join(dist, 'index.html'), 'utf8'),
  );
  const entryBytes = await gzipBytes(dist, entry);
  let js = entryBytes;
  for (const file of preloads) js += await gzipBytes(dist, file);
  let css = 0;
  for (const file of styles) css += await gzipBytes(dist, file);
  return { entry: entryBytes, js, css, files: { entry, preloads, styles } };
}

export async function checkInitialLoad(dist, budgets) {
  for (const kind of KINDS) {
    const budget = budgets[kind];
    if (!Number.isSafeInteger(budget) || budget <= 0) {
      throw new TypeError(`${kind} budget must be a positive safe integer`);
    }
  }
  const measured = await measureInitialLoad(resolve(dist));
  const over = KINDS.filter((kind) => measured[kind] > budgets[kind]);
  return { measured, over };
}

async function run() {
  const [dist, ...pairs] = process.argv.slice(2);
  const budgets = Object.fromEntries(
    pairs.map((pair) => {
      const [kind, value] = pair.split('=');
      return [kind, Number(value)];
    }),
  );
  if (!dist || KINDS.some((kind) => budgets[kind] === undefined)) {
    throw new TypeError(
      'Usage: check-initial-load.mjs <dist> entry=<gzip bytes> js=<gzip bytes> css=<gzip bytes>',
    );
  }
  const { measured, over } = await checkInitialLoad(dist, budgets);
  for (const kind of KINDS) {
    process.stdout.write(
      `${over.includes(kind) ? 'OVER' : 'ok  '} ${kind.padEnd(5)} ${String(measured[kind]).padStart(9)} / ${String(budgets[kind]).padStart(9)} bytes gzip\n`,
    );
  }
  if (over.length > 0) {
    throw new RangeError(
      `First-load budget exceeded (${over.join(', ')}). Move what the first paint does not need behind import().`,
    );
  }
}

const executedFile = process.argv[1];

if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
