import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CHROME_TOKENS, RUNTIME_WRITTEN_TOKENS, TOKEN_PREFIX } from './contract';
import { definedTokenNames } from './css';
import { darkChromeTheme, lightChromeTheme } from './themes';

/**
 * THE GATE THIS PACKAGE EXISTS FOR.
 *
 * Before it, twenty stylesheets read `var(--bldr-selection, #4f46e5)` and
 * nothing anywhere defined `--bldr-selection`. Every component was running on
 * its fallback, two files disagreed about what `--bldr-accent` fell back to,
 * and no amount of reading the code made that visible — the builder looked
 * fine, because a fallback looks exactly like a theme until you try to change
 * one.
 *
 * So the theme is not asserted to exist; it is CHECKED against the real usage.
 * This walks the workspace, extracts every `--bldr-…` any builder source reads,
 * and fails on the first one the contract does not carry. A component cannot
 * invent a token, and the contract cannot quietly lose one.
 */

const REPO = fileURLToPath(new URL('../../../..', import.meta.url));
const SEARCH_ROOTS = ['packages/builder', 'packages/ui', 'apps/playground'];
const SKIP_DIRS = new Set(['node_modules', 'coverage', 'dist', 'storybook-static', '.turbo']);
const SOURCE_EXTENSIONS = ['.css', '.ts', '.tsx'];
/** This package DEFINES the tokens; reading its own output proves nothing. */
const SKIP_PATH_PARTS = ['builder/theme/src'];

function sourceFiles(dir: string, found: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir, { encoding: 'utf8' });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    /*
      `statSync` FOLLOWS symlinks and throws on a dangling one, which took the
      whole suite down with an ENOENT naming a path this test never meant to
      read. `lstatSync` describes the link itself, so a broken link is simply
      not a directory and not a source file — skipped, like any other entry
      that is neither.
    */
    const stats = lstatSync(full);
    if (stats.isSymbolicLink()) {
      continue;
    }
    if (stats.isDirectory()) {
      sourceFiles(full, found);
    } else if (SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension))) {
      found.push(full);
    }
  }
  return found;
}

interface Usage {
  readonly token: string;
  readonly file: string;
}

function collectUsages(): Usage[] {
  const pattern = new RegExp(`${TOKEN_PREFIX}[a-z0-9-]+`, 'g');
  const usages: Usage[] = [];
  for (const root of SEARCH_ROOTS) {
    for (const file of sourceFiles(join(REPO, root))) {
      const relative = file.slice(REPO.length);
      if (SKIP_PATH_PARTS.some((part) => relative.includes(part))) {
        continue;
      }
      for (const match of readFileSync(file, 'utf8').matchAll(pattern)) {
        const [name] = match;
        usages.push({ token: name.slice(TOKEN_PREFIX.length), file: relative });
      }
    }
  }
  return usages;
}

const usages = collectUsages();
// Everything the stylesheet DEFINES — not merely what a theme may re-point.
const known = new Set<string>([...definedTokenNames(), ...RUNTIME_WRITTEN_TOKENS]);

describe('every token a component reads is a token the theme defines', () => {
  it('finds real usage, so an empty pass is impossible', () => {
    // Without this the suite would go green if the walker silently found
    // nothing — which is exactly the shape of the bug it is here to prevent.
    expect(usages.length).toBeGreaterThan(50);
    expect(new Set(usages.map((usage) => usage.file)).size).toBeGreaterThan(10);
  });

  it('defines every token used anywhere in the workspace', () => {
    const orphans = usages.filter((usage) => !known.has(usage.token));
    const report = orphans.map((usage) => `${usage.token} (${usage.file})`).sort();
    expect(report).toEqual([]);
  });

  it('carries no token nothing uses, except the ones a host is expected to re-point', () => {
    // A contract that only grows becomes a museum. Tokens with no consumer are
    // allowed ONLY when they are part of a complete, documented set a theme
    // author reaches for; everything else must earn its place.
    const used = new Set(usages.map((usage) => usage.token));
    const unusedButOffered = new Set([
      'surface-raised',
      'surface-sunken',
      'ground',
      'rail',
      'rail-raised',
      'rail-text',
      'rail-text-strong',
      'rail-border',
      'panel-text-soft',
      'panel-border-strong',
      'accent-strong',
      'accent-text',
      'accent-ring',
      'danger-soft',
      'danger-border',
      'warning',
      'warning-soft',
      'warning-border',
      'success',
      'success-soft',
      'success-border',
      'shadow-raised',
      'shadow-floating',
      'shadow-overlay',
      'focus-ring',
      'focus-ring-width',
      'focus-ring-offset',
      'font-mono',
      // A list ROW's surface, distinct from a CONTROL's: offered so a theme can
      // separate them, even while today's components paint rows on the panel.
      'panel-item',
    ]);
    const strays = CHROME_TOKENS.filter(
      (token) => !used.has(token) && !unusedButOffered.has(token),
    );
    expect(strays).toEqual([]);
  });
});

