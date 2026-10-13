/*
  polybooljs 1.2.2 ships plain CommonJS without types (mural libraries, 2026-10-13). Only the four
  modules `studio/libs/geom/boolean.ts` imports are declared; its entry file is never imported,
  because it assigns `window.PolyBool` as a side effect and drags the GeoJSON and debug-log
  helpers along.
*/
declare module 'polybooljs/lib/epsilon.js' {
  export interface PolyBoolEpsilon {
    epsilon(value?: number): number;
  }
  export default function Epsilon(eps?: number): PolyBoolEpsilon;
}

declare module 'polybooljs/lib/intersecter.js' {
  import type { PolyBoolEpsilon } from 'polybooljs/lib/epsilon.js';

  export type PolyBoolPoint = [number, number];
  /** Opaque segments, passed between the polybooljs phases as they come. */
  export type PolyBoolSegments = unknown[];
  export interface PolyBoolIntersecter {
    addRegion(region: PolyBoolPoint[]): void;
    calculate(inverted: boolean): PolyBoolSegments;
    calculate(
      segments1: PolyBoolSegments,
      inverted1: boolean,
      segments2: PolyBoolSegments,
      inverted2: boolean,
    ): PolyBoolSegments;
  }
  export default function Intersecter(
    selfIntersection: boolean,
    eps: PolyBoolEpsilon,
    buildLog: false,
  ): PolyBoolIntersecter;
}

declare module 'polybooljs/lib/segment-selector.js' {
  import type { PolyBoolSegments } from 'polybooljs/lib/intersecter.js';

  type Select = (segments: PolyBoolSegments, buildLog: false) => PolyBoolSegments;
  const SegmentSelector: {
    union: Select;
    intersect: Select;
    difference: Select;
    differenceRev: Select;
    xor: Select;
  };
  export default SegmentSelector;
}

declare module 'polybooljs/lib/segment-chainer.js' {
  import type { PolyBoolEpsilon } from 'polybooljs/lib/epsilon.js';
  import type { PolyBoolPoint, PolyBoolSegments } from 'polybooljs/lib/intersecter.js';

  export default function SegmentChainer(
    segments: PolyBoolSegments,
    eps: PolyBoolEpsilon,
    buildLog: false,
  ): PolyBoolPoint[][];
}
