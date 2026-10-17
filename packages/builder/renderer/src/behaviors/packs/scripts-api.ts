/*
  The `ck` API a region script receives, and the crash guard's window state (free-code mode,
  2026-10-09). Types only, split from `scripts.ts` (preview-fix 2026-10-12): that pack is serialised
  with `Function.prototype.toString`, so these declarations vanish from it either way, and the
  pack re-exports them, so every import site keeps reading them from `./scripts`.
*/

// pixi-studio:runtime-wiring additions (2026-10-10)
/** A script parameter's value (DESIGN §A.1 `ScriptParamValue`). */
export type CkScriptParamValue = number | string | boolean | readonly string[];

/** `ck.sound.analyser()` per frame: zeros until the reader unmutes (DESIGN §C.1). */
export interface CkAudioBands {
  readonly level: number;
  readonly bass: number;
  readonly mid: number;
  readonly treble: number;
  readonly beat: boolean;
  readonly active: boolean;
}

/**
 * `ck.sound` (DESIGN §C.1, §C.3): a lazy proxy onto `assets/ck-sound.js`. On the editor canvas it
 * is a silent stub (`play` returns false, `analyser` returns zeros). Elsewhere the first use loads
 * the engine; nothing sounds before the reader's own gesture unmutes it (muted by default).
 */
export interface CkSoundApi {
  /** A bank id, `lib:<projectSoundId>`, `asset:<assetId>` or zzfx numbers. False when nothing played. */
  play(ref: string | readonly number[], options?: Readonly<Record<string, unknown>>): boolean;
  /** An ambient bed while the region is visible (never under reduced motion); returns its stop. */
  ambient(ref: string | readonly number[], options?: Readonly<Record<string, unknown>>): () => void;
  analyser(): CkAudioBands;
  readonly muted: boolean;
  readonly unlocked: boolean;
  setMuted(muted: boolean): void;
  onChange(fn: () => void): void;
}

/** `ck.scene(options)` (DESIGN §B.2 `SceneOptions`). Write `libs` as a literal array. */
export interface CkSceneOptions {
  readonly libs?: readonly string[];
  readonly background?: string | null;
  /** The canvas takes pointer events (never on the editor canvas). */
  readonly pointer?: boolean;
  /** Advanced blend modes (`useBackBuffer`). */
  readonly blend?: boolean;
  /** Wants `s.audio` bands (loads ck-sound.js; silent until a gesture). */
  readonly audio?: boolean;
  readonly quality?: 'auto' | 'low' | 'high';
  readonly seed?: number;
  readonly maxFps?: 30 | 60 | 120;
  /**
   * Design-resolution mode (responsive scenes, 2026-10-13): the kit scales `s.world` (this size)
   * to the region; passed through to the kit untouched. `zoom` needs `libs: ['viewport']`.
   */
  readonly design?: {
    readonly width: number;
    readonly height: number;
    readonly fit?: 'contain' | 'cover' | 'width' | 'height';
    readonly align?: 'center' | 'top' | 'bottom';
    readonly zoom?: boolean;
    readonly maxZoom?: number;
  } | null;
}

/**
 * What `ck.scene` hands to `kit.createScene(context)` (the `ck-lib-kit.js` namespace): the stage
 * is already open and every library loaded; the kit builds the `Scene` of DESIGN §B.2 from this
 * and registers its own cleanups through `onDispose`.
 */
export interface CkSceneContext {
  readonly ck: CkScriptApi;
  readonly PIXI: unknown;
  readonly app: unknown;
  readonly canvas: HTMLCanvasElement;
  readonly root: HTMLElement;
  /** The non-kit libraries the options named, by key. */
  readonly lib: Readonly<Record<string, unknown>>;
  readonly options: CkSceneOptions;
  /** The values `ck.params` merged, or `{}` when the script never called it. */
  readonly params: Readonly<Record<string, CkScriptParamValue>>;
  readonly editor: boolean;
  readonly reducedMotion: boolean;
  readonly lang: string;
  readonly rtl: boolean;
  readonly sound: CkSoundApi;
  onDispose(fn: () => void): void;
}
// end pixi-studio:runtime-wiring additions

/** What a region script receives as its one parameter, `ck`. */
export interface CkScriptApi {
  /** The region element (`[data-ck-custom-code]`) to draw inside; `position: relative` if it was static. */
  readonly root: HTMLElement;
  /** True on the editor canvas, false on Preview and on the published site. */
  readonly editor: boolean;
  /** `prefers-reduced-motion: reduce` at mount; the script decides what that means. */
  readonly reducedMotion: boolean;
  /** Cleanup, called on re-run, region removal and page teardown (at once if already disposed). */
  onDispose(fn: () => void): void;
  /** The FULL pixi.js v8 namespace, loaded lazily. */
  pixi(): Promise<unknown>;
  /**
   * A PIXI.Application filling `ck.root`, initialised, destroyed on dispose. Its canvas always
   * fills the region; the renderer follows the region (and emits `app.renderer` `'resize'`) once
   * the script listens for that event — a script that never does keeps its first frame, scaled to
   * cover the region (preview-fix 2026-10-12).
   */
  stage(options?: {
    readonly background?: string | null;
    readonly pointer?: boolean;
    readonly resolution?: number;
    /** pixi-studio (2026-10-10): advanced blend modes (`useBackBuffer`, DESIGN D6). */
    readonly blend?: boolean;
  }): Promise<{ PIXI: unknown; app: unknown; canvas: HTMLCanvasElement }>;
  // pixi-studio:runtime-wiring additions (2026-10-10) — DESIGN §B.2
  /**
   * `defaults` merged with the region's `data-ck-params` (the block's `jsParams`): unknown keys
   * dropped, each value coerced to its default's type. A params edit re-runs the region.
   */
  params<T extends Record<string, CkScriptParamValue>>(defaults: T): T;
  /**
   * Loads `assets/ck-lib-<key>.js` per key (pixi first for Pixi-bound keys) and resolves
   * `{ [key]: namespace }`, one namespace per document. Write the keys LITERALLY.
   */
  use(...keys: readonly (string | readonly string[])[]): Promise<Record<string, unknown>>;
  /** stage + use('kit', ...libs) + kit.createScene: the one stable scene API. */
  scene(options?: CkSceneOptions): Promise<unknown>;
  readonly sound: CkSoundApi;
  /** `<html lang>` (or the nearest `lang`) and whether the region reads right to left. */
  readonly lang: string;
  readonly rtl: boolean;
  // end pixi-studio:runtime-wiring additions
}

/** The crash guard lives on the frame's window, so every region's mount shares it. */
export interface ScriptsGuard {
  /** The previous session froze while a script's synchronous part was running. */
  paused: boolean;
  /** The localStorage flag is set until the next task. */
  armed: boolean;
  /** Paused sessions only: the code each region (by id) had when it was first seen. */
  seen: Record<string, string>;
}

export interface ScriptsHost {
  ckJsGuard?: ScriptsGuard;
}
