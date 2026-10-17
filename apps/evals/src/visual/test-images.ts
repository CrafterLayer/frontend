import { PNG } from 'pngjs';

/**
 * PNG builders for the visual-verification tests.
 *
 * The fixtures are generated in code rather than committed as binary files so that a reader can
 * see exactly which pixels a test expects to move: "a 40x40 white field with a 4x4 black square at
 * (8,8)" is readable in a way that a checked-in PNG is not, and it stays byte-for-byte
 * reproducible on every machine instead of drifting with whatever tool re-encoded it last.
 *
 * This module is test scaffolding and is deliberately NOT re-exported from `index.ts`.
 */

/** Red, green, blue, alpha — each 0 to 255. */
export type Rgba = readonly [number, number, number, number];

export const WHITE: Rgba = [255, 255, 255, 255];
export const BLACK: Rgba = [0, 0, 0, 255];

export interface PaintedSquare {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly colour: Rgba;
}

export interface FieldSpec {
  readonly width: number;
  readonly height: number;
  /** The colour every pixel starts as. */
  readonly colour: Rgba;
  /** Squares painted over the field in order, so a later square wins where they overlap. */
  readonly squares?: readonly PaintedSquare[];
}

/** Encode a solid colour field, optionally with squares painted onto it, as PNG bytes. */
export function pngField(spec: FieldSpec): Buffer {
  const { width, height, colour, squares = [] } = spec;
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let pixel = colour;
      for (const square of squares) {
        const inside =
          x >= square.x &&
          x < square.x + square.size &&
          y >= square.y &&
          y < square.y + square.size;
        if (inside) pixel = square.colour;
      }
      const offset = (y * width + x) * 4;
      png.data[offset] = pixel[0];
      png.data[offset + 1] = pixel[1];
      png.data[offset + 2] = pixel[2];
      png.data[offset + 3] = pixel[3];
    }
  }
  return PNG.sync.write(png);
}

/**
 * A field split by a vertical black-to-white edge, with a single grey column at the boundary.
 *
 * Two of these with different greys differ only in that soft column, which is precisely the shape
 * pixelmatch's anti-aliasing detector is built to recognise. That makes them the fixture that
 * proves the anti-aliasing policy is really being applied, rather than merely accepted.
 */
export function pngSoftEdge(width: number, height: number, edgeGrey: number): Buffer {
  const png = new PNG({ width, height });
  const boundary = Math.floor(width / 2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = x < boundary ? 0 : x === boundary ? edgeGrey : 255;
      const offset = (y * width + x) * 4;
      png.data[offset] = value;
      png.data[offset + 1] = value;
      png.data[offset + 2] = value;
      png.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

/** The coordinates of every set pixel in a change mask, for readable localisation assertions. */
export function maskCoordinates(
  mask: Uint8Array,
  width: number,
): readonly (readonly [number, number])[] {
  const coordinates: (readonly [number, number])[] = [];
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 1) coordinates.push([index % width, Math.floor(index / width)]);
  }
  return coordinates;
}
