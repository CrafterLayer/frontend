/**
 * The custom property the editor canvas sets on its frame's root: one `vh` of the viewport the
 * page is designed for, in pixels (preview-fix 2026-10-12).
 *
 * ## The failure this removes
 *
 * The canvas zooms by scaling its frame and making the frame `100 / zoom` percent tall, so the
 * scaled frame still fills the editor column (EditorCanvas). The frame's own viewport — what `vh`
 * measures — therefore grew with every step of zoom-out: at "Fit · 57%" in a 900px window a
 * custom region's `min-height: 70vh` was 999px on the canvas and 604px in Preview. An AI story
 * sized its Pixi stage in `vh` and its HTML cards in pixels, so the canvas showed a roomy scene and
 * Preview the same cards covering it. Zoom must change only how the page is presented, never its
 * layout.
 *
 * ## The rule
 *
 * Inside custom-code regions (their scoped `css` and the live utilities), every viewport-height
 * length becomes `calc(N * var(--ck-vh, 1vh))`. The canvas sets `--ck-vh` to its zoom-1 viewport
 * (`useCanvasZoom`); Preview and a published page never set it, so there the fallback is the real
 * `vh` and nothing changes.
 */
export const CANVAS_VIEWPORT_HEIGHT_PROPERTY = '--ck-vh';

/*
  Skipped whole (group 1): strings, `url(…)`, comments and the preludes of `@media`, `@container`
  and `@supports`, where a `var()` would invalidate the condition. A length (groups 2 and 3) must
  follow a value boundary, so a selector such as `.min-h-\[70vh\]` or `.h-70vh` is never touched.
*/
const VIEWPORT_HEIGHT =
  /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|url\([^)]*\)|\/\*[\s\S]*?\*\/|@(?:media|container|supports)[^{;]*)|(?<=^|[\s:(,+*/])(-?(?:\d+\.?\d*|\.\d+))([sld]?vh)(?![\w-])/giu;

/** `css` with each viewport-height length (`vh`, `svh`, `lvh`, `dvh`) read through `--ck-vh`. */
export function canvasViewportHeightUnits(css: string): string {
  return css.replace(
    VIEWPORT_HEIGHT,
    (match: string, skipped: string | undefined, amount: string, unit: string) =>
      skipped === undefined
        ? `calc(${amount} * var(${CANVAS_VIEWPORT_HEIGHT_PROPERTY}, 1${unit.toLowerCase()}))`
        : match,
  );
}
