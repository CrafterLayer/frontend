/*
  The scene kit's contract (pixi-studio DESIGN §B.2). These names are binding across packages:
  runtime-wiring calls `createScene(ck, PIXI, app, canvas, libs, options)` from inside
  `ck.scene()`, presets and agent code use the returned Scene, and CK_API_REFERENCE (schema)
  mirrors SCENE_MEMBERS below.

  Kept free of pixi.js imports: the kit receives the page's ONE Pixi namespace at run time (D2),
  so these are structural types, not Pixi's classes.
*/

import type { Delaunay, Point2Like } from './delaunay';
import type { SceneDesign, SceneDesignOptions } from './design';
import type { FixedStepOptions } from './fixed-step';
import type { SceneInput } from './input';
import type { SceneStory, StoryChapter } from './story';
import type { ScenePaletteApi } from './palette-oklab';
import type { ScenePointer } from './pointer';
import type { Point2 } from './poisson';
import type { SceneScroll } from './scroll';
import type { QualityMode, SceneTime } from './time-governor';

export const STUDIO_LIB_KEYS = [
  'kit',
  'filters',
  'emitter',
  'physics',
  'brush',
  'rough',
  'viewport',
  'anim',
  'fx',
  'dialogue',
  'ink',
  'tilemap',
  'audio',
  'gameai',
  'hud',
  'peeps',
  'procgen',
  'gif',
  'noise',
  'geom',
  'hex',
  'color',
  'lsys',
] as const;
export type StudioLibKey = (typeof STUDIO_LIB_KEYS)[number];
/** Keys whose asset binds to the page's Pixi namespace (D2); the others are plain. */
export const STUDIO_PIXI_BOUND_KEYS: readonly StudioLibKey[] = [
  'kit',
  'filters',
  'emitter',
  'viewport',
  'fx',
  'tilemap',
  'audio',
  'hud',
];

export type ScriptParamValue = number | string | boolean | readonly string[];

export interface SceneOptions {
  libs?: readonly StudioLibKey[];
  background?: string | null;
  pointer?: boolean;
  blend?: boolean;
  audio?: boolean;
  quality?: QualityMode;
  seed?: number;
  maxFps?: 30 | 60 | 120;
  /** Design-resolution mode: draw in s.world at this size; the kit scales it to the region. */
  design?: SceneDesignOptions | null;
  /** The values ck.params merged (runtime-wiring passes them; {} when ck.params was not called). */
  params?: Record<string, ScriptParamValue>;
}

export interface SceneAudioBands {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
  active: boolean;
}

/** `ck.sound` as the kit sees it (sound-engine owns the real one; §C.1/§C.3). */
export interface SceneSound {
  play(ref: unknown, options?: Record<string, unknown>): boolean;
  ambient?(ref: unknown, options?: Record<string, unknown>): () => void;
  analyser?(): SceneAudioBands;
  readonly muted?: boolean;
  readonly unlocked?: boolean;
  setMuted?(muted: boolean): void;
  onChange?(fn: () => void): void;
}

/** The part of `ck` (CkScriptApi) the kit reads. Optional members are runtime-wiring additions. */
export interface SceneHost {
  readonly root: HTMLElement;
  readonly editor: boolean;
  readonly reducedMotion: boolean;
  onDispose(fn: () => void): void;
  readonly lang?: string;
  readonly rtl?: boolean;
  readonly sound?: SceneSound;
  /** Report an error thrown later (inside a tick) the way the region reports script errors. */
  reportError?(error: unknown): void;
}

/** The structural slice of a PIXI.Application the kit drives. */
export interface SceneTicker {
  add(fn: (ticker: SceneTicker) => void, context?: unknown, priority?: number): unknown;
  remove(fn: (ticker: SceneTicker) => void, context?: unknown): unknown;
  start(): void;
  stop(): void;
  readonly started: boolean;
  maxFPS: number;
  readonly deltaMS: number;
}

