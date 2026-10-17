/*
  Types for the vendored bezier.js (bezier-js 6.1.4, MIT; see PROVENANCE.md). Its own d.ts is not
  in the npm tarball; only what src/studio/libs/geom/curve.ts calls is declared.
*/
export interface BezierPoint {
  x: number;
  y: number;
  t?: number;
  d?: number;
}

export declare class PolyBezier {
  curves: Bezier[];
}

export declare class Bezier {
  constructor(...coords: number[]);
  points: BezierPoint[];
  length(): number;
  getLUT(steps?: number): BezierPoint[];
  get(t: number): BezierPoint;
  normal(t: number): BezierPoint;
  project(point: { x: number; y: number }): BezierPoint;
  split(t: number): { left: Bezier; right: Bezier };
  bbox(): { x: { min: number; max: number }; y: { min: number; max: number } };
  offset(d: number): Bezier[];
  outline(d1: number, d2?: number, d3?: number, d4?: number): PolyBezier;
}
