#!/usr/bin/env node
/*
  Section kit: upstream HTML → a DRAFT kit (DESIGN §B).

  Usage (from the repo root, Node 24):
    node scripts/section-kit/convert.mjs vendor/hyperui/upstream/public/examples/marketing/ctas/1.html [kit-id] [role]

  Prints a draft `SectionKit` object literal (TypeScript) to stdout and the
  notes that need a person's eye to stderr. It never writes a file: a draft
  is reviewed — repeated siblings wrapped in {{#items}}…{{/items}}, slots
  renamed to the role's names (title, lead, cta, image, items[…]), the look
  brought up to the kit's standard — and then committed by hand under
  packages/builder/ai/src/section-kit/kits/. The kit tests (kits.test.ts)
  hold every committed kit to the door, to logical direction classes and to
  page-kit colours.

  The transform itself is pure TypeScript in
  packages/builder/ai/src/section-kit/convert-core.ts, imported here directly
  (Node 24 strips the types), so the unit tests exercise the same code this
  script runs. No dependency beyond node built-ins and htmlparser2, which the
  ai package already has and which resolves from convert-core's location.
  Run once per upstream update; never at request time, and never with a model.
*/
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertUpstreamHtml } from '../../packages/builder/ai/src/section-kit/convert-core.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const PINS = {
  hyperui: '2b5aebbc50d2c9ac89650f51b554f53895b4803c',
  tailark: '8139698115c1341bfd2e3e286c04bb4d8146f472',
  merakiui: 'fe0472efe93f6cd275424ecbdfa7f6cb8da6f908',
};

const [file, idArgument, roleArgument] = process.argv.slice(2);
if (file === undefined) {
  console.error('usage: node scripts/section-kit/convert.mjs <vendor/<lib>/upstream/<path>.html> [kit-id] [role]');
  process.exit(1);
}

const absolute = resolve(process.cwd(), file);
const relative = absolute.slice(repoRoot.length + 1);
const match = /^vendor\/(hyperui|tailark|merakiui)\/upstream\/(.+)$/u.exec(relative);
const lib = match?.[1] ?? 'hyperui';
const upstreamPath = match?.[2] ?? relative;
const id = idArgument ?? basename(file, extname(file)).toLowerCase();
const role = roleArgument ?? 'features';

const draft = convertUpstreamHtml(await readFile(absolute, 'utf8'));

const kit = {
  id,
  role,
  summary: 'TODO: 8 words or fewer',
  source: { lib, file: upstreamPath, commit: PINS[lib] },
  slots: draft.slots,
  markup: draft.markup,
};

console.log(`// Draft from ${relative} — review before committing.\n${JSON.stringify(kit, null, 2)}`);
for (const note of draft.notes) console.error(`note: ${note}`);
