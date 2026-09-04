import type { ScreenshotComparison } from './compare';

/**
 * A rectangle in screenshot pixels, with the origin at the top-left corner of the image.
 *
 * These are device pixels of the captured PNG, not CSS pixels. On a 2x device pixel ratio capture a
 * section that measures 800x300 in the DOM occupies a 1600x600 rectangle here, so multiply a
 * `getBoundingClientRect()` by the ratio you captured at before handing it over.
 */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type VisualVerdictKind = 'identical' | 'changed-as-expected' | 'changed-too-much';

/** What the caller believed the edit was supposed to do to this screenshot. */
export type VisualExpectation = 'change' | 'no-change';

/**
 * The share of the whole canvas that may change outside the expected regions before we call the
 * result a regression.
 *
 * It is not zero because a real page nudges a pixel or two outside the edited section for reasons
 * nobody cares about: a scrollbar appearing, a shadow bleeding one pixel past a section boundary,
 * a sub-pixel reflow of the line below. It is small — 0.1% of a 1280x2000 screenshot is about 2500
 * pixels, roughly a 50x50 square — because a section that genuinely moved is far larger than that.
 */
export const DEFAULT_UNEXPECTED_CHANGE_RATIO = 0.001;

export interface VisualVerdictOptions {
  /**
   * The regions the caller believed would change, e.g. the bounding box of the one section an
   * agent said it edited. Changes inside these count as intended; changes outside count against
   * {@link VisualVerdictOptions.unexpectedChangeRatio}.
   *
   * Omit it and the default depends on the expectation: for 'change' the whole canvas is treated
   * as expected (you are only asking "did anything happen at all?"), for 'no-change' nothing is,
   * so any change at all is unexpected.
   */
  readonly expectedRegions?: readonly PixelRect[];
  /** See {@link DEFAULT_UNEXPECTED_CHANGE_RATIO}. */
  readonly unexpectedChangeRatio?: number;
  /**
   * The share of the canvas that may change before we call it too much even when every changed
   * pixel is inside an expected region. Defaults to 1, i.e. no cap: a caller who declared the
   * region is already saying a full repaint of it is fine. Set it when you know the edit should be
   * small, so that "I rewrote the entire hero" does not pass a check for "I changed the heading".
   */
  readonly maxChangedRatio?: number;
  /** See {@link VisualExpectation}. Defaults to 'change'. */
  readonly expectation?: VisualExpectation;
  /**
   * Treat a screenshot whose dimensions changed as an ordinary change rather than an automatic
   * regression. Off by default: when a page gets taller or wider, every region below or right of
   * the edit has moved, and the pixel counts stop meaning what the region rectangles say they mean.
   */
  readonly allowSizeChange?: boolean;
}

export interface VisualVerdict {
  readonly kind: VisualVerdictKind;
  /** Whether this verdict satisfies the caller's expectation; the single boolean an agent acts on. */
  readonly passed: boolean;
  /** A sentence naming what was measured and why the verdict came out this way. */
  readonly reason: string;
  readonly changedPixels: number;
  readonly changedRatio: number;
  /** Changed pixels that landed inside one of the expected regions. */
  readonly changedInsideExpected: number;
  /** Changed pixels that landed outside every expected region. */
  readonly changedOutsideExpected: number;
  /** {@link changedOutsideExpected} as a share of the whole canvas. */
  readonly unexpectedRatio: number;
  readonly sizeChanged: boolean;
}

function assertUsableRect(rect: PixelRect, index: number): void {
  const parts: readonly (readonly [string, number])[] = [
    ['x', rect.x],
    ['y', rect.y],
    ['width', rect.width],
    ['height', rect.height],
  ];
  for (const [name, value] of parts) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(
        `Expected region ${String(index)} has ${name}=${String(value)}; region rectangles are ` +
          `whole, non-negative pixel counts.`,
      );
    }
  }
}

/**
 * Mark every pixel covered by an expected region.
 *
 * Rectangles are clipped to the canvas rather than rejected for overflowing it, because a caller
 * measuring a section in the browser legitimately gets a box that runs past the bottom of a
 * clipped viewport screenshot, and failing on that would only teach callers to stop passing
 * regions at all.
 */
