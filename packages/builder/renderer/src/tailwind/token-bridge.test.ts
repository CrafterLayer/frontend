/*
  @vitest-environment node

  This suite reads and writes a file on disk and touches no DOM. Under the
  package's default jsdom environment `import.meta.url` is an http URL, and
  fileURLToPath rejects it with "The URL must be of scheme file".
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tokenCssName, type TokenName } from '../resolve/theme';
import { lightTheme } from '../themes';
import { TAILWIND_NAMESPACE, buildTailwindThemeCss, tailwindVarName } from './token-bridge';

const CHECKED_IN_CSS = fileURLToPath(new URL('./tailwind-theme.css', import.meta.url));

/**
 * The declarations inside `@theme`, each on one line regardless of how it was
 * printed.
 *
 * A long fallback (the font stacks name every face) is wrapped across lines to
 * match Prettier, which formats this file like any other. That is a layout
 * decision, and none of the laws below are about layout — so they read the
 * normalised form and stay true whichever way it is printed.
 */
function themeDeclarations(css: string): string[] {
  const body = css.slice(
    css.indexOf('@theme inline {') + '@theme inline {'.length,
    css.lastIndexOf('}'),
  );
  return (
    body
      .replace(/\s+/g, ' ')
      /* The wrap puts a space after `var(` and before `)`; unwrapping removes it. */
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .replace(/,\s*\)/g, ')')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration.length > 0)
      .map((declaration) => `${declaration};`)
  );
}

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

  it('points every binding at a --t-* custom property, never at a bare value', () => {
    const declarations = themeDeclarations(buildTailwindThemeCss());

    expect(declarations.length).toBe(Object.keys(lightTheme).length);
    for (const declaration of declarations) {
      /*
        A fallback is allowed; a value in the token's PLACE is not. The
        distinction is the whole product: `var(--t-accent, #4f46e5)` still
        moves when the design system re-points the token, and a plain
        `#4f46e5` never does.
      */
      expect(declaration).toMatch(/^--[\w-]+: var\(--t-[a-z0-9-]+, .+\);$/);
    }
  });

  /*
    The fallback is not decoration.

    `--t-*` is written into a document by exactly one thing — `CanvasFrame`,
    into the editor's preview frame. `StaticDocument`, the publish path, emits
    no theme at all. That was survivable while blocks were styled by
    stylesheets reading `var(--t-space-unit, 4px)`; the Tailwind migration
    deleted those files and every fallback in them, and a bare
    `var(--t-gap-lg)` resolves to nothing, which sends `gap` back to `normal`.
    The Chromium story `Stack > Gap Is Real` measured exactly that: 0px where
    the block requires more than 8.

    So this asserts the fallback is the token's own value in the theme being
    generated from — a wrong-but-present fallback would pass a regex and still
    publish a page laid out to a palette nobody chose.
  */
  it('falls back to the generating theme, so an unthemed page still has its geometry', () => {
    const declarations = new Set(themeDeclarations(buildTailwindThemeCss(lightTheme)));

    for (const [name, value] of Object.entries(lightTheme)) {
      const token = name as TokenName;
      const collapsed = value.replace(/\s+/g, ' ');

      expect(declarations).toContain(
        `${tailwindVarName(token)}: var(${tokenCssName(token)}, ${collapsed});`,
      );
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
