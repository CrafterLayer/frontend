import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * media-motion (2026-10-06): the canvas scene engine (PixiJS) exists in THIS
 * package only.
 *
 * The DECLARATION half is gated by the workspace validator
 * (`CONTAINED_DEPENDENCIES`, "canvas scene engine"): a manifest naming
 * `pixi.js` or `@pixi/*` anywhere else fails `check:workspace`, including
 * through an npm alias. This is the IMPORT half, which the validator cannot
 * see: a package could import Pixi without declaring it and resolve it from
 * the hoisted store.
 *
 * Pixi reaches published pages ONLY as the prebuilt string in
 * `packages/builder/renderer/src/engines/scene-source.ts`, emitted as
 * `assets/ck-scene.js` on pages carrying `data-ck-scene`. That generated file
 * CONTAINS the bundle, and so mentions Pixi everywhere — but it imports
 * nothing, so the import matcher below never fires on it.
 *
 * The walk is discovered, following the motion precedent, so a package added
 * next month is covered the day it appears.
 */
const OWNER = 'packages/builder/extensions/media-engines';
const MEMBER_ROOTS = ['apps', 'packages', 'packages/builder', 'packages/builder/extensions'];

const ENGINE_IMPORT =
  /(?:from|import|require)\s*\(?\s*['"]((?:pixi\.js|@pixi\/[^'"/]+)(?:\/[^'"]*)?)['"]/g;
const SOURCE_FILE = /\.(ts|tsx|mts|mjs|js|jsx|mdx)$/;

const repoRoot = resolve(import.meta.dirname, '../../../../..');

/**
 * The generated bundle string. Pixi's own error messages inside it quote
 * import lines (e.g. "import 'pixi.js/advanced-blend-modes'"), so the matcher
 * would fire on string contents. It is exempted by exact path and checked
 * instead for what matters: no real import statement at all.
 */
const GENERATED_BUNDLE = 'packages/builder/renderer/src/engines/scene-source.ts';
/** The FULL pixi.js bundle for region scripts (free-code mode, 2026-10-09): same rules, same reason. */
const GENERATED_FULL_BUNDLE = 'packages/builder/renderer/src/engines/pixi-full-source.ts';
const GENERATED_BUNDLES = [GENERATED_BUNDLE, GENERATED_FULL_BUNDLE];

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
        // Not a package, or no src: skipped.
      }
    }
  }
  return roots;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'coverage' || entry.name === 'dist') {
        continue;
      }
      yield* walk(full);
    } else if (SOURCE_FILE.test(entry.name)) {
      yield full;
    }
  }
}

function importsIn(file: string): string[] {
  if (GENERATED_BUNDLES.includes(relative(repoRoot, file).replaceAll('\\', '/'))) {
    return [];
  }
  const found: string[] = [];
  for (const match of readFileSync(file, 'utf8').matchAll(ENGINE_IMPORT)) {
    found.push(match[1] ?? '');
  }
  return found;
}

describe('canvas scene engine containment (media-motion)', () => {
  it('the matcher fires on real import forms and not on prose', () => {
    const sample = [
      "import { Application } from 'pixi.js';",
      "const pixi = await import('pixi.js');",
      "import '@pixi/react';",
      "require('pixi.js/unsafe-eval')",
      '// Pixi (pixi.js) is contained in media-engines',
    ].join('\n');
    const matches = [...sample.matchAll(ENGINE_IMPORT)].map((match) => match[1]);
    expect(matches).toEqual(['pixi.js', 'pixi.js', '@pixi/react', 'pixi.js/unsafe-eval']);
  });

  it('discovers every member and finds no Pixi import outside the owner', () => {
    const roots = memberSourceRoots();

    expect(roots.length).toBeGreaterThanOrEqual(10);
    expect(roots.some((root) => root.includes('/builder/renderer/'))).toBe(true);
    expect(roots.some((root) => root.includes('/builder/shell/'))).toBe(true);
    expect(roots.some((root) => root.includes('/apps/playground/'))).toBe(true);

    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        for (const specifier of importsIn(file)) {
          offenders.push(`${relative(repoRoot, file)} → imports ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  }, 30_000);

  it('keeps the renderer free of Pixi: it carries only the generated string', () => {
    const rendererSource = join(repoRoot, 'packages/builder/renderer/src');
    const offenders: string[] = [];
    for (const file of walk(rendererSource)) {
      if (importsIn(file).length > 0) {
        offenders.push(relative(repoRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  }, 30_000);

  it.each(GENERATED_BUNDLES)('the generated bundle module %s imports nothing at all', (path) => {
    const generated = readFileSync(join(repoRoot, path), 'utf8');
    expect(generated).toContain('GENERATED FILE');
    expect(generated).not.toMatch(
      /^\s*(?:import|export\s+\*\s+from|export\s+\{[^}]*\}\s+from)\s/mu,
    );
  });

  it('declares Pixi from the catalog and nothing else from the Pixi family', () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot, OWNER, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(manifest.dependencies?.['pixi.js']).toBe('catalog:');
    expect(
      Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith('@pixi/')),
    ).toEqual([]);
  });
});
