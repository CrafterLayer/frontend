/**
 * What running a scene found (creative-power Phase 2 E, 2026-10-12) — the `ck-preview:probe`
 * report the preview document posts (scene-probe-frame.ts) and the per-pass report `probeScene`
 * (scene-probe.ts) resolves to. Plain data: it crosses `postMessage` and, from a browser test, the
 * Playwright bridge. Rects are CSS px in the frame's document coordinates.
 */

export interface SceneProbeRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A button, link or field inside the region, as a visitor would meet it. */
export interface SceneProbeControl {
  /** Its accessible text (aria-label, text, value or title), ≤ 48 characters. */
  readonly label: string;
  readonly tag: string;
  readonly rect: SceneProbeRect;
  /** It sits (partly) outside the region, or past the screen's edge. */
  readonly outside: boolean;
  /** What is on top of its centre: the scene's canvas, another element, or nothing (null). */
  readonly covered: 'canvas' | 'other' | null;
}

export interface SceneProbeError {
  readonly message: string;
  /** The line in the region's code, when the stack names it. */
  readonly line: number | null;
}

/** The first visible Start/Next/Play control, clicked once. */
export interface SceneProbeClick {
  readonly label: string;
  /** The click changed the region's text or the canvas (true), changed nothing (false), or the scene was too busy to tell (null). */
  readonly changed: boolean | null;
}

/** One run of the region in one viewport, measured once it settled. */
export interface SceneProbeFrameReport {
  readonly viewport: { readonly width: number; readonly height: number };
  /** The element carrying the code (`ck.root`); null when the document has none. */
  readonly region: SceneProbeRect | null;
  /** The region's largest canvas: its box and its backing size. */
  readonly canvas: {
    readonly rect: SceneProbeRect;
    readonly width: number;
    readonly height: number;
    /** Runtime narrative canvas; extra region height is its intentional scroll span. */
    readonly scrollPinned?: boolean;
  } | null;
  /** The canvas covers the region (2 px tolerance); null without both. */
  readonly covers: boolean | null;
  readonly controls: readonly SceneProbeControl[];
  /** How far the page runs past the screen's right edge, in px. */
  readonly overflowX: number;
  /** The canvas is near-uniform (virtually nothing drawn); null when it could not be read. */
  readonly blank: boolean | null;
  /** The share of sampled pixels unlike the canvas's dominant colour, 0–1. */
  readonly ink: number | null;
  /** Animation frames per second while the scene settled. */
  readonly fps: number | null;
  readonly errors: readonly SceneProbeError[];
  readonly click: SceneProbeClick | null;
  /** The page was hidden at some point (frames were throttled): frame-based verdicts are void. */
  readonly hidden: boolean;
  /** From the frame's start until it measured. */
  readonly settledMs: number;
  /** How long it waited for the canvas before letting the scene settle. */
  readonly waitedMs: number;
  /** How long the scene then ran before it was measured (0: cut short by the deadline). */
  readonly ranMs: number;
  /**
   * A picture of the page as it was measured, before any click (scene-probe-capture.ts), when the
   * probe asked for one (`SceneProbeOptions.thumbnails`); null when it could not be taken.
   */
  readonly thumbnail?: SceneProbeThumbnail | null;
}

/** A small JPEG of what a visitor sees in one pass (visual self-review, 2026-10-13). */
export interface SceneProbeThumbnail {
  /** `data:image/jpeg;base64,…` (or PNG). */
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  /** The share of sampled pixels unlike the picture's dominant colour, 0–1 (near 0: blank). */
  readonly ink: number;
}

export type SceneProbePassName = 'desktop' | 'mobile' | 'reduced-motion';

export interface SceneProbePass {
  readonly name: SceneProbePassName;
  readonly width: number;
  readonly height: number;
  readonly lang: string;
  readonly dir: 'ltr' | 'rtl';
  readonly reducedMotion: boolean;
  /** Click the first visible Start/Next/Play control once. */
  readonly click: boolean;
}

export type SceneProbeFrameResult =
  | { readonly status: 'done'; readonly report: SceneProbeFrameReport }
  | {
      readonly status: 'timeout' | 'aborted' | 'failed';
      readonly report: null;
      readonly failure: string;
    };

export type SceneProbePassReport = SceneProbeFrameResult & {
  readonly pass: SceneProbePass;
  readonly elapsedMs: number;
};

export interface SceneProbeReport {
  readonly version: 1;
  /**
   * `done`: every pass ran; `partial`: the budget ran out first (see `skipped`); `aborted`: the
   * signal stopped it; `unavailable`: no DOM to run it in (Node) — nothing was measured.
   */
  readonly status: 'done' | 'partial' | 'aborted' | 'unavailable';
  /** The code opens a Pixi stage, so a canvas should appear. */
  readonly expectCanvas: boolean;
  /**
   * Every class the region renders had CSS (compiled or written): layout and layering verdicts
   * are trustworthy. False when Tailwind classes went uncompiled.
   */
  readonly stylesComplete: boolean;
  readonly passes: readonly SceneProbePassReport[];
  /** Passes the time budget left no room for. */
  readonly skipped: readonly SceneProbePassName[];
  readonly elapsedMs: number;
}