function buildExpectedMask(
  regions: readonly PixelRect[],
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const [index, rect] of regions.entries()) {
    assertUsableRect(rect, index);
    const left = Math.min(rect.x, width);
    const top = Math.min(rect.y, height);
    const right = Math.min(rect.x + rect.width, width);
    const bottom = Math.min(rect.y + rect.height, height);
    for (let y = top; y < bottom; y += 1) {
      mask.fill(1, y * width + left, y * width + right);
    }
  }
  return mask;
}

/**
 * Turn a pixel comparison into a judgement an agent can act on.
 *
 * The two failures this answers are the ones that go unnoticed today. 'identical' means the edit
 * left the page byte-identical: when an agent has just reported a section as applied, that is a
 * FAILURE, not a pass, and `passed` is false for it under the default 'change' expectation.
 * 'changed-too-much' means pixels moved outside the regions the caller said were in play — the
 * signature of an edit that broke the layout of a section nobody was touching.
 */
export function judgeComparison(
  comparison: ScreenshotComparison,
  options: VisualVerdictOptions = {},
): VisualVerdict {
  const expectation = options.expectation ?? 'change';
  const unexpectedChangeRatio = options.unexpectedChangeRatio ?? DEFAULT_UNEXPECTED_CHANGE_RATIO;
  const maxChangedRatio = options.maxChangedRatio ?? 1;
  const allowSizeChange = options.allowSizeChange ?? false;

  const { width, height, changeMask, changedPixels, changedRatio, sizeChanged } = comparison;
  const wholeCanvas: readonly PixelRect[] = [{ x: 0, y: 0, width, height }];
  const nothing: readonly PixelRect[] = [];
  const regions = options.expectedRegions ?? (expectation === 'change' ? wholeCanvas : nothing);

  const expectedMask = buildExpectedMask(regions, width, height);
  let changedInsideExpected = 0;
  let changedOutsideExpected = 0;
  for (let index = 0; index < changeMask.length; index += 1) {
    if (changeMask[index] !== 1) continue;
    if (expectedMask[index] === 1) changedInsideExpected += 1;
    else changedOutsideExpected += 1;
  }
  const unexpectedRatio = changedOutsideExpected / (width * height);

  const measured = {
    changedPixels,
    changedRatio,
    changedInsideExpected,
    changedOutsideExpected,
    unexpectedRatio,
    sizeChanged,
  };
  const decide = (kind: VisualVerdictKind, reason: string): VisualVerdict => ({
    ...measured,
    kind,
    reason,
    // The two expectations fail on opposite things. When a change was expected, only
    // 'changed-as-expected' is a pass: 'identical' is the silent no-op we are hunting. When no
    // change was expected, anything short of 'changed-too-much' passes, so that sub-budget capture
    // noise does not turn every run red.
    passed: expectation === 'change' ? kind === 'changed-as-expected' : kind !== 'changed-too-much',
  });

  if (sizeChanged && !allowSizeChange) {
    const { baselineSize: was, candidateSize: now } = comparison;
    return decide(
      'changed-too-much',
      `The screenshot changed size, from ${String(was.width)}x${String(was.height)} to ` +
        `${String(now.width)}x${String(now.height)}. Every region below or right of the edit has ` +
        `moved, so the region rectangles no longer describe the same content. Pass ` +
        `allowSizeChange when a size change is the intended outcome.`,
    );
  }

  if (changedPixels === 0) {
    return decide(
      'identical',
      'The two screenshots are pixel-identical: this edit produced no visible change at all.',
    );
  }

  if (changedOutsideExpected > 0 && unexpectedRatio > unexpectedChangeRatio) {
    return decide(
      'changed-too-much',
      `${String(changedOutsideExpected)} pixels changed outside the expected regions ` +
        `(${(unexpectedRatio * 100).toFixed(3)}% of the canvas, over the ` +
        `${(unexpectedChangeRatio * 100).toFixed(3)}% budget). Something moved that nobody was ` +
        `editing.`,
    );
  }

  if (changedRatio > maxChangedRatio) {
    return decide(
      'changed-too-much',
      `${String(changedPixels)} pixels changed (${(changedRatio * 100).toFixed(3)}% of the ` +
        `canvas, over the ${(maxChangedRatio * 100).toFixed(3)}% cap), which is a larger edit ` +
        `than the caller expected.`,
    );
  }

  return decide(
    'changed-as-expected',
    `${String(changedPixels)} pixels changed, ${String(changedInsideExpected)} of them inside the ` +
      `expected regions.`,
  );
}
