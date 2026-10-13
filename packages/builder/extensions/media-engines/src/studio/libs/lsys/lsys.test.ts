import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createRandom } from '../../kit/random';
import { createLsysLibrary, LSYS_VERSION } from '../lsys-entry';

const L = createLsysLibrary();

/* A scene stand-in: only the seeded random is read. */
function scene(seed: number | string = 7) {
  const random = createRandom(seed);
  return { random: () => random.random() };
}

/* A Graphics stand-in that records its path and stroke calls. */
function recorder() {
  const calls: [string, unknown][] = [];
  return {
    calls,
    moveTo: (x: number, y: number) => calls.push(['moveTo', [x, y]]),
    lineTo: (x: number, y: number) => calls.push(['lineTo', [x, y]]),
    stroke: (style: unknown) => calls.push(['stroke', style]),
  };
}

function finiteAll(values: Float32Array): boolean {
  return values.every((value) => Number.isFinite(value));
}

describe('lsys library', () => {
  it('is frozen, plain, and names the lindenmayer it bundles, read from its manifest', () => {
    expect(Object.isFrozen(L)).toBe(true);
    expect(Object.isFrozen(L.presets.fern.rules)).toBe(true);
    expect(L.version).toBe(LSYS_VERSION);
    expect(L.names).toEqual([
      'fern',
      'tree',
      'bush',
      'vine',
      'arabesque',
      'koch',
      'dragon',
      'hilbert',
    ]);
    const manifest = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../../node_modules/lindenmayer/package.json'),
        'utf8',
      ),
    ) as { version: string; license: string };
    expect(manifest).toMatchObject({ version: '1.5.4', license: 'MIT' });
  });

  it.each(['fern', 'tree', 'bush', 'vine', 'arabesque', 'koch', 'dragon', 'hilbert'] as const)(
    'grows the %s preset into finite segments, depths, tips and bounds',
    (name) => {
      const grown = L.grow(scene(), { preset: name });
      expect(grown.count).toBeGreaterThan(20);
      expect(grown.count).toBeLessThanOrEqual(L.limits.maxSegments);
      expect(grown.segments).toHaveLength(grown.count * 4);
      expect(grown.depths).toHaveLength(grown.count);
      expect(grown.dists).toHaveLength(grown.count);
      expect(finiteAll(grown.segments)).toBe(true);
      expect(grown.iterations).toBe(L.presets[name].iterations);
      expect(grown.bounds.width + grown.bounds.height).toBeGreaterThan(0);
      expect(grown.length).toBeGreaterThan(0);
    },
  );

  it('counts the classic curves exactly: Koch 3·4ⁿ, Hilbert 4ⁿ − 1, dragon 2ⁿ', () => {
    expect(L.grow({ preset: 'koch', iterations: 3 }).count).toBe(3 * 4 ** 3);
    expect(L.grow({ preset: 'hilbert', iterations: 4 }).count).toBe(4 ** 4 - 1);
    expect(L.grow({ preset: 'dragon', iterations: 8 }).count).toBe(2 ** 8);
    // A plant reads its trunk at depth 0 and deeper branches after it.
    const fern = L.grow({ preset: 'fern', iterations: 3 });
    expect(fern.depths[0]).toBe(0);
    expect(fern.maxDepth).toBeGreaterThan(1);
    expect(fern.tips.length / 2).toBeGreaterThan(5);
  });

  it('chooses stochastic successors from its seed, never Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const a = L.grow(scene(1), { preset: 'tree', seed: 42 });
    const b = L.grow(scene(2), { preset: 'tree', seed: 42 });
    const c = L.grow({ preset: 'tree', seed: 43 });
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    expect(Array.from(a.segments)).toEqual(Array.from(b.segments));
    expect(Array.from(a.segments)).not.toEqual(Array.from(c.segments));
    // Without a seed, one draw from the scene's s.random decides: same scene seed, same plant.
    expect(Array.from(L.grow(scene(9), { preset: 'tree' }).segments)).toEqual(
      Array.from(L.grow(scene(9), { preset: 'tree' }).segments),
    );
    // Weighted choices: a zero weight never wins.
    const only = L.grow({
      axiom: 'X',
      rules: {
        X: [
          { to: 'F[+F]X', p: 0 },
          { to: 'FFX', p: 1 },
        ],
      },
      iterations: 4,
    });
    expect(only.maxDepth).toBe(0);
    expect(only.count).toBe(8);
  });

  it('takes context-sensitive rules through lindenmayer', () => {
    // B becomes C only right of an A: ABBB → AC BB → …
    const grown = L.grow({ axiom: 'ABBB', rules: { 'A<B': 'F' }, iterations: 1, draw: 'F' });
    expect(grown.count).toBe(1);
  });

  it('stops rewriting before the string passes its limit, and clamps iterations', () => {
    const runaway = L.grow({ axiom: 'F', rules: { F: 'FFFFFFFF' }, iterations: 12 });
    expect(runaway.symbols).toBeLessThanOrEqual(L.limits.maxSymbols);
    expect(runaway.iterations).toBeLessThan(12);
    expect(runaway.count).toBeLessThanOrEqual(L.limits.maxSegments);
    expect(L.grow({ preset: 'koch', iterations: 99 }).iterations).toBeLessThanOrEqual(
      L.limits.maxIterations,
    );
  });

  it('grows nothing from bad input instead of throwing', () => {
    for (const bad of [
      { axiom: '' },
      { axiom: 'F'.repeat(10_000) },
      { axiom: 'F', rules: null },
      { axiom: 'F', rules: { F: 42 } },
      { axiom: 'F', iterations: Number.NaN, angle: 'x' },
      { axiom: 'F', rules: { '': 'F', '[': 'FF', FF: 'F' } },
    ]) {
      const grown = L.grow(bad);
      expect(finiteAll(grown.segments)).toBe(true);
      expect(grown.count).toBeLessThanOrEqual(1);
    }
    expect(L.grow(null).count).toBeGreaterThan(0); // the default tree
    expect(L.fit(null, { width: 10, height: 10 }).count).toBe(0);
    expect(L.upTo('nope', 0.5).count).toBe(0);
  });

  it('mirrors about its start when asked (dir: -1, from s.dir)', () => {
    const ltr = L.grow({ preset: 'vine', seed: 3, x: 200 });
    const rtl = L.grow({ preset: 'vine', seed: 3, x: 200, dir: -1 });
    expect(ltr.bounds.x).toBeCloseTo(200, 3);
    expect(rtl.bounds.x + rtl.bounds.width).toBeCloseTo(200, 3);
    for (let i = 0; i < ltr.segments.length; i += 2) {
      expect(rtl.segments[i]).toBeCloseTo(400 - (ltr.segments[i] ?? 0), 2);
      expect(rtl.segments[i + 1]).toBeCloseTo(ltr.segments[i + 1] ?? 0, 4);
    }
  });

  it('fits a grown system into a box, aligned, keeping its proportions', () => {
    const fern = L.grow({ preset: 'fern', seed: 1 });
    const box = { x: 100, y: 50, width: 400, height: 600 };
    const fitted = L.fit(fern, box, { align: 'bottom', pad: 10 });
    expect(fitted.bounds.x).toBeGreaterThanOrEqual(110 - 1e-3);
    expect(fitted.bounds.x + fitted.bounds.width).toBeLessThanOrEqual(490 + 1e-3);
    expect(fitted.bounds.y + fitted.bounds.height).toBeCloseTo(640, 2);
    expect(fitted.bounds.width / fitted.bounds.height).toBeCloseTo(
      fern.bounds.width / fern.bounds.height,
      3,
    );
    expect(fitted.length).toBeCloseTo(fern.length * fitted.scale, 2);
    expect(fitted.count).toBe(fern.count);
  });

  it('grows every branch at once with upTo, reusing its buffer', () => {
    const tree = L.fit(L.grow({ preset: 'tree', seed: 5 }), {
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
    expect(L.upTo(tree, 0).count).toBe(0);
    const half = L.upTo(tree, 0.5);
    const halfCount = half.count;
    expect(halfCount).toBeGreaterThan(0);
    expect(halfCount).toBeLessThan(tree.count);
    const all = L.upTo(tree, 1);
    expect(all.count).toBe(tree.count);
    expect(all.tips).toHaveLength(tree.tips.length);
    // The same buffer each frame: no allocation per call.
    expect(L.upTo(tree, 0.3).segments.buffer).toBe(all.segments.buffer);
    expect(L.upTo(tree, 0.7).count).toBeGreaterThan(halfCount);
  });

  it('strokes one width per branch depth into a Graphics', () => {
    const g = recorder();
    const fern = L.grow({ preset: 'fern', iterations: 3, seed: 2 });
    L.draw(g, fern, { color: [1, 2, 3], width: 8, taper: 0.5 });
    const strokes = g.calls.filter(([name]) => name === 'stroke');
    expect(g.calls.filter(([name]) => name === 'lineTo')).toHaveLength(fern.count);
    expect(strokes).toHaveLength(fern.maxDepth + 1);
    expect(strokes[0]?.[1]).toMatchObject({ width: 8, color: 1, cap: 'round' });
    expect(strokes[1]?.[1]).toMatchObject({ width: 4, color: 2 });
    expect(strokes[2]?.[1]).toMatchObject({ color: 3 });
    // A CSS string passes through to Pixi; anything else strokes mid grey.
    const css = recorder();
    L.draw(css, L.grow({ preset: 'koch', iterations: 1 }), { color: '#ff0000' });
    expect(css.calls.find(([name]) => name === 'stroke')?.[1]).toMatchObject({ color: '#ff0000' });
    const odd = recorder();
    L.draw(odd, L.grow({ preset: 'koch', iterations: 1 }), { color: Number.NaN });
    expect(odd.calls.find(([name]) => name === 'stroke')?.[1]).toMatchObject({ color: 0x808080 });
    expect(() => L.draw({}, fern)).toThrow(TypeError);
    expect(() => L.draw(g, null)).not.toThrow();
  });
});
