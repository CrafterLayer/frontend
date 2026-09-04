import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { compareScreenshots, ScreenshotDecodeError } from './compare';
import { BLACK, maskCoordinates, pngField, pngSoftEdge, WHITE } from './test-images';

const FIELD = { width: 20, height: 20, colour: WHITE } as const;

describe('compareScreenshots', () => {
  it('reports zero change for two identical screenshots', () => {
    const comparison = compareScreenshots(pngField(FIELD), pngField(FIELD));

    expect(comparison.changedPixels).toBe(0);
    expect(comparison.changedRatio).toBe(0);
    expect(comparison.width).toBe(20);
    expect(comparison.height).toBe(20);
    expect(comparison.sizeChanged).toBe(false);
    expect(maskCoordinates(comparison.changeMask, comparison.width)).toEqual([]);
  });

  it('does not build a diff image unless one is asked for', () => {
    const changed = pngField({ ...FIELD, squares: [{ x: 8, y: 8, size: 4, colour: BLACK }] });

    expect(compareScreenshots(pngField(FIELD), changed).diff).toBeUndefined();

    const withDiff = compareScreenshots(pngField(FIELD), changed, { produceDiffImage: true });
    expect(withDiff.diff).toBeInstanceOf(Buffer);
    const decoded = PNG.sync.read(withDiff.diff!);
    expect([decoded.width, decoded.height]).toEqual([20, 20]);
  });

  it('detects a one-square change and localises it to exactly that square', () => {
    const changed = pngField({ ...FIELD, squares: [{ x: 8, y: 8, size: 4, colour: BLACK }] });

    const comparison = compareScreenshots(pngField(FIELD), changed);

    expect(comparison.changedPixels).toBe(16);
    expect(comparison.changedRatio).toBeCloseTo(16 / 400, 10);
    // Every changed pixel must fall inside the 4x4 square we painted and nowhere else. Asserting
    // the coordinates, not just the count, is what proves the mask can answer "which section
    // moved" rather than only "something moved".
    const expected = [8, 9, 10, 11].flatMap((y) => [8, 9, 10, 11].map((x) => [x, y]));
    expect(maskCoordinates(comparison.changeMask, comparison.width)).toEqual(expected);
  });

  it('reports a size mismatch as a size change instead of throwing', () => {
    const short = pngField({ width: 20, height: 20, colour: WHITE });
    const tall = pngField({ width: 20, height: 30, colour: WHITE });

    const comparison = compareScreenshots(short, tall);

    expect(comparison.sizeChanged).toBe(true);
    expect(comparison.baselineSize).toEqual({ width: 20, height: 20 });
    expect(comparison.candidateSize).toEqual({ width: 20, height: 30 });
    // The comparison runs on the union of the two sizes, with the rows only the taller screenshot
    // covers left transparent in the baseline, so those 200 pixels count as changed.
    expect(comparison.width).toBe(20);
    expect(comparison.height).toBe(30);
    expect(comparison.changedPixels).toBe(200);
    const changedRows = new Set(
      maskCoordinates(comparison.changeMask, comparison.width).map(([, y]) => y),
    );
    expect([...changedRows].sort((a, b) => a - b)).toEqual([
      20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    ]);
  });

  it('errors clearly on an empty buffer instead of reporting no change', () => {
    const error = (() => {
      try {
        compareScreenshots(Buffer.alloc(0), pngField(FIELD));
        return null;
      } catch (thrown: unknown) {
        return thrown;
      }
    })();

    expect(error).toBeInstanceOf(ScreenshotDecodeError);
    expect((error as ScreenshotDecodeError).side).toBe('baseline');
    expect((error as ScreenshotDecodeError).message).toContain('empty');
  });

  it('errors clearly on a corrupt buffer, naming the side that failed', () => {
    const notAPng = Buffer.from('this is not a PNG, it is a truncated download', 'utf8');

    expect(() => {
      compareScreenshots(pngField(FIELD), notAPng);
    }).toThrow(ScreenshotDecodeError);

    try {
      compareScreenshots(pngField(FIELD), notAPng);
      expect.unreachable('a corrupt candidate must not compare as unchanged');
    } catch (thrown: unknown) {
      expect(thrown).toBeInstanceOf(ScreenshotDecodeError);
      expect((thrown as ScreenshotDecodeError).side).toBe('candidate');
    }
  });

  it('honours the documented default threshold and lets a caller lower it', () => {
    const white = pngField(FIELD);
    const nearlyWhite = pngField({ ...FIELD, colour: [250, 250, 250, 255] });

    // A five-step grey shift across the whole field is below the default 0.1 threshold, so the
    // default reports a page-wide colour change as no change at all. That is the documented
    // trade-off, and a caller who cares about subtle colour must lower the threshold.
    expect(compareScreenshots(white, nearlyWhite).changedPixels).toBe(0);
    expect(compareScreenshots(white, nearlyWhite, { threshold: 0 }).changedPixels).toBe(400);
  });

  it('rejects a threshold outside the 0 to 1 range', () => {
    expect(() => compareScreenshots(pngField(FIELD), pngField(FIELD), { threshold: 5 })).toThrow(
      RangeError,
    );
  });

  it('applies the anti-aliasing policy explicitly', () => {
    const before = pngSoftEdge(20, 20, 128);
    const after = pngSoftEdge(20, 20, 160);

    // The two images differ only in the soft column between the black and white halves, which is
    // exactly what pixelmatch classifies as anti-aliasing. Under the default policy that change is
    // invisible; asking to count anti-aliased pixels surfaces the whole column.
    expect(compareScreenshots(before, after).changedPixels).toBe(0);
    expect(compareScreenshots(before, after, { antialiasing: 'ignore' }).changedPixels).toBe(0);
    expect(compareScreenshots(before, after, { antialiasing: 'count' }).changedPixels).toBe(20);
  });
});
