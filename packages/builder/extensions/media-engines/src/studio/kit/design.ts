/*
  Design-resolution mode for the scene kit (responsive scenes, 2026-10-13).

  `ck.scene({ design: { width: 1280, height: 720, fit, align, zoom } })` gives the scene
  `s.world`: a container whose coordinates are the design size, scaled and centred to fit the
  region on every resize, so a story or a game composed for a desktop stage keeps its whole
  composition on a 390 px phone. `s.pointer` then reads design units; `s.design` says where the
  design sits and what part of design space the region shows (`view`, wider or taller than the
  design where the region letterboxes it).

  A plain scaled Container, not pixi-viewport, by default: fitting a fixed design is one scale
  and one offset per resize (`fitDesign`), and pixi-viewport is a 12 kB camera (drag, pinch,
  wheel, inertia, clamps) a story page or a game screen does not use. `zoom: true` — a big map
  — is where the camera earns its weight: `s.world` is then a pixi-viewport Viewport, built by
  ck-lib-viewport.js (`libs: ['viewport']`, `zoomWorld` in libs/viewport/zoom-world.ts), so that
  code ships only with the scenes that list it. A scene without `design` creates none of this.
*/

import type { SceneApp } from './types';

export type DesignFit = 'contain' | 'cover' | 'width' | 'height';
export type DesignAlign = 'center' | 'top' | 'bottom';

export interface SceneDesignOptions {
  /** The design size in design units (e.g. 1280 × 720, or 720 × 1280 portrait-first). */
  width: number;
  height: number;
  /** contain (default): all of it, letterboxed; cover: fills, cropping; width / height: that side fills. */
  fit?: DesignFit;
  /** Where a letterboxed or cropped design sits vertically (default center). */
  align?: DesignAlign;
  /** Pan and zoom a big world (drag, two-finger pinch, ctrl/⌘ + wheel); needs libs: ['viewport']. */
  zoom?: boolean;
  /** The deepest zoom, as a multiple of the fitted scale (default 4). */
  maxZoom?: number;
}

export interface DesignRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `s.design`: the design and where it sits now. */
export interface SceneDesign {
  readonly width: number;
  readonly height: number;
  /** A pan/zoom camera (`zoom: true`): s.world is a pixi-viewport Viewport. */
  readonly zoom: boolean;
  /** CSS px per design unit (the zoom included). */
  readonly scale: number;
  /**
   * The part of design space the region shows, in design units: wider or taller than the design
   * where the region letterboxes it (paint backdrops over it), inside it where it crops or zooms.
   */
  readonly view: DesignRect;
}

/** The transform `s.world` exposes: a Pixi Container, or a pixi-viewport Viewport. */
export interface DesignWorld {
  x: number;
  y: number;
  readonly scale: { readonly x: number; readonly y: number; set(value: number): void };
  readonly position: { set(x: number, y: number): void };
}

/** What the kit hands ck-lib-viewport.js's `zoomWorld` (zoom: true). */
export interface DesignZoomHost {
  readonly app: unknown;
  readonly canvas: HTMLCanvasElement;
  readonly root: HTMLElement;
  readonly width: number;
  readonly height: number;
  /** As the scene gave them (the camera reads an unknown align as center, maxZoom as 4). */
  readonly align?: DesignAlign | undefined;
  readonly maxZoom?: number | undefined;
  /** False on the editor canvas: no drag, pinch or wheel there. */
  readonly interactive: boolean;
  /** Reduced motion: no inertia, and every move renders at once (the ticker is stopped). */
  readonly calm: boolean;
  render(): void;
}

export interface DesignZoom {
  readonly world: DesignWorld;
  /** The fitted scale and offset for the region's new size; the camera keeps the visitor's zoom. */
  fit(scale: number, x: number, y: number, screenWidth: number, screenHeight: number): void;
  dispose(): void;
}

export type DesignZoomFactory = (host: DesignZoomHost) => DesignZoom;

