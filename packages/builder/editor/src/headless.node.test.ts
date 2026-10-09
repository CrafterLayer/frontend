import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  craftkitHeadlessBlocks,
  createBuilder,
  headlessBlockManifest,
  pageSchema,
} from './headless';

/**
 * `@craftkit/builder/headless` exists so a Node service can own a LIVE document
 * — kernel, registry, AI plan door — without acquiring a browser.
 *
 * `wire.node.test.ts` guards the same property for the types-and-data door, and
 * this file uses its technique deliberately rather than inventing a weaker one.
 * The guard is on the CONTRACT, not on a hand-walked import graph: an import
 * walk flags type-only React imports that are erased at compile time (the first
 * attempt at the wire guard did exactly that), while a manifest cannot drift
 * silently — a package acquires `react-dom` or `builder-shell` by editing its
 * own `dependencies`, and that edit is what this test reads.
 *
 * The failure being prevented is concrete and has happened: importing anything
 * whose graph reaches `packages/builder/shell` puts `querySelector` on an
 * `HTMLElement` into a program compiled with `lib: ["ES2024"]`, and the Node
 * service stops typechecking. Every block pack reaches it through
 * `@craftkit/builder-renderer`, which is why none of them may appear here.
 */
const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, '../../../..');
const DOOR = join(REPO, 'packages/builder/editor/src/headless.ts');

/**
 * Runtime dependencies that would drag a browser into a Node service. React DOM
 * and the shell are the two that actually break the build; the renderer and the
 * React bindings are listed because they are the ONLY paths by which a block
 * pack reaches them, so banning them keeps the check one level cheaper than a
 * transitive closure while catching the same thing.
 */
const BROWSER_RUNTIME = [
  'react-dom',
  'react-router',
  '@craftkit/builder-shell',
  '@craftkit/builder-renderer',
  '@craftkit/builder-react',
  '@craftkit/builder-code-view',
  '@craftkit/builder-motion',
  '@craftkit/builder-richtext',
];

/** Where a workspace package's manifest lives, given its published name. */
function manifestPath(name: string): string {
  const folder = name.replace('@craftkit/builder-', '');
  const under = join(REPO, 'packages/builder', folder, 'package.json');
  return under;
}

function dependencyNames(name: string): readonly string[] {
  const manifest = JSON.parse(readFileSync(manifestPath(name), 'utf8')) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ];
}

