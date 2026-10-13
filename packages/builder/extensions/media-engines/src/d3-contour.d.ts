/*
  d3-contour 4.0.2 ships plain JavaScript without types (mural libraries, 2026-10-13). Only the
  generator `studio/libs/geom/contours.ts` drives is declared: marching squares over a grid of
  values, one GeoJSON MultiPolygon per threshold, in grid units.
*/
declare module 'd3-contour' {
  export type ContourRing = [number, number][];
  export interface ContourMultiPolygon {
    type: 'MultiPolygon';
    value: number;
    /** Polygons; each is its outer ring followed by its holes, every ring closed. */
    coordinates: ContourRing[][];
  }
  export interface Contours {
    (values: ArrayLike<number>): ContourMultiPolygon[];
    size(size: [number, number]): Contours;
    smooth(smooth: boolean): Contours;
    thresholds(thresholds: readonly number[]): Contours;
  }
  export function contours(): Contours;
}
