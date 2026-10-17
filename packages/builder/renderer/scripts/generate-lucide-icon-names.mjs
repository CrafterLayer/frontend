// Regenerates packages/builder/schema/src/custom-code/lucide-icon-names.ts from
// the installed `lucide` package. Run from packages/builder/renderer (the one
// package that depends on lucide): `pnpm generate:icons`.
//
// The kebab-case names are read from the per-icon module FILENAMES, never
// derived from the PascalCase export keys: `ArrowDown01` could be
// `arrow-down-01` or `arrow-down-0-1`, and only the file says which.
import { readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = require('lucide/package.json');
const iconsDir = join(dirname(require.resolve('lucide/package.json')), 'dist', 'esm', 'icons');
const names = readdirSync(iconsDir)
  .filter((file) => /\.m?js$/u.test(file))
  .map((file) => file.replace(/\.m?js$/u, ''))
  .filter((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name))
  .sort();

const out = resolve('../schema/src/custom-code/lucide-icon-names.ts');
writeFileSync(
  out,
  `// GENERATED from lucide@${pkg.version} by packages/builder/renderer/scripts/generate-lucide-icon-names.mjs.
// Do not edit by hand; run \`pnpm --filter @craftkit/builder-renderer generate:icons\`.
//
// The names live at layer 0 so the AI door can refuse an icon that does not
// exist without this package depending on the icon library — the same
// arrangement as the utility vocabulary. The renderer, which does depend on
// lucide, has a test proving every name here resolves in the installed set.

export const LUCIDE_VERSION = '${pkg.version}';

const NAMES = \`${names.join('\n')}\`;

let cached: ReadonlySet<string> | undefined;

/** Every icon name in the set, expanded once. */
export function lucideIconNames(): ReadonlySet<string> {
  cached ??= new Set(NAMES.split('\\n'));
  return cached;
}

/** Whether a kebab-case name is an icon in the set. */
export function isLucideIconName(name: string): boolean {
  return lucideIconNames().has(name);
}
`,
);
console.log(`wrote ${names.length} icon names for lucide@${pkg.version} -> ${out}`);
