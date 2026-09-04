import { describe, expect, it } from 'vitest';

import { compareScreenshots } from './compare';
import { judgeComparison, type PixelRect } from './verdict';
import { BLACK, pngField, WHITE } from './test-images';

/**
 * A 200x200 canvas is big enough that a small square lands either side of the default 0.1%
 * unexpected-change budget: 40,000 pixels means the budget is 40 pixels, so a 4x4 square (16) is
 * tolerable noise and an 8x8 square (64) is a regression.
 */
const CANVAS = { width: 200, height: 200, colour: WHITE } as const;
const EDITED_SECTION: PixelRect = { x: 0, y: 0, width: 200, height: 100 };

function comparisonWithSquares(squares: readonly { x: number; y: number; size: number }[]) {
  const before = pngField(CANVAS);
  const after = pngField({
    ...CANVAS,
    squares: squares.map((square) => ({ ...square, colour: BLACK })),
  });
  return compareScreenshots(before, after);
}

describe('judgeComparison', () => {
  it('calls an unchanged screenshot identical, and fails it when a change was expected', () => {
    const verdict = judgeComparison(comparisonWithSquares([]));

    expect(verdict.kind).toBe('identical');
    expect(verdict.passed).toBe(false);
    expect(verdict.changedPixels).toBe(0);
    expect(verdict.reason).toContain('no visible change');
  });

  it('passes an unchanged screenshot when no change was expected', () => {
    const verdict = judgeComparison(comparisonWithSquares([]), { expectation: 'no-change' });

    expect(verdict.kind).toBe('identical');
    expect(verdict.passed).toBe(true);
  });

  it('accepts a change that lands entirely inside an expected region', () => {
    const comparison = comparisonWithSquares([{ x: 20, y: 20, size: 8 }]);

    const verdict = judgeComparison(comparison, { expectedRegions: [EDITED_SECTION] });

    expect(verdict.kind).toBe('changed-as-expected');
    expect(verdict.passed).toBe(true);
    expect(verdict.changedInsideExpected).toBe(64);
    expect(verdict.changedOutsideExpected).toBe(0);
  });

  it('rejects the same change when it lands outside every expected region', () => {
    const comparison = comparisonWithSquares([{ x: 20, y: 150, size: 8 }]);

    const verdict = judgeComparison(comparison, { expectedRegions: [EDITED_SECTION] });

    expect(verdict.kind).toBe('changed-too-much');
    expect(verdict.passed).toBe(false);
    expect(verdict.changedInsideExpected).toBe(0);
    expect(verdict.changedOutsideExpected).toBe(64);
    expect(verdict.reason).toContain('outside the expected regions');
  });

  it('tolerates a spill outside the expected region that stays under the budget', () => {
    // The edited section changed, and 16 pixels moved below it — under the 40-pixel budget that
    // 0.1% of this canvas allows, which is the scrollbar-and-shadow noise a real page produces.
    const comparison = comparisonWithSquares([
      { x: 20, y: 20, size: 8 },
      { x: 20, y: 150, size: 4 },
    ]);

    const verdict = judgeComparison(comparison, { expectedRegions: [EDITED_SECTION] });

    expect(verdict.kind).toBe('changed-as-expected');
    expect(verdict.passed).toBe(true);
    expect(verdict.changedInsideExpected).toBe(64);
    expect(verdict.changedOutsideExpected).toBe(16);
  });

  it('lets the caller tighten the unexpected-change budget to zero', () => {
    const comparison = comparisonWithSquares([
      { x: 20, y: 20, size: 8 },
      { x: 20, y: 150, size: 4 },
    ]);

    const verdict = judgeComparison(comparison, {
      expectedRegions: [EDITED_SECTION],
      unexpectedChangeRatio: 0,
    });

    expect(verdict.kind).toBe('changed-too-much');
  });

  it('treats any change as unexpected when no change was expected', () => {
    const comparison = comparisonWithSquares([{ x: 20, y: 20, size: 8 }]);

    const verdict = judgeComparison(comparison, { expectation: 'no-change' });

    expect(verdict.kind).toBe('changed-too-much');
    expect(verdict.passed).toBe(false);
    expect(verdict.changedInsideExpected).toBe(0);
    expect(verdict.changedOutsideExpected).toBe(64);
  });

  it('treats the whole canvas as expected when a change was expected and no regions were given', () => {
    const comparison = comparisonWithSquares([{ x: 20, y: 150, size: 8 }]);

    const verdict = judgeComparison(comparison);

    expect(verdict.kind).toBe('changed-as-expected');
    expect(verdict.changedOutsideExpected).toBe(0);
  });

  it('caps how much may change even inside an expected region', () => {
    const comparison = comparisonWithSquares([{ x: 0, y: 0, size: 100 }]);

    const verdict = judgeComparison(comparison, {
      expectedRegions: [EDITED_SECTION],
      maxChangedRatio: 0.1,
    });

    expect(verdict.kind).toBe('changed-too-much');
    expect(verdict.reason).toContain('cap');
  });

  it('fails a screenshot that changed size, and says why the regions stopped meaning anything', () => {
    const comparison = compareScreenshots(
      pngField({ width: 200, height: 200, colour: WHITE }),
      pngField({ width: 200, height: 260, colour: WHITE }),
    );

    const verdict = judgeComparison(comparison, { expectedRegions: [EDITED_SECTION] });

    expect(verdict.kind).toBe('changed-too-much');
    expect(verdict.sizeChanged).toBe(true);
    expect(verdict.reason).toContain('200x200');
    expect(verdict.reason).toContain('200x260');
  });

  it('accepts a size change when the caller says the page was meant to grow', () => {
    const comparison = compareScreenshots(
      pngField({ width: 200, height: 200, colour: WHITE }),
      pngField({ width: 200, height: 260, colour: WHITE }),
    );

    const verdict = judgeComparison(comparison, { allowSizeChange: true });

    expect(verdict.kind).toBe('changed-as-expected');
    expect(verdict.passed).toBe(true);
  });

  it('clips an expected region that runs past the edge of the screenshot', () => {
    const comparison = comparisonWithSquares([{ x: 190, y: 190, size: 8 }]);

    const verdict = judgeComparison(comparison, {
      expectedRegions: [{ x: 150, y: 150, width: 500, height: 500 }],
    });

    expect(verdict.kind).toBe('changed-as-expected');
    expect(verdict.changedInsideExpected).toBe(64);
  });

  it('rejects a region rectangle that is not made of whole, non-negative pixels', () => {
    const comparison = comparisonWithSquares([{ x: 20, y: 20, size: 8 }]);

    expect(() =>
      judgeComparison(comparison, { expectedRegions: [{ x: -1, y: 0, width: 10, height: 10 }] }),
    ).toThrow(RangeError);
    expect(() =>
      judgeComparison(comparison, { expectedRegions: [{ x: 0, y: 0, width: 10.5, height: 10 }] }),
    ).toThrow(/width=10.5/);
  });
});
