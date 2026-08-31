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

  /*
    The count dropped from six to one when the blocks moved to Tailwind, and
    that is the migration working rather than the guard failing: a block whose
    appearance is token-bound utilities has nothing left to put in a
    stylesheet. `section-layout.css` remains because the shared typography
    helper still emits `.mkt-type--*` classes.

    The guard stays, at the honest number, because a suite that scans nothing
    passes vacuously — and the law it protects did not disappear. It moved, so
    the check below moved with it.
  */
  it('finds the stylesheet it claims to check', () => {
    expect(files.length).toBeGreaterThan(0);
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

/*
  Where the law went.

  Before the Tailwind migration, "a block may only reference tokens the theme
  defines" was enforceable by reading CSS. The blocks now express appearance as
  utilities in TSX, so the same law has to be read there — and the failure it
  guards against is worse in this form, because a Tailwind palette class looks
  perfectly reasonable in a diff.
*/
describe('block components use only token-bound utilities', () => {
  const componentFiles = readdirSync(STYLESHEET_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = join(STYLESHEET_ROOT, entry.name);
      return readdirSync(dir)
        .filter(
          (name) =>
            name.endsWith('.tsx') && !name.includes('.test.') && !name.includes('.stories.'),
        )
        .map((name) => join(dir, name));
    });

  it('finds the components it claims to check', () => {
    // Same reasoning as above: scanning nothing must not read as success.
    expect(componentFiles.length).toBeGreaterThan(8);
  });

  it.each(componentFiles.map((file) => [file.slice(STYLESHEET_ROOT.length + 1), file]))(
    '%s names no Tailwind palette colour and no arbitrary value',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');

      /*
        Tailwind's own palette. A page half in brand colours and half in
        Tailwind blue reads as broken rather than themed, and no token binding
        can reach `bg-blue-500`.
      */
      const palette = source.match(
        /\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|decoration|accent|caret|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
      );
      expect(palette ?? [], `${_label} uses Tailwind's own palette`).toEqual([]);

      /*
        An arbitrary value is banned when it hard-codes a VALUE — not merely
        when it uses brackets.

        The distinction was forced by a real case in this codebase:
        `grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-grid-min-track)),1fr))]`
        is a grid TEMPLATE whose only length reads a token. Banning it would
        have banned the shape rather than the literal, and the alternative —
        a breakpoint ladder of fixed column counts — is strictly worse and
        strictly less token-bound.

        So the rule is: brackets are fine if what is inside resolves through a
        custom property. Two narrow exceptions carry no token because none
        could exist — a viewport unit describes the SCREEN, and a percentage
        describes the PARENT.
      */
      const arbitrary = (source.match(/\b[a-z-]+-\[[^\]]+\]/g) ?? []).filter((utility) => {
        if (utility.includes('var(--')) return false;
        if (/^min-h-\[\d+svh\]$/.test(utility)) return false;
        return true;
      });
      expect(arbitrary, `${_label} hard-codes a value in brackets`).toEqual([]);
    },
  );
});
