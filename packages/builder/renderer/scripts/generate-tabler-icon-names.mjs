// Regenerates packages/builder/schema/src/custom-code/tabler-icon-names.ts from
// the installed `@tabler/icons` package (MIT). Run from packages/builder/renderer
// (the package that depends on it): `pnpm generate:tabler-icons`, or pass the
// package folder explicitly: `node scripts/generate-tabler-icon-names.mjs <dir>`.
//
// The names are read from the package's own icon-node JSON (one key per icon),
// the same files the renderer loads lazily to draw them. `@tabler/icons`
// exports only `./icons/*`, so the folder is located on disk rather than
// through `require.resolve`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? join('node_modules', '@tabler', 'icons'));
if (!existsSync(join(dir, 'tabler-nodes-outline.json'))) {
  console.error(`@tabler/icons not found at ${dir}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const namesOf = (file) =>
  Object.keys(JSON.parse(readFileSync(join(dir, file), 'utf8')))
    .filter((name) => KEBAB.test(name))
    .sort();
const outline = namesOf('tabler-nodes-outline.json');
const filled = namesOf('tabler-nodes-filled.json');

const out = resolve('../schema/src/custom-code/tabler-icon-names.ts');
writeFileSync(
  out,
  `// GENERATED from @tabler/icons@${pkg.version} (MIT, (c) Paweł Kuna) by
// packages/builder/renderer/scripts/generate-tabler-icon-names.mjs.
// Do not edit by hand; run \`pnpm --filter @craftkit/builder-renderer generate:tabler-icons\`.
//
// Tabler is the SECOND icon set (Lucide stays the default). A tree names one as
// \`tabler:<name>\` (outline) or \`tabler-filled:<name>\`. The names live at layer 0
// so the door can refuse an icon that does not exist without this package
// depending on the icon library; the renderer loads the drawing data lazily.

export const TABLER_VERSION = '${pkg.version}';

const OUTLINE = \`${outline.join('\n')}\`;

const FILLED = \`${filled.join('\n')}\`;

let outlineSet: ReadonlySet<string> | undefined;
let filledSet: ReadonlySet<string> | undefined;

/** Every outline icon name in the set, expanded once. */
export function tablerOutlineIconNames(): ReadonlySet<string> {
  outlineSet ??= new Set(OUTLINE.split('\\n'));
  return outlineSet;
}

/** Every filled icon name in the set, expanded once. */
export function tablerFilledIconNames(): ReadonlySet<string> {
  filledSet ??= new Set(FILLED.split('\\n'));
  return filledSet;
}

/** Whether a bare kebab-case name is a Tabler icon in the given style. */
export function isTablerIconName(name: string, style: 'outline' | 'filled' = 'outline'): boolean {
  return (style === 'filled' ? tablerFilledIconNames() : tablerOutlineIconNames()).has(name);
}
`,
);
console.log(
  `wrote ${String(outline.length)} outline + ${String(filled.length)} filled names for @tabler/icons@${pkg.version} -> ${out}`,
);
