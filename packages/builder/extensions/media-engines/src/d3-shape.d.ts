/*
  d3-shape 3.2.0 ships plain JavaScript without types (mural libraries 2, 2026-10-13). Only what
  `studio/libs/geom/shape.ts` drives is declared: a line and an arc drawn into a path context of
  our own (no DOM, no SVG string), the curve factories it names, and the pie layout.
*/
declare module 'd3-shape' {
  /** The subset of CanvasPathMethods d3-shape's lines, curves and arcs call. */
  export interface ShapeContext {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    closePath(): void;
    bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
    quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
    arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  }
  export type CurveFactory = (context: ShapeContext) => unknown;
  export interface CurveCatmullRomFactory extends CurveFactory {
    alpha(alpha: number): CurveCatmullRomFactory;
  }
  export const curveBasis: CurveFactory;
  export const curveBasisClosed: CurveFactory;
  export const curveCatmullRom: CurveCatmullRomFactory;
  export const curveCatmullRomClosed: CurveCatmullRomFactory;
  export const curveLinear: CurveFactory;
  export const curveLinearClosed: CurveFactory;
  export const curveMonotoneX: CurveFactory;
  export const curveNatural: CurveFactory;
  export const curveStep: CurveFactory;

  export interface Line {
    (data: readonly (readonly [number, number])[]): unknown;
    curve(curve: CurveFactory): Line;
    context(context: ShapeContext | null): Line;
  }
  export function line(): Line;

  export interface Arc {
    (): unknown;
    innerRadius(radius: number): Arc;
    outerRadius(radius: number): Arc;
    startAngle(angle: number): Arc;
    endAngle(angle: number): Arc;
    cornerRadius(radius: number): Arc;
    padAngle(angle: number): Arc;
    context(context: ShapeContext | null): Arc;
  }
  export function arc(): Arc;

  export interface PieArcDatum {
    readonly data: number;
    readonly index: number;
    readonly value: number;
    readonly startAngle: number;
    readonly endAngle: number;
    readonly padAngle: number;
  }
  export interface Pie {
    (data: readonly number[]): PieArcDatum[];
    sortValues(compare: null): Pie;
    startAngle(angle: number): Pie;
    endAngle(angle: number): Pie;
    padAngle(angle: number): Pie;
  }
  export function pie(): Pie;
}
