import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { lightTheme, tokenCssName, type TokenName } from '@craftkit/builder-renderer';

/**
 * The law: a block's stylesheet may only reference tokens the theme defines.
 *
 * This exists because the opposite failed silently for a long time. Fifteen of
 * the tokens these stylesheets referenced — every section spacing, every content
 * width, every control padding — were never assigned by any theme, so each
 * `var(--t-section-spacing-lg, 64px)` resolved to its fallback, always. The
 * pages LOOKED themed and could not be re-themed: re-pointing the theme moved
 * the colours and left every measurement exactly where it was.
 *
 * A fallback is what makes that failure invisible, which is why the check is on
 * the NAME rather than the rendered result.
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
    expect(files.length).toBeGreaterThan(5);
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
      /*
        `--bldr-*` is the EDITOR's vocabulary. The two are kept apart so a person
        working in a dark editor does not see their light page repainted; a page
        stylesheet reaching for a chrome token is that separation breaking.
      */
      expect(readFileSync(file, 'utf8')).not.toMatch(/var\(--bldr-/);
    },
  );
});
