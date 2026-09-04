import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * The pixelmatch matching threshold we default to.
 *
 * pixelmatch measures per-pixel colour distance in YIQ space and treats a pixel as changed once
 * that distance exceeds `35215 * threshold^2`. At 0.1 a screenshot survives the small colour
 * wobble that font hinting and GPU compositing produce between runs, while a genuinely restyled
 * button or a moved section still registers. Lower it towards 0 to catch subtle colour edits (a
 * `#ffffff` to `#fafafa` background change is INVISIBLE at the default), raise it when a noisy
 * capture pipeline keeps producing false positives.
 */
export const DEFAULT_PIXEL_THRESHOLD = 0.1;

/** How the comparison should treat pixels that pixelmatch identifies as anti-aliasing. */
export type AntialiasingMode = 'ignore' | 'count';

/**
 * The anti-aliasing policy we default to.
 *
 * 'ignore' asks pixelmatch to run its anti-aliasing detector and drop the pixels it flags. That is
 * what makes screenshots comparable across machines, because text and rounded corners are rendered
 * with slightly different sub-pixel coverage by different GPUs and font stacks. The cost is real
 * and callers must know it: a change that only alters the soft edge of a shape — a 1px border
 * colour, a font-smoothing switch — is reported as ZERO changed pixels under 'ignore'. Pass
 * 'count' when the edge itself is the thing under test.
 */
export const DEFAULT_ANTIALIASING_MODE: AntialiasingMode = 'ignore';

/** The pixel dimensions of a decoded screenshot. */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

export interface CompareScreenshotsOptions {
  /** See {@link DEFAULT_PIXEL_THRESHOLD}. Must be between 0 and 1. */
  readonly threshold?: number;
  /** See {@link DEFAULT_ANTIALIASING_MODE}. */
  readonly antialiasing?: AntialiasingMode;
  /**
   * Render a human-readable diff PNG into {@link ScreenshotComparison.diff}. Off by default because
   * building it costs a second full pixelmatch pass and a full-size RGBA buffer, which is wasted
   * work on the majority of comparisons that pass.
   */
  readonly produceDiffImage?: boolean;
}

export interface ScreenshotComparison {
  /** Pixels pixelmatch considered a real difference, after the anti-aliasing policy was applied. */
  readonly changedPixels: number;
  /** {@link changedPixels} divided by the total pixel count of the comparison canvas. */
  readonly changedRatio: number;
  /** Width of the comparison canvas, which is the wider of the two screenshots. */
  readonly width: number;
  /** Height of the comparison canvas, which is the taller of the two screenshots. */
  readonly height: number;
  /** A PNG of the diff, present only when `produceDiffImage` was requested. */
  readonly diff: Buffer | undefined;
  /** True when the two screenshots did not have identical dimensions. */
  readonly sizeChanged: boolean;
  readonly baselineSize: ImageSize;
  readonly candidateSize: ImageSize;
  /**
   * One byte per pixel of the comparison canvas in row-major order: 1 where the pixel changed, 0
   * where it did not. This is what lets a caller ask WHERE a change landed rather than only how
   * big it was, and it is the input `verdict.ts` uses to separate the region an agent edited from
   * the regions it was supposed to leave alone.
   */
  readonly changeMask: Uint8Array;
}

/**
 * Thrown when a buffer handed to {@link compareScreenshots} is not a PNG we can decode.
 *
 * This exists so that an empty or truncated screenshot can never be mistaken for a passing
 * comparison. A capture step that silently produced 0 bytes would otherwise decode to nothing,
 * diff against nothing, and report "no change" — which is exactly the false pass this whole module
 * is built to prevent.
 */
export class ScreenshotDecodeError extends Error {
  override readonly name = 'ScreenshotDecodeError';

  constructor(
    readonly side: 'baseline' | 'candidate',
    readonly reason: string,
  ) {
    super(`Could not decode the ${side} screenshot as a PNG: ${reason}`);
  }
}

function decodePng(side: 'baseline' | 'candidate', buffer: Buffer): PNG {
  if (buffer.length === 0) {
    throw new ScreenshotDecodeError(side, 'the buffer is empty (0 bytes)');
  }

  let png: PNG;
  try {
    png = PNG.sync.read(buffer);
  } catch (error: unknown) {
    throw new ScreenshotDecodeError(side, error instanceof Error ? error.message : String(error));
  }

  if (png.width === 0 || png.height === 0) {
    throw new ScreenshotDecodeError(
      side,
      `the PNG decoded to an empty image (${String(png.width)}x${String(png.height)})`,
    );
  }
  return png;
}