/** Plain functions, not methods: the kit hands them on unbound. */
export interface DesignRuntime {
  readonly world: DesignWorld;
  readonly design: SceneDesign;
  /** Fit the world to the region's current size (before the scene's own resize callbacks). */
  readonly layout: () => void;
  /** Region CSS px → design units (the pointer tracker's map). */
  readonly map: (x: number, y: number) => [number, number];
  /** `s.ui(px)`: design units that show as px CSS px at the current scale. */
  readonly ui: (px: number) => number;
  readonly dispose: () => void;
}

/**
 * The scale and offset that place a dw × dh design in a sw × sh region (CSS px). An unknown fit
 * reads as contain, an unknown align as center; the design is always centred horizontally. A
 * region with no size gives scale 0: the kit skips the fit then (createDesign's layout).
 */
export function fitDesign(
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  fit: DesignFit = 'contain',
  align: DesignAlign = 'center',
): { scale: number; x: number; y: number } {
  const sx = sw / dw;
  const sy = sh / dh;
  const scale =
    fit === 'cover'
      ? Math.max(sx, sy)
      : fit === 'width'
        ? sx
        : fit === 'height'
          ? sy
          : Math.min(sx, sy);
  const free = sh - dh * scale;
  return {
    scale,
    x: (sw - dw * scale) / 2,
    y: align === 'top' ? 0 : align === 'bottom' ? free : free / 2,
  };
}

export function createDesign(
  PIXI: unknown,
  app: SceneApp,
  // Page code passes it: every field is read defensively.
  given: Readonly<Partial<Record<keyof SceneDesignOptions, unknown>>>,
  viewportLib: unknown,
  host: Pick<DesignZoomHost, 'canvas' | 'root' | 'interactive' | 'calm' | 'render'> & {
    /** The letterbox colour (the canvas clear colour), or null to leave the canvas as it is. */
    readonly letterbox: number | null;
  },
): DesignRuntime {
  const width = Number(given.width);
  const height = Number(given.height);
  if (!(width > 0 && height > 0)) throw new TypeError('design needs width and height');
  const fit = given.fit as DesignFit | undefined;
  const align = given.align as DesignAlign | undefined;
  const zoom = given.zoom === true;
  let camera: DesignZoom | undefined;
  const zoomWorld = (viewportLib as { zoomWorld?: unknown } | undefined)?.zoomWorld;
  if (zoom) {
    if (typeof zoomWorld !== 'function') throw new Error("design zoom needs libs:['viewport']");
    camera = (zoomWorld as DesignZoomFactory)({
      ...host,
      app,
      width,
      height,
      align,
      maxZoom: given.maxZoom as number | undefined,
    });
  }
  const world = camera?.world ?? new (PIXI as { Container: new () => DesignWorld }).Container();
  (app.stage as { addChild(child: unknown): void }).addChild(world);
  const clear = app.renderer.background;
  if (host.letterbox !== null && clear) {
    clear.color = host.letterbox;
    clear.alpha = 1;
  }

  const design: SceneDesign = {
    width,
    height,
    zoom,
    get scale(): number {
      return world.scale.x;
    },
    get view(): DesignRect {
      const k = world.scale.x;
      return {
        x: -world.x / k,
        y: -world.y / k,
        width: app.screen.width / k,
        height: app.screen.height / k,
      };
    },
  };

  function layout(): void {
    const sw = app.screen.width;
    const sh = app.screen.height;
    // A region with no size yet (display:none, not laid out) keeps the last fit.
    if (!(sw > 0 && sh > 0)) return;
    const placed = fitDesign(sw, sh, width, height, fit, align);
    if (camera !== undefined) {
      camera.fit(placed.scale, placed.x, placed.y, sw, sh);
      return;
    }
    world.scale.set(placed.scale);
    world.position.set(placed.x, placed.y);
  }
  layout();

  return {
    world,
    design,
    layout,
    map: (x: number, y: number): [number, number] => [
      (x - world.x) / world.scale.x,
      (y - world.y) / world.scale.y,
    ],
    ui: (px: number): number => px / world.scale.x,
    dispose: (): void => {
      camera?.dispose();
    },
  };
}
