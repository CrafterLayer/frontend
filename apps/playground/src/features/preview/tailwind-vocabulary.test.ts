import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { utilitySourceDirectives } from '@craftkit/builder';

/**
 * The drift gate.
 *
 * Two things must agree about which utility classes exist: the Tailwind entry,
 * which causes the CSS to be GENERATED, and `UTILITY_VOCABULARY`, which the AI
 * door validates proposals AGAINST. They are the same list expressed twice —
 * once as CSS the bundler reads, once as data TypeScript can import.
 *
 * If they drift, the failure is silent and expensive in both directions:
 *
 *   - a class in the door but not the CSS ⇒ the door accepts a proposal whose
 *     page renders unstyled, and nothing reports it;
 *   - a class in the CSS but not the door ⇒ the door rejects a proposal that
 *     would have worked perfectly.
 *
 * So the CSS block is generated, and this test fails if it stops matching.
 */
/*
  Resolved from the vitest root rather than `import.meta.url`: this suite runs
  under the jsdom environment, where the module URL is not a `file:` URL and
  `fileURLToPath` throws.
*/
const TAILWIND_CSS = resolve(process.cwd(), 'src/tailwind.css');
const START = '/* AI-VOCABULARY:START';
const END = '/* AI-VOCABULARY:END */';

function generatedBlock(): string {
  const css = readFileSync(TAILWIND_CSS, 'utf8');
  const start = css.indexOf(START);
  const end = css.indexOf(END);
  expect(start, 'the generated vocabulary block is missing its START marker').toBeGreaterThan(-1);
  expect(end, 'the generated vocabulary block is missing its END marker').toBeGreaterThan(start);
  return css
    .slice(css.indexOf('\n', start) + 1, end)
    .trim();
}

describe('AI styling vocabulary', () => {
  it('matches the source of truth the AI door validates against', () => {
    expect(generatedBlock()).toBe(utilitySourceDirectives());
  });

  it('still declares the directives the block claims to hold', () => {
    const lines = generatedBlock().split('\n');

    expect(lines.length).toBeGreaterThan(40);
    for (const line of lines) {
      expect(line).toMatch(/^@source inline\(".+"\);$/u);
    }
  });
});
