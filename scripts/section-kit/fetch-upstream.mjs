#!/usr/bin/env node
/*
  Section kit: fetch the upstream files the kit is adapted from.

  Usage (from the repo root):
    node scripts/section-kit/fetch-upstream.mjs

  Reads upstream-files.json beside this script and copies every listed file,
  plus each library's licence, VERBATIM from raw.githubusercontent.com at the
  pinned commit into vendor/<lib>/upstream/<path> (the licence into
  vendor/<lib>/<licence file>). Node built-ins only. Nothing under vendor/ is
  compiled or imported: the copies exist so the derivation of every kit in
  packages/builder/ai/src/section-kit/kits is auditable. Re-run it after
  changing a pin; a file that fails to fetch stops the script (exit 1).
*/
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const manifest = JSON.parse(await readFile(join(here, 'upstream-files.json'), 'utf8'));

async function fetchText(repo, commit, path) {
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${String(response.status)} for ${url}`);
  return response.text();
}

let count = 0;
for (const [lib, entry] of Object.entries(manifest)) {
  const base = join(repoRoot, 'vendor', lib);
  await mkdir(base, { recursive: true });
  await writeFile(join(base, entry.license), await fetchText(entry.repo, entry.commit, entry.license));
  for (const path of entry.files) {
    const target = join(base, 'upstream', path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await fetchText(entry.repo, entry.commit, path));
    count += 1;
  }
}
console.log(`fetched ${String(count)} upstream files`);
