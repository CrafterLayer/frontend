import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AI_PLAN_WIRE_VERSION, UTILITY_VOCABULARY } from './wire';

/**
 * `@craftkit/builder/wire` exists so a headless Node service can reach the plan
 * contract without acquiring a browser.
 *
 * The main entry re-exports the editor surface and therefore `builder-shell`,
 * whose code calls `querySelector` on an `HTMLElement`; a service whose tsconfig
 * has no `lib: dom` cannot compile against it, and must not acquire one to
 * satisfy a package boundary. That is why `apps/ai-server` had grown direct
 * dependencies on two builder packages. This door removes the reason.
 *
 * The guard is on the CONTRACT rather than on a hand-walked import graph: the
 * door may only re-export from packages that are themselves browser-free, and
 * that is decided by their manifests, which cannot drift silently.
 */
const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, '../../../..');

/** Runtime dependencies that would drag a browser into a Node service. */
const BROWSER_RUNTIME = [
  'react',
  'react-dom',
  'react-router',
  '@craftkit/builder-shell',
  '@craftkit/builder-renderer',
  '@craftkit/builder-react',
];

function manifest(folder: string): { dependencies?: Record<string, string> } {
  return JSON.parse(
    readFileSync(join(REPO, 'packages/builder', folder, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
  };
}

describe('the headless wire door', () => {
  it('exports the contract a Node service actually imports', () => {
    expect(AI_PLAN_WIRE_VERSION).toBe(1);
    expect(UTILITY_VOCABULARY.length).toBeGreaterThan(0);
  });

  it('re-exports from browser-free packages only', () => {
    const source = readFileSync(join(REPO, 'packages/builder/editor/src/wire.ts'), 'utf8');
    const sources = [...new Set([...source.matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1] ?? ''))];

    // Only these two, so the guard below is exhaustive by construction.
    expect(sources.sort()).toEqual(['@craftkit/builder-ai', '@craftkit/builder-schema']);

    for (const folder of ['ai', 'schema']) {
      const deps = Object.keys(manifest(folder).dependencies ?? {});
      expect(
        deps.filter((name) => BROWSER_RUNTIME.includes(name)),
        folder,
      ).toEqual([]);
    }
  });

  it('does not re-export the editor surface, which is what makes the main entry unusable here', () => {
    const source = readFileSync(join(REPO, 'packages/builder/editor/src/wire.ts'), 'utf8');

    expect(source).not.toContain("from './index'");
    expect(source).not.toContain('builder-shell');
    expect(source).not.toContain('builder-renderer');
  });
});
