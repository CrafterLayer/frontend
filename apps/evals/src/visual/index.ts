/**
 * Visual verification for generated pages.
 *
 * This project generates web pages, and until now nothing checked what they LOOK like. Two
 * failures happen regularly and go unnoticed by every text-level assertion:
 *
 *  1. The agent reports a section as "applied" when the change made no visible difference at all.
 *     A schema assertion passes, the document has the new prop, and the rendered page is byte for
 *     byte what it was. {@link judgeComparison} returns `identical` for that, and under the default
 *     'change' expectation `passed` is false — a no-op edit is a failure, not a pass.
 *  2. A change silently breaks the layout of sections nobody was editing. Tell
 *     {@link judgeComparison} which regions were supposed to change and it separates "the section
 *     I edited changed" from "everything moved", returning `changed-too-much` for the latter.
 *
 * ## What this module is not
 *
 * It never opens a browser, never takes a screenshot, and never touches the filesystem outside
 * `baseline.ts`. It takes PNG bytes. Somebody else — a Playwright run, a headless renderer, a
 * fixture on disk — produces those bytes and feeds them in.
 *
 * ## How to feed it screenshots
 *
 * Capture two PNG buffers of the same page at the same viewport size, one before the edit and one
 * after, and note the bounding boxes of the sections the edit was supposed to touch. Multiply
 * those boxes by the device pixel ratio you captured at, because {@link PixelRect} is in the PNG's
 * own device pixels:
 *
 * ```ts
 * const before = await page.screenshot();          // Buffer of PNG bytes
 * const box = await page.locator('#hero').boundingBox();
 * await applyTheAgentsEdit();
 * const after = await page.screenshot();
 *
 * const comparison = compareScreenshots(before, after, { produceDiffImage: true });
 * const verdict = judgeComparison(comparison, {
 *   expectedRegions: [{ x: box.x * 2, y: box.y * 2, width: box.width * 2, height: box.height * 2 }],
 * });
 * if (!verdict.passed) {
 *   await writeDiffImage(diffDir, 'hero-edit', comparison.diff);
 *   throw new Error(verdict.reason);
 * }
 * ```
 *
 * To check across runs instead of within one, keep the "before" image on disk:
 *
 * ```ts
 * const resolved = await resolveBaseline({ directory: baselineDir, name: 'home', candidate: shot });
 * if (!resolved.comparable) {
 *   console.log(resolved.message);  // a baseline was just recorded; nothing was verified
 *   return;
 * }
 * const verdict = judgeComparison(compareScreenshots(resolved.baseline, shot), {
 *   expectation: 'no-change',       // this page was not supposed to move at all
 * });
 * ```
 *
 * ## The two settings that decide what you can detect
 *
 * {@link DEFAULT_PIXEL_THRESHOLD} and {@link DEFAULT_ANTIALIASING_MODE} both trade sensitivity for
 * stability, and both can make a real change read as zero changed pixels: a colour edit too subtle
 * for the threshold, or a change confined to the soft edges of glyphs and rounded corners under
 * the default 'ignore' anti-aliasing policy. Read their docs before concluding that an `identical`
 * verdict means the agent did nothing.
 */
export {
  compareScreenshots,
  DEFAULT_ANTIALIASING_MODE,
  DEFAULT_PIXEL_THRESHOLD,
  ScreenshotDecodeError,
} from './compare';
export type {
  AntialiasingMode,
  CompareScreenshotsOptions,
  ImageSize,
  ScreenshotComparison,
} from './compare';

export { DEFAULT_UNEXPECTED_CHANGE_RATIO, judgeComparison } from './verdict';
export type {
  PixelRect,
  VisualExpectation,
  VisualVerdict,
  VisualVerdictKind,
  VisualVerdictOptions,
} from './verdict';

export {
  baselinePath,
  diffImagePath,
  InvalidBaselineNameError,
  readBaseline,
  resolveBaseline,
  writeBaseline,
  writeDiffImage,
} from './baseline';
export type { BaselineStatus, ResolvedBaseline, ResolveBaselineRequest } from './baseline';
