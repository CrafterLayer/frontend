import { BOOLEAN_LIMITS, difference, draw, intersect, shapes, union, xor } from './geom/boolean';
import { bands, CONTOUR_LIMITS, lines } from './geom/contours';
import { mosaic, MOSAIC_LIMITS, type MosaicOptions } from './geom/mosaic';
import {
  arch,
  ARCH_KINDS,
  area,
  centroid,
  contains,
  inset,
  PATH_LIMITS,
  ribbon,
  smooth,
  type ArchKind,
  type RibbonWidth,
} from './geom/paths';

export const GEOM_VERSION = '1.0.0';

/**
 * `s.lib.geom` (mural libraries, 2026-10-13): mural geometry in design units, every polygon a flat
 * [x0, y0, …] array for `Graphics.poly` — terraced contour bands and isolines (d3-contour 4.0.2,
 * ISC), polygon union / intersect / difference / xor (polybooljs 1.2.2, MIT), and our own
 * relaxed-Voronoi mosaics (on the kit's s.delaunay), ribbons, insets, Chaikin smoothing and arch
 * outlines. Plain JavaScript: it never imports Pixi (draw fills the scene's own Graphics).
 */
export function createGeomLibrary() {
  return Object.freeze({
    version: GEOM_VERSION,
    limits: Object.freeze({
      ...CONTOUR_LIMITS,
      maxRings: BOOLEAN_LIMITS.maxRings,
      maxPoints: PATH_LIMITS.maxPoints,
      maxCells: MOSAIC_LIMITS.maxCells,
    }),
    arches: ARCH_KINDS,
    bands: (grid: unknown, levels?: number | readonly number[]) => bands(grid, levels),
    lines: (grid: unknown, levels?: number | readonly number[]) => lines(grid, levels),
    union: (a: unknown, b: unknown) => union(a, b),
    intersect: (a: unknown, b: unknown) => intersect(a, b),
    difference: (a: unknown, b: unknown) => difference(a, b),
    xor: (a: unknown, b: unknown) => xor(a, b),
    shapes: (input: unknown) => shapes(input),
    draw: (g: unknown, input: unknown, fill: unknown, stroke?: unknown) =>
      draw(g, input, fill, stroke),
    mosaic: (s: unknown, options?: MosaicOptions) => mosaic(s, options),
    ribbon: (points: unknown, width?: RibbonWidth) => ribbon(points, width),
    smooth: (points: unknown, options?: { closed?: boolean; iterations?: number }) =>
      smooth(points, options),
    inset: (polygon: unknown, distance: number) => inset(polygon, distance),
    arch: (x: number, y: number, w: number, h: number, kind?: ArchKind, steps?: number) =>
      arch(x, y, w, h, kind, steps),
    area: (polygon: number[]) => area(polygon),
    centroid: (polygon: number[]) => centroid(polygon),
    contains: (polygon: number[], x: number, y: number) => contains(polygon, x, y),
  });
}
