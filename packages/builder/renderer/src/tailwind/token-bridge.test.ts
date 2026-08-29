/*
  @vitest-environment node

  This suite reads and writes a file on disk and touches no DOM. Under the
  package's default jsdom environment `import.meta.url` is an http URL, and
  fileURLToPath rejects it with "The URL must be of scheme file".
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { TokenName } from '../resolve/theme';
import { lightTheme } from '../themes';
import { TAILWIND_NAMESPACE, buildTailwindThemeCss, tailwindVarName } from './token-bridge';

const CHECKED_IN_CSS = fileURLToPath(new URL('./tailwind-theme.css', import.meta.url));

describe('tailwind token bridge', () => {
  /*
    The exhaustiveness gate. `Record<TokenName, …>` already makes a MISSING
    token a type error, but a token deleted from the union while its binding
    stays would pass the compiler and silently emit a variable nothing reads.
    This catches that direction too.
  */
  it('binds exactly the tokens a theme actually has, no more and no fewer', () => {
    const themeTokens = Object.keys(lightTheme).sort();
    const boundTokens = Object.keys(TAILWIND_NAMESPACE).sort();

    expect(boundTokens).toEqual(themeTokens);
  });

  it('points every binding at a --t-* custom property, never at a value', () => {
    const css = buildTailwindThemeCss();
    const declarations = css.match(/^\s{2}--[\w-]+: .+;$/gm) ?? [];

    expect(declarations.length).toBe(Object.keys(lightTheme).length);
    for (const declaration of declarations) {
      expect(declaration).toMatch(/: var\(--t-[a-z0-9-]+\);$/);
    }
  });

  /*
    A page whose theme is swapped at runtime must restyle. `@theme inline` is
    what preserves the indirection; a plain `@theme` copies the value once and
    the page freezes at whatever palette it started with.
  */
  it('uses @theme inline so a runtime design-system change still moves the page', () => {
    expect(buildTailwindThemeCss()).toContain('@theme inline {');
  });

  it('produces no duplicate Tailwind variable names', () => {
    const names = (Object.keys(lightTheme) as TokenName[]).map(tailwindVarName);

    expect(new Set(names).size).toBe(names.length);
  });

  /*
    The drift gate, matching the one the chrome stylesheet already has: a
    checked-in generated file is a lie the moment its generator moves on.
  */
  it('holds the checked-in stylesheet equal to its generator', () => {
    // The shipped file is a build artifact kept in the tree so consumers need
    // no build step, matching how chrome.css is handled. Add a token and
    // forget to regenerate, and you fail HERE rather than shipping a utility
    // that silently resolves to nothing.
    //
    // Regenerate with:
    //   UPDATE_TAILWIND_CSS=1 pnpm --filter @craftkit/builder-renderer test
    const expected = buildTailwindThemeCss();
    if (process.env['UPDATE_TAILWIND_CSS'] === '1') {
      writeFileSync(CHECKED_IN_CSS, expected, 'utf8');
    }

    expect(readFileSync(CHECKED_IN_CSS, 'utf8')).toBe(expected);
  });
});
