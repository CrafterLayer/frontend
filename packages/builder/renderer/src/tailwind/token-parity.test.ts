/*
  @vitest-environment node

  Reads the checked-in theme file from disk and touches no DOM (see
  token-bridge.test.ts for why the node environment is needed).
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TOKEN_UTILITY_NAMES } from '@craftkit/builder-schema';
import { describe, expect, it } from 'vitest';

import { TAILWIND_NAMESPACE } from './token-bridge';

/**
 * Token parity (style-manager DESIGN.md §A.2): the style engine in the schema
 * package names theme-token utilities (`bg-accent`, `rounded-lg`,
 * `shadow-soft`) without importing the renderer. These laws hold its list
 * equal to what the token bridge actually generates, in both directions.
 */

const CHECKED_IN_CSS = fileURLToPath(new URL('./tailwind-theme.css', import.meta.url));

type Names = Record<string, string[]>;

function sorted(names: Names): Names {
  return Object.fromEntries(
    Object.entries(names)
      .map(([namespace, list]) => [namespace, [...list].sort()] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function bridgeNames(): Names {
  const names: Names = {};
  for (const binding of Object.values(TAILWIND_NAMESPACE)) {
    if (binding.namespace === 'raw') continue;
    (names[binding.namespace] ??= []).push(binding.suffix);
  }
  return sorted(names);
}

function engineNames(): Names {
  return sorted(
    Object.fromEntries(
      Object.entries(TOKEN_UTILITY_NAMES).map(([namespace, list]) => [namespace, [...list]]),
    ),
  );
}

/** `--<namespace>-<suffix>:` declarations of the generated theme file. */
function cssNames(): Names {
  const css = readFileSync(CHECKED_IN_CSS, 'utf8');
  /* `font-weight` before `font`, or `--font-weight-bold` reads as font `weight-bold`. */
  const declaration =
    /--(font-weight|color|spacing|radius|shadow|font|text|leading|tracking|container)-([a-z0-9-]+):/gu;
  const names: Names = {};
  for (const match of css.matchAll(declaration)) {
    const [, namespace = '', suffix = ''] = match;
    (names[namespace] ??= []).push(suffix);
  }
  return sorted(names);
}

describe('theme-token utility names (schema) ⇄ token bridge (renderer)', () => {
  it('names every token utility the bridge generates, and nothing else', () => {
    expect(engineNames()).toEqual(bridgeNames());
  });

  it('names every token utility the checked-in theme file declares, and nothing else', () => {
    expect(engineNames()).toEqual(cssNames());
  });

  it('has no duplicate names inside a namespace', () => {
    for (const list of Object.values(TOKEN_UTILITY_NAMES)) {
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
