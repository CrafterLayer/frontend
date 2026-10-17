import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createGeomLibrary } from '../geom-entry';
import { curve } from './curve';
import { area, contains } from './paths';

/*
  Bézier curves in s.lib.geom (2026-10-13): Bezier.js vendored verbatim; points, length, a point
  and normal at t, the nearest point, an offset line, and a tapered outline as one flat polygon.
*/

const vendor = (file: string) => resolve(import.meta.dirname, '../../../../vendor/bezier-js', file);
const CUBIC = [80, 600, 400, 80, 900, 700, 1200, 120];
const QUAD = [100, 500, 640, 60, 1180, 500];

describe('geom curves', () => {
  it('are the vendored files, byte for byte, with their licence beside them', () => {
    const sha = (file: string) =>
      createHash('sha256')
        .update(readFileSync(vendor(file)))
        .digest('hex');
    expect(sha('bezier.js')).toBe(
      'ae20cb2547fe05581d07a67f966004ee4d86aeaf0117505bada9b1442114eb47',
    );
    expect(sha('utils.js')).toBe(
      'b09ff99724bac1ab7663a6944487fd25c31e8c684814083f9eb2c33833c5a64f',
    );
    expect(sha('poly-bezier.js')).toBe(
      'f73640e4d80a0d317136375d8b2e77d2ad9e77caf5b973709b4a19199b044c38',
    );
    expect(readFileSync(vendor('LICENSE'), 'utf8')).toMatch(
      /Copyright \(c\) 2023 Pomax[\s\S]*Permission is hereby granted, free of charge/u,
    );
  });

  it('samples a cubic and a quadratic from end to end', () => {
    const c = createGeomLibrary().curve(CUBIC);
    const points = c.points(16);
    expect(points).toHaveLength(34);
    expect(points.slice(0, 2)).toEqual([80, 600]);
    expect(points.slice(-2)).toEqual([1200, 120]);
    expect(c.at(0)).toEqual({ x: 80, y: 600 });
    const q = curve(QUAD);
    expect(q.at(1)).toEqual({ x: 1180, y: 500 });
    // Longer than the straight line between its ends, shorter than its control polygon.
    expect(q.length()).toBeGreaterThan(1080);
    expect(q.length()).toBeLessThan(Math.hypot(540, 440) * 2);
  });

  it('finds the nearest point and a unit normal', () => {
    const q = curve(QUAD);
    const near = q.project(640, 400);
    expect(near.t).toBeCloseTo(0.5, 1);
    expect(near.d).toBeGreaterThan(0);
    const n = q.normal(0.5);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1, 6);
  });

  it('outlines a curve with a width as one closed polygon, tapering when asked', () => {
    const c = curve(CUBIC);
    const even = c.outline(40);
    const taper = c.outline([4, 60]);
    expect(even.length).toBeGreaterThan(40);
    expect(even.length % 2).toBe(0);
    // About its length times its width.
    expect(area(even)).toBeGreaterThan(c.length() * 40 * 0.7);
    expect(area(even)).toBeLessThan(c.length() * 40 * 1.3);
    expect(contains(even, c.at(0.5).x, c.at(0.5).y)).toBe(true);
    expect(area(taper)).not.toBeCloseTo(area(even), 0);
    expect(c.offset(30).length).toBeGreaterThan(8);
  });

  it('splits, boxes, and never throws on bad input', () => {
    const [left, right] = curve(CUBIC).split(0.5);
    expect(left.at(1).x).toBeCloseTo(right.at(0).x, 6);
    expect(curve(CUBIC).bbox()).toMatchObject({ x: 80 });
    for (const bad of [null, [1, 2, 3], 'curve', [0, 0, 0, 0, 0, 0]]) {
      const c = curve(bad);
      expect(() => c.outline(10)).not.toThrow();
      expect(Array.isArray(c.points())).toBe(true);
    }
    expect(curve([1, 2, 3]).points()).toEqual([]);
  });
});
