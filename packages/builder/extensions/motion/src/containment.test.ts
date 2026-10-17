import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * FR-063: the animation engine exists in THIS package only.
 *
 * The DECLARATION half is gated mechanically by the workspace validator — a
 * manifest naming `motion` anywhere else fails `check:workspace`, including
 * through an npm alias. This is the IMPORT half, which the validator cannot
 * see: a package could import the engine without declaring it and resolve it
 * from the hoisted root `node_modules`.
 *
 * The walk is DISCOVERED rather than listed, following the rich-text
 * precedent: every workspace member except the owner is scanned, so a package
 * added next month is covered the day it appears rather than the day someone
 * remembers to extend an array.
 *
 * What this protects is concrete. Motion is CSS by default — reveals and scroll
 * effects run on an `animation-timeline: view()` with no JavaScript — and the
 * engine exists only for pinning and stagger indices. One "just for this
 * section" import in the renderer, and every published page starts paying for
 * an engine it does not need.
 */
const OWNER = 'packages/builder/extensions/motion';
const MEMBER_ROOTS = ['apps', 'packages', 'packages/builder', 'packages/builder/extensions'];

/**
 * Match what actually LEAKS, not what merely mentions. An import specifier —
 * static, dynamic, or require — resolving to the engine is a leak. Prose in a
 * comment or a doc page explaining why the engine is contained is not, and this
 * file and its neighbours are full of exactly that prose.
 */
const ENGINE_IMPORT =
  /(?:from|import|require)\s*\(?\s*['"]((?:motion|framer-motion)(?:\/[^'"]*)?)['"]/gi;
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

describe('animation engine containment (FR-063)', () => {
  it('discovers every member and finds no engine import outside the owner', () => {
    const roots = memberSourceRoots();

    /*
      A vacuous walk would pass while proving nothing, so the discovery is
      asserted before it is used. The renderer and the playground are named
      explicitly because they are the two most likely places for the engine to
      leak into: one owns the read path, the other is where a demo gets built
      in a hurry.
    */
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
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
    The read path is the reason the rule exists, so it is checked directly as
    well as by the sweep above. If this ever fails, a published page has begun
    downloading an animation engine to render motion that CSS was already doing.
  */
  it('keeps the renderer — the read and publish path — free of the engine', () => {
    const rendererSource = join(repoRoot, 'packages/builder/renderer/src');
    const offenders: string[] = [];

    for (const file of walk(rendererSource)) {
      if (ENGINE_IMPORT.test(readFileSync(file, 'utf8'))) {
        offenders.push(relative(repoRoot, file));
      }
      ENGINE_IMPORT.lastIndex = 0;
    }

    expect(offenders).toEqual([]);
  });
});