export interface SceneApp {
  readonly stage: unknown;
  readonly ticker: SceneTicker;
  readonly screen: { readonly width: number; readonly height: number };
  readonly renderer: {
    readonly resolution: number;
    resize?(width: number, height: number, resolution?: number): void;
    /** The clear colour (Pixi's BackgroundSystem): design mode paints the letterbox with it. */
    readonly background?: { color: unknown; alpha: number };
  };
  render(): void;
  resize?(): void;
}

export type SceneLibs = Partial<Record<Exclude<StudioLibKey, 'kit'>, unknown>>;

export interface Scene {
  PIXI: unknown;
  app: SceneApp;
  stage: unknown;
  canvas: HTMLCanvasElement;
  lib: SceneLibs;
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** Design mode: the container in design units, scaled to the region; s.stage otherwise. */
  world: unknown;
  /** Design mode's size, fit and live scale/offset/view; null without `design`. */
  design: SceneDesign | null;
  /** The region is under 600 CSS px wide (a phone): stack or enlarge what the scene lays out. */
  readonly compact: boolean;
  /** The region is taller than wide. */
  readonly portrait: boolean;
  /** Design units that show as `px` CSS px now (px itself without design): readable minimums. */
  ui(px: number): number;
  params: Record<string, ScriptParamValue>;
  palette: ScenePaletteApi;
  pointer: ScenePointer;
  input: SceneInput;
  scroll: SceneScroll;
  time: SceneTime;
  audio: SceneAudioBands;
  random(): number;
  rand(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  noise2(x: number, y: number): number;
  noise3(x: number, y: number, z: number): number;
  fbm(x: number, y: number, octaves?: number): number;
  poisson(width: number, height: number, radius: number, max?: number): Point2[];
  delaunay(points: readonly Point2Like[]): Delaunay;
  count(n: number): number;
  readonly quality: number;
  onQuality(fn: (quality: number) => void): void;
  tick(fn: (time: SceneTime) => void): void;
  fixedTick(fn: (dtSeconds: number) => void, options?: FixedStepOptions): () => void;
  story(chapters: readonly StoryChapter[], initial?: string): SceneStory;
  still(fn: () => void): void;
  onResize(fn: (width: number, height: number) => void): void;
  text(text: string, style?: Record<string, unknown>): unknown;
  words(text: string): string[];
  texture(url: string): Promise<unknown>;
  svg(markup: string): unknown;
  shader(fragment: string, uniforms?: Record<string, unknown>): unknown;
  rt(width?: number, height?: number): unknown;
  sound: SceneSound;
  editor: boolean;
  reducedMotion: boolean;
  rtl: boolean;
  lang: string;
  dir: 1 | -1;
  dispose(fn: () => void): void;
}

/** Every member of the Scene object, in §B.2 order (CK_API_REFERENCE mirrors it; a test holds both). */
export const SCENE_MEMBERS = [
  'PIXI',
  'app',
  'stage',
  'canvas',
  'lib',
  'width',
  'height',
  'dpr',
  'world',
  'design',
  'compact',
  'portrait',
  'ui',
  'params',
  'palette',
  'pointer',
  'input',
  'scroll',
  'time',
  'audio',
  'random',
  'rand',
  'int',
  'pick',
  'shuffle',
  'noise2',
  'noise3',
  'fbm',
  'poisson',
  'delaunay',
  'count',
  'quality',
  'onQuality',
  'tick',
  'fixedTick',
  'story',
  'still',
  'onResize',
  'text',
  'words',
  'texture',
  'svg',
  'shader',
  'rt',
  'sound',
  'editor',
  'reducedMotion',
  'rtl',
  'lang',
  'dir',
  'dispose',
] as const satisfies readonly (keyof Scene)[];

/** What `create(PIXI)` of ck-lib-kit.js returns. */
export interface KitLib {
  readonly version: string;
  createScene(
    ck: SceneHost,
    PIXI: unknown,
    app: SceneApp,
    canvas: HTMLCanvasElement,
    libs: SceneLibs,
    options?: SceneOptions,
  ): Scene;
}
