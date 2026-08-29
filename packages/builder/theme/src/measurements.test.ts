import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * EVERY measurement comes from the theme.
 *
 * The sibling gate (`coverage.test.ts`) proves that every token a component
 * READS is one the theme defines. This is the other half, and the one a person
 * actually feels: that a component does not measure anything on its own. A
 * `0.5rem` radius or a `28px` control cannot be re-pointed by a host, so a
 * single literal is a hole in the promise that the whole editor can be
 * re-themed at runtime — and holes of exactly this kind were found in the
 * floating chrome, where the bubble's hit targets were `1.75rem` and therefore
 * decided by the root font size of a document the editor does not control.
 *
 * Two exemptions, both structural rather than convenient:
 *
 *  - `0` needs no token; a token for nothing is noise.
 *  - MEDIA QUERY CONDITIONS. A media query cannot read a custom property — the
 *    cascade has not run when the condition is evaluated — so a breakpoint
 *    physically cannot be a token. They are the one place a raw length is
 *    forced, and they are checked to be few and named in a comment instead.
 *
 * The generated stylesheet is excluded because it is where the values live.
 */

const BUILDER_ROOT = join(process.cwd(), '..');

/**
 * The EDITOR's chrome. Deliberately not the whole workspace.
 *
 * A block's stylesheet paints the PAGE, and the page carries its own theme
 * (`--t-*`) precisely so that an author working on a dark site is not forced
 * into a dark editor and a dark editor never repaints their light page. Making
 * block styles read `--bldr-*` would collapse that separation, so those files
 * are a separate unification with a separate token set — recorded as such, not
 * quietly folded in here.
 */
const CHROME_ROOTS = [
  join(BUILDER_ROOT, 'shell', 'src'),
  join(BUILDER_ROOT, 'editor', 'src'),
  join(BUILDER_ROOT, 'extensions', 'code-view', 'src'),
];
const PAGE_STYLESHEET_ROOT = join(BUILDER_ROOT, 'editor', 'src', 'components', 'Page');

/** `src/css/chrome.css` IS the token file — the literals belong to it. */
const GENERATED = join('theme', 'src', 'css', 'chrome.css');

function stylesheets(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      // `coverage/` holds generated HTML reports, not source.
      if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') {
        continue;
      }
      const full = join(dir, entry);
      // The preset's Page component renders document content and has its own
      // `--t-*` vocabulary gate; it is not editor chrome.
      if (full === PAGE_STYLESHEET_ROOT) {
        continue;
      }
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.css') && !full.includes(GENERATED)) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found;
}

/** Declarations only: the media-query condition is a different question. */
function declarationsOf(css: string): string {
  return css
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('@media'))
    .join('\n');
}

const RAW_LENGTH = /(?<![\w-])(\d+(?:\.\d+)?)(px|rem)(?![\w-])/g;

function rawMeasurements(file: string): string[] {
  const declarations = declarationsOf(readFileSync(file, 'utf8'));
  return [...declarations.matchAll(RAW_LENGTH)]
    .map((match) => match[0])
    .filter((measurement) => !measurement.startsWith('0'));
}

describe('every measurement in the builder comes from the theme', () => {
  const files = CHROME_ROOTS.flatMap((root) => stylesheets(root));

  it('finds the stylesheets it is meant to police', () => {
    // Non-vacuous: a broken walk would pass this whole suite in silence.
    expect(files.length).toBeGreaterThan(15);
    expect(files.some((file) => file.includes('shell'))).toBe(true);
  });

  it('declares no raw px or rem outside the generated token sheet', () => {
    const offenders = files
      .map((file) => ({ file: file.replace(BUILDER_ROOT, ''), found: rawMeasurements(file) }))
      .filter((entry) => entry.found.length > 0)
      .map((entry) => `${entry.file}: ${entry.found.join(', ')}`);

    expect(offenders).toEqual([]);
  });
});
