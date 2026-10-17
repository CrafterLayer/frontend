import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { blocksMarketing } from './index';
import { marketingBlockSchemas } from './schemas';

/**
 * `./schemas` is the pack's Node door: the block vocabulary with no renderer.
 *
 * It exists so a service without a DOM — an MCP server, an eval harness, a
 * migration — can validate documents against the REAL catalog instead of a
 * six-block test fixture. That is only true while the barrel stays free of
 * React, so this file proves it rather than asserting it.
 *
 * ## Why this guard walks the graph, when the other doors read manifests
 *
 * `wire.node.test.ts` and `headless.node.test.ts` guard their doors by reading
 * the MANIFESTS of the packages they re-export from, because a manifest cannot
 * drift silently and a naive import walk trips over type-only imports that are
 * erased at compile time. That technique cannot decide this question: this
 * pack's own manifest legitimately depends on `@craftkit/builder-renderer`,
 * since `./index.ts` pairs every schema with a component. The manifest is the
 * wrong granularity — the question is about ONE subpath inside the package.
 *
 * So the walk is the right instrument here, with the known trap handled
 * explicitly: `import type` statements are stripped before any specifier is
 * read, because a type is not a runtime edge and flagging one was exactly the
 * false positive that made the manifest technique attractive elsewhere.
 */
const HERE = dirname(new URL(import.meta.url).pathname);
const ENTRY = join(HERE, 'schemas.ts');

/**
 * Modules that put a browser in the program. `react` is included even though it
 * is not itself a DOM library: a value import of it means a component came
 * along, and a component is the thing this door exists to leave behind.
 */
const BROWSER_MODULES = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@craftkit/builder-renderer',
  '@craftkit/builder-react',
  '@craftkit/builder-shell',
];

/**
 * Every import specifier a module pulls in AT RUNTIME.
 *
 * `import type { X } from 'y'` and the inline `type` marker inside a named
 * clause are both erased by the compiler, so neither is an edge. Everything
 * else — a default import, a namespace import, a side-effect `import 'y'`, a
 * re-export — is.
 */
function runtimeImports(source: string): readonly string[] {
  const withoutTypeOnly = source.replace(/^\s*(?:import|export)\s+type\s[^;]*;/gm, '');
  const specifiers: string[] = [];
  const pattern =
    /(?:^|\s)(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|(?:^|\s)import\s*['"]([^'"]+)['"]/gm;
  for (const match of withoutTypeOnly.matchAll(pattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

/** Resolve a relative specifier the way the bundler does: extensionless, maybe a folder. */
function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

interface Walk {
  readonly visited: ReadonlySet<string>;
  readonly external: ReadonlySet<string>;
}

function walk(entry: string): Walk {
  const visited = new Set<string>();
  const external = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);
    for (const specifier of runtimeImports(readFileSync(file, 'utf8'))) {
      if (!specifier.startsWith('.')) {
        external.add(specifier);
        continue;
      }
      const next = resolveRelative(file, specifier);
      /*
        An unresolvable relative import would silently shrink the walk and turn
        this guard into decoration, so it is surfaced as a bad edge rather than
        skipped.
      */
      if (next === undefined) external.add(`UNRESOLVED:${specifier} from ${file}`);
      else queue.push(next);
    }
  }
  return { visited, external };
}

describe('the schema-only door', () => {
  it('reaches no browser module at runtime', () => {
    const { external } = walk(ENTRY);
    const offenders = [...external].filter((specifier) =>
      BROWSER_MODULES.some(
        (browser) => specifier === browser || specifier.startsWith(`${browser}/`),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('resolves every relative import it walks', () => {
    const { external } = walk(ENTRY);
    expect([...external].filter((specifier) => specifier.startsWith('UNRESOLVED:'))).toEqual([]);
  });

  it('imports only zod and the schema package from outside itself', () => {
    const { external } = walk(ENTRY);
    /*
      Pinning the WHOLE external set, not just the absence of React, is what
      makes this test notice a new dependency the day it is added rather than
      the day it breaks a Node host. Widening the door is then a deliberate
      edit to this line.
    */
    expect([...external].sort()).toEqual(['@craftkit/builder-schema', 'zod']);
  });

  it('carries exactly the blocks the pack registers, in the same order', () => {
    /*
      The barrel and the manifest are two hand-maintained lists of the same
      thing. A schema added to one and forgotten in the other would give a Node
      service a catalog the editor does not have, and every plan written against
      it would be rejected on arrival with no clue why.
    */
    const registered = (blocksMarketing.contributes?.blocks ?? []).map(({ schema }) => schema.type);
    expect(marketingBlockSchemas.map((schema) => schema.type)).toEqual(registered);
  });

  it('walks more than a handful of files, so the guard is not vacuous', () => {
    expect(walk(ENTRY).visited.size).toBeGreaterThan(30);
  });
});
