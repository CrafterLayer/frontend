/*
  @vitest-environment node

  Reads the installed tarball from disk; no DOM.
*/
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { TW_ANIMATE_CSS, TW_ANIMATE_SHA256, TW_ANIMATE_VERSION } from './tw-animate-source';

const GENERATED = fileURLToPath(new URL('./tw-animate-source.ts', import.meta.url));

/**
 * The installed package's directory. `require.resolve` cannot answer it: the package exports
 * its stylesheet only under the `style` condition, and itself not at all.
 */
function packageDirectory(name: string): string {
  const paths = createRequire(import.meta.url).resolve.paths(name) ?? [];
  const found = paths.map((path) => join(path, name)).find((path) => existsSync(path));
  if (found === undefined) throw new Error(`${name} is not installed`);
  return found;
}

const directory = packageDirectory('tw-animate-css');
const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as {
  readonly version: string;
  readonly license: string;
};
const installed = readFileSync(join(directory, 'dist/tw-animate.css'), 'utf8');

/** The generated module, exactly as it is checked in. */
function sourceModule(css: string, version: string): string {
  const digest = createHash('sha256').update(css).digest('hex');
  return `/*
  GENERATED FILE — do not edit by hand.

  tw-animate-css@${version} dist/tw-animate.css, byte for byte (MIT (c) 2025 Wombosvideo; the
  licence text is in vendor/THIRD_PARTY_LICENSES.md). The package exports that file only under
  the \`style\` condition, which a stylesheet pipeline honours and a script bundler does not, so
  the in-page compiler reads it from here while the static sheet imports the package itself.

  tw-animate-source.test.ts holds it equal to the installed tarball. Regenerate with
    UPDATE_TAILWIND_CSS=1 pnpm --filter @craftkit/builder-renderer test src/tailwind
*/
export const TW_ANIMATE_VERSION = '${version}';

export const TW_ANIMATE_SHA256 = '${digest}';

export const TW_ANIMATE_CSS =
  '${css.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}';
`;
}

describe('the tw-animate-css copy the in-page compiler reads', () => {
  it('is the installed tarball, byte for byte', () => {
    const expected = sourceModule(installed, manifest.version);
    if (process.env['UPDATE_TAILWIND_CSS'] === '1') writeFileSync(GENERATED, expected, 'utf8');
    expect(readFileSync(GENERATED, 'utf8')).toBe(expected);
    expect(TW_ANIMATE_CSS).toBe(installed);
    expect(TW_ANIMATE_VERSION).toBe(manifest.version);
    expect(createHash('sha256').update(TW_ANIMATE_CSS).digest('hex')).toBe(TW_ANIMATE_SHA256);
  });

  it('comes from an MIT release, checked in the tarball rather than only the manifest', () => {
    expect(manifest.license).toBe('MIT');
    const licence = readFileSync(join(directory, 'LICENSE'), 'utf8');
    expect(licence).toMatch(/^MIT License/u);
    expect(licence).toContain('Permission is hereby granted, free of charge');
  });
});
