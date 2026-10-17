import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * SC-002 (008 contract §3 e6): the editing engine exists in THIS package only.
 * The declaration half is gated mechanically by the workspace validator; this
 * is the IMPORT half — a package could import the engine without declaring it.
 *
 * The walk is DISCOVERED, not listed (§10 review fix): every workspace member
 * except the owner is scanned, so a package added later is covered the day it
 * appears rather than the day someone remembers to extend an array.
 */
const OWNER = 'packages/builder/extensions/richtext';
const MEMBER_ROOTS = ['apps', 'packages', 'packages/builder', 'packages/builder/extensions'];
/**
 * Match what actually LEAKS, not what merely mentions: an import specifier
 * (static, dynamic, or require) resolving to the engine, and — for stylesheets
 * — the engine's own class, which is how a "harmless" style copy smuggles a
 * dependency in. Prose in comments and docs is not a leak.
 */
const ENGINE_IMPORT =
  /(?:from|import|require)\s*\(?\s*['"]((?:@tiptap\/|prosemirror-)[^'"]*)['"]/gi;
const ENGINE_STYLE = /\.prosemirror\b/i;
const SOURCE_FILE = /\.(ts|tsx|css|mdx)$/;

const repoRoot = resolve(import.meta.dirname, '../../../../..');

function directoriesIn(relativeRoot: string): string[] {
  const base = join(repoRoot, relativeRoot);
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(base, entry.name));
  } catch {
    return [];
  }
}

/** Every member's `src` directory except the engine owner's. */
function memberSourceRoots(): string[] {
  const roots: string[] = [];
  for (const memberRoot of MEMBER_ROOTS) {
    for (const memberPath of directoriesIn(memberRoot)) {
      const relativePath = relative(repoRoot, memberPath).replaceAll('\\', '/');
      if (relativePath === OWNER) {
        continue;
      }
      const source = join(memberPath, 'src');
      try {
        if (statSync(source).isDirectory()) {
          roots.push(source);
        }
      } catch {
        // Directories that are not packages (or have no src) are simply skipped.
      }
    }
  }
  return roots;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'coverage') {
        continue;
      }
      yield* walk(full);
    } else if (SOURCE_FILE.test(entry.name)) {
      yield full;
    }
  }
}

describe('containment import graph (SC-002)', () => {
  it('discovers every member and finds no engine reference outside the owner', () => {
    const roots = memberSourceRoots();
    // The walk must be non-trivial: an empty discovery would pass vacuously.
    expect(roots.length).toBeGreaterThanOrEqual(10);
    expect(roots.some((root) => root.includes('/builder/renderer/'))).toBe(true);
    expect(roots.some((root) => root.includes('/builder/shell/'))).toBe(true);
    expect(roots.some((root) => root.includes('/apps/playground/'))).toBe(true);

    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(ENGINE_IMPORT)) {
          offenders.push(`${relative(repoRoot, file)} → imports ${match[1] ?? ''}`);
        }
        // A stylesheet carrying the engine's own class is a smuggled dependency.
        if (file.endsWith('.css') && ENGINE_STYLE.test(source)) {
          offenders.push(`${relative(repoRoot, file)} → styles .ProseMirror`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