/**
 * Copy a decoded screenshot into the top-left corner of a comparison canvas.
 *
 * Two things force this copy rather than handing pngjs's own buffer straight to pixelmatch. First,
 * screenshots of different heights have to be compared on a shared canvas, and the area only one
 * of them covers must read as fully transparent so it counts as changed. Second, pixelmatch reads
 * the pixel data through a Uint32Array view, which throws unless the underlying byte offset is
 * 4-byte aligned; a pooled Buffer is not guaranteed to be. A freshly allocated Uint8Array is.
 */
function paintOntoCanvas(canvas: Uint8Array, canvasWidth: number, source: PNG): void {
  const rowBytes = source.width * 4;
  for (let y = 0; y < source.height; y += 1) {
    const from = y * rowBytes;
    canvas.set(source.data.subarray(from, from + rowBytes), y * canvasWidth * 4);
  }
}

/**
 * Compare two PNG screenshots pixel by pixel.
 *
 * Both arguments are PNG bytes; this module never takes a browser, a page or a file path. Capture
 * the screenshots however you like and pass the buffers in.
 *
 * Screenshots of different sizes are NOT an error and do not throw: they are compared on a canvas
 * as large as the union of the two, with the area each image does not cover left transparent. The
 * uncovered area therefore counts as changed, `sizeChanged` is set, and both original sizes are
 * reported — a layout that grew by 200px is a finding, not a crash.
 */
export function compareScreenshots(
  baselinePng: Buffer,
  candidatePng: Buffer,
  options: CompareScreenshotsOptions = {},
): ScreenshotComparison {
  const threshold = options.threshold ?? DEFAULT_PIXEL_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new RangeError(
      `A pixel threshold must be a number between 0 and 1, received ${String(threshold)}.`,
    );
  }
  const antialiasing = options.antialiasing ?? DEFAULT_ANTIALIASING_MODE;

  const baseline = decodePng('baseline', baselinePng);
  const candidate = decodePng('candidate', candidatePng);

  const width = Math.max(baseline.width, candidate.width);
  const height = Math.max(baseline.height, candidate.height);
  const pixelCount = width * height;

  const baselineCanvas = new Uint8Array(pixelCount * 4);
  const candidateCanvas = new Uint8Array(pixelCount * 4);
  paintOntoCanvas(baselineCanvas, width, baseline);
  paintOntoCanvas(candidateCanvas, width, candidate);

  // pixelmatch only ever reports a count, so we run it in mask mode and read the locations back
  // out of the buffer it filled. In mask mode it paints ONLY the pixels it counted as a real
  // difference, at full alpha, over a transparent background — anti-aliased pixels are explicitly
  // left out of the mask — which makes "alpha is 255" exactly equivalent to "this pixel counted".
  const maskCanvas = new Uint8Array(pixelCount * 4);
  const changedPixels = pixelmatch(baselineCanvas, candidateCanvas, maskCanvas, width, height, {
    threshold,
    includeAA: antialiasing === 'count',
    diffMask: true,
  });

  const changeMask = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    changeMask[index] = maskCanvas[index * 4 + 3] === 255 ? 1 : 0;
  }

  let diff: Buffer | undefined;
  if (options.produceDiffImage === true) {
    // The mask above is machine-readable but unreadable to a person: it shows the changed pixels
    // with no surrounding page to locate them against. This second pass produces pixelmatch's
    // standard overlay instead — the baseline faded to grey with the changed pixels in red — which
    // is the image worth attaching to a failing report.
    const diffPng = new PNG({ width, height });
    pixelmatch(baselineCanvas, candidateCanvas, diffPng.data, width, height, {
      threshold,
      includeAA: antialiasing === 'count',
    });
    diff = PNG.sync.write(diffPng);
  }

  return {
    changedPixels,
    changedRatio: changedPixels / pixelCount,
    width,
    height,
    diff,
    sizeChanged: baseline.width !== candidate.width || baseline.height !== candidate.height,
    baselineSize: { width: baseline.width, height: baseline.height },
    candidateSize: { width: candidate.width, height: candidate.height },
    changeMask,
  };
}
