import { getStroke } from 'perfect-freehand';

type StrokePoint =
  number[] | { readonly x: number; readonly y: number; readonly pressure?: number };

/** Named helper retained beside the upstream API for generated-script readability. */
function strokeToPolygon(points: StrokePoint[], options?: Parameters<typeof getStroke>[1]) {
  return getStroke(points, options);
}

export function createBrushLibrary() {
  return Object.freeze({ getStroke, strokeToPolygon });
}