/**
 * DELEGATION IS A PROMISE, and this is the gate that collects on it.
 *
 * `data-bldr-focus-ring="delegated"` says "an ancestor draws my ring". Nothing
 * in CSS can check that the ancestor exists, so a component could delegate to
 * nobody and silently ship an unfocusable-looking control — the exact outcome
 * the product law forbids. Every delegating file must therefore also contain a
 * `:focus-within` rule that paints an outline.
 */
describe('every delegated focus ring is drawn by somebody', () => {
  const DELEGATION = 'data-bldr-focus-ring';
  const delegatingFiles = [
    ...new Set(
      SEARCH_ROOTS.flatMap((root) => sourceFiles(join(REPO, root)))
        .filter((file) => !SKIP_PATH_PARTS.some((part) => file.slice(REPO.length).includes(part)))
        .filter((file) => readFileSync(file, 'utf8').includes(DELEGATION))
        .map((file) => file.slice(REPO.length)),
    ),
  ];

  it('finds the delegations, so an empty pass is impossible', () => {
    // If this ever drops to zero the suite below would go green while proving
    // nothing — which is the shape of the bug the whole file guards against.
    expect(delegatingFiles.length).toBeGreaterThan(0);
  });

  it.each(delegatingFiles)('%s has a wrapper that paints the ring instead', (relative) => {
    /*
      The markup that delegates and the stylesheet that draws are different
      files, so the pair is checked per COMPONENT FOLDER rather than per file.
    */
    const folder = join(REPO, relative).slice(0, join(REPO, relative).lastIndexOf('/'));
    const siblings = sourceFiles(folder).map((file) => readFileSync(file, 'utf8'));
    // The playground keeps its chrome in one app-level sheet beside the folder.
    const appSheet = join(REPO, 'apps/playground/src/app/App.css');
    const pool = relative.includes('apps/playground')
      ? [...siblings, readFileSync(appSheet, 'utf8')]
      : siblings;

    const drawsRing = pool.some(
      (source) => source.includes(':focus-within') && /outline(-color)?\s*:/.test(source),
    );
    expect({ file: relative, drawsRing }).toEqual({ file: relative, drawsRing: true });
  });
});

describe('both themes answer the whole contract', () => {
  it.each([
    ['light', lightChromeTheme],
    ['dark', darkChromeTheme],
  ])('%s defines every token with a non-empty value', (_name, theme) => {
    for (const token of CHROME_TOKENS) {
      expect(theme[token]).toBeTruthy();
    }
    expect(Object.keys(theme).sort()).toEqual([...CHROME_TOKENS].sort());
  });

  it('gives light and dark GENUINELY different values, not one palette twice', () => {
    // A "dark theme" that shares most of its values with light is a light theme
    // with a dark background — the failure mode this catches.
    const differing = CHROME_TOKENS.filter(
      (token) => lightChromeTheme[token] !== darkChromeTheme[token],
    );
    expect(differing.length).toBeGreaterThan(CHROME_TOKENS.length * 0.7);
  });

  it('keeps the type stack identical across themes', () => {
    // Colour is a theme decision; the typeface is a product decision.
    expect(darkChromeTheme.font).toBe(lightChromeTheme.font);
    expect(darkChromeTheme['font-mono']).toBe(lightChromeTheme['font-mono']);
  });
});
