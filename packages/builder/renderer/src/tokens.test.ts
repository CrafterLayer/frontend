import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { lightTheme, tokenCssName, type TokenName } from './index';

/**
 * Renderer styles paint the page itself, so every page token they reference
 * must be part of the renderer-owned theme vocabulary. Editor chrome uses the
 * deliberately separate `--bldr-*` vocabulary and must never leak in here.
 */
const STYLESHEET_ROOT = join(import.meta.dirname, 'components');

function stylesheets(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return stylesheets(path);
    return entry.endsWith('.css') ? [path] : [];
  });
}

const DEFINED = new Set((Object.keys(lightTheme) as TokenName[]).map((name) => tokenCssName(name)));

describe('page tokens', () => {
  const files = stylesheets(STYLESHEET_ROOT);

  it('finds the stylesheets it claims to check', () => {
    // Without this the whole suite passes by scanning nothing.
    expect(files.length).toBeGreaterThan(1);
  });

  it.each(files.map((file) => [file.slice(STYLESHEET_ROOT.length + 1), file]))(
    '%s references only tokens the theme defines',
    (_label, file) => {
      const referenced = [...readFileSync(file, 'utf8').matchAll(/var\((--t-[a-z0-9-]+)/g)].map(
        (match) => match[1]!,
      );

      expect(referenced.length).toBeGreaterThan(0);
      for (const token of referenced) {
        expect(DEFINED, `${token} is referenced but no theme defines it`).toContain(token);
      }
    },
  );

  it.each(files.map((file) => [file.slice(STYLESHEET_ROOT.length + 1), file]))(
    '%s uses no chrome token',
    (_label, file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(/var\(--bldr-/);
    },
  );
});