describe('the headless runtime door', () => {
  it('exports a kernel a Node service can actually build a document on', () => {
    const kernel = createBuilder({ extensions: [craftkitHeadlessBlocks] });

    expect(kernel.getDocument().rootId).toBe('root');
    expect(kernel.context.registry.block('page')?.schema.type).toBe('page');
    expect(kernel.validate()).toEqual([]);
  });

  it('registers block schemas without a renderer, because nothing is ever drawn here', () => {
    const manifest = headlessBlockManifest('probe', '1.0.0', [pageSchema]);
    const contributed = manifest.contributes?.blocks ?? [];

    expect(contributed).toHaveLength(1);
    /*
      The placeholder must be a real component the registry accepts, and it must
      draw NOTHING: a headless host has no DOM to draw into, so a placeholder
      that returned an element would only ever be a way to smuggle one in.
      `BlockRenderComponent` also admits a class component, which is not
      callable — the assertion narrows to the function form the door actually
      supplies rather than pretending the union does not exist.
    */
    const render = contributed[0]?.render as ((props: never) => unknown) | undefined;
    expect(render?.({} as never)).toBeNull();
  });

  it('re-exports from browser-free packages only', () => {
    const source = readFileSync(DOOR, 'utf8');
    const imported = [
      ...new Set([...source.matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1] ?? '')),
    ];
    const external = imported.filter((specifier) => !specifier.startsWith('.'));

    /*
      One specifier is judged by a different rule, and deliberately so.

      This test asks a package's MANIFEST whether it drags in a browser, which
      is the right question for a package with one entry point and the wrong
      one for a package with two. `@craftkit/builder-blocks-marketing` depends
      on the renderer honestly — its main entry pairs every schema with the
      component that draws it — while its `/schemas` entry carries the schemas
      alone. The manifest cannot express that difference, so the subpath proves
      itself where it lives: `blocks-marketing/src/schemas.node.test.ts` walks
      the barrel's real import graph and pins its entire external surface to
      `@craftkit/builder-schema` and `zod`.

      The exception is therefore a POINTER to a stronger proof, not a hole. It
      is written as an exact specifier so that importing the pack's main entry
      here — `@craftkit/builder-blocks-marketing` with no subpath — still fails.
    */
    const GRAPH_PROVEN_SUBPATHS = ['@craftkit/builder-blocks-marketing/schemas'];
    // script-servers additions (2026-10-08)
    /*
      A subpath of a package this door already re-exports is judged by THAT
      package's manifest: an entry cannot depend on anything its package does
      not declare. builder-ai's `script-node` (the worker_threads script
      runner, Node-only by design) is the one in use; the assertion keeps the
      exemption from ever covering a package the loop below does not check.
    */
    const SAME_MANIFEST_SUBPATHS = ['@craftkit/builder-ai/script-node'];
    for (const subpath of SAME_MANIFEST_SUBPATHS.filter((s) => external.includes(s))) {
      expect(external, subpath).toContain(subpath.split('/').slice(0, 2).join('/'));
    }
    GRAPH_PROVEN_SUBPATHS.push(...SAME_MANIFEST_SUBPATHS);
    // end script-servers additions
    const byManifest = external.filter((specifier) => !GRAPH_PROVEN_SUBPATHS.includes(specifier));

    // Exhaustive by construction: the loop below only has to know these three.
    expect(byManifest.sort()).toEqual([
      '@craftkit/builder-ai',
      '@craftkit/builder-core',
      '@craftkit/builder-schema',
    ]);

    for (const name of byManifest) {
      expect(
        dependencyNames(name).filter((dependency) => BROWSER_RUNTIME.includes(dependency)),
        name,
      ).toEqual([]);
    }
  });

  it('reaches only PURE modules of its own package', () => {
    const source = readFileSync(DOOR, 'utf8');
    const relative = [...source.matchAll(/from\s+'(\.[^']+)'/gu)].map((match) => match[1] ?? '');

    expect(relative.length).toBeGreaterThan(0);
    for (const specifier of relative) {
      // A local re-export is only safe if the file it names is browser-free
      // too, and the cheapest proof of that is the file itself: a `.tsx` is a
      // component by definition, and a module that pulls one in inherits it.
      expect(specifier.endsWith('.tsx'), specifier).toBe(false);
      const local = readFileSync(
        join(REPO, 'packages/builder/editor/src', `${specifier}.ts`),
        'utf8',
      );
      expect(local, specifier).not.toMatch(/from\s+'react/u);
      expect(local, specifier).not.toMatch(/from\s+'\.\/[A-Z]/u);
    }
  });

  it('does not re-export the editor surface, which is what makes the main entry unusable here', () => {
    /*
      Matched against the IMPORT SPECIFIERS rather than the raw text: the file's
      own comment has to be free to explain why `builder-renderer` is banned,
      and a substring check over the source would then fail on the explanation
      instead of on a real re-export — a guard that punishes documentation is a
      guard people delete.
    */
    const specifiers = new Set(
      [...readFileSync(DOOR, 'utf8').matchAll(/from\s+'([^']+)'/gu)].map((match) => match[1] ?? ''),
    );

    // The editor surface itself, then every block pack by name: each is one
    // careless line away from being re-exported, and each drags the renderer,
    // react-dom and the shell in behind it.
    for (const banned of [
      './index',
      '@craftkit/builder-shell',
      '@craftkit/builder-renderer',
      '@craftkit/builder-react',
      '@craftkit/builder-blocks-marketing',
      '@craftkit/builder-primitives',
      '@craftkit/builder-shadcn',
      '@craftkit/builder-aceternity',
      '@craftkit/builder-magicui',
      '@craftkit/builder-custom-code',
      '@craftkit/builder-code-view',
      '@craftkit/builder-richtext',
      '@craftkit/builder-motion',
      'react',
      'react-dom',
    ]) {
      expect(specifiers.has(banned), banned).toBe(false);
    }
  });

  it('is reachable as a package door, so an app never imports past the preset', () => {
    const manifest = JSON.parse(
      readFileSync(join(REPO, 'packages/builder/editor/package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> };

    expect(manifest.exports['./headless']).toBe('./src/headless.ts');
  });
});
