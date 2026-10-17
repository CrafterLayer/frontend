/*
  The `ck-sound.js` engine's public surface (pixi-studio DESIGN §C.1, binding).
  `ck.sound` in region scripts, the `data-ck-sound` binder and every host
  preview (Studio, Sound library, Inspector Play) speak exactly this.
*/

/** The four buses (the schema's `SoundBus`, restated so the engine needs no studio types). */
export type SoundBus = 'ui' | 'sfx' | 'ambient' | 'music';

/** A bank id, `lib:<project sound id>`, `asset:<asset id>`, `zzfx(…)` or a ZzFX number array. */
export type SoundRef = string | readonly (number | null | undefined)[];

export interface SoundPlayOptions {
  /** 0..1, multiplied with the sound's own volume. */
  volume?: number;
  /** -1 (left) .. 1 (right). */
  pan?: number;
  /** Playback rate, 0.25..4. */
  rate?: number;
  /** Cents. */
  detune?: number;
  bus?: SoundBus;
}

export interface SoundAmbientOptions {
  /** Fade in and out, ms (default 600). */
  fadeMs?: number;
  volume?: number;
  /** The bed plays only while this element intersects the viewport. */
  el?: Element;
  bus?: SoundBus;
}

/** Audio bands for audio-reactive visuals, 0..1; all zero (and `active` false) while silent. */
export interface SoundBands {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
  active: boolean;
}

export interface SoundState {
  muted: boolean;
  unlocked: boolean;
}

export interface CkSound {
  /** Plays a one-shot. False when muted, locked, on the editor canvas, or the ref is unknown. */
  play(ref: SoundRef, options?: SoundPlayOptions): boolean;
  /** Requests a looping bed; returns its stop function. */
  ambient(ref: SoundRef, options?: SoundAmbientOptions): () => void;
  /** This frame's bands (FFT 256, smoothing 0.8, energy-flux beat). */
  analyser(): SoundBands;
  readonly muted: boolean;
  readonly unlocked: boolean;
  setMuted(muted: boolean): void;
  /** Called on every mute/unlock change; returns the unsubscribe. */
  onChange(listener: (state: SoundState) => void): () => void;
  /**
   * Creates and resumes the AudioContext. Call ONLY inside a user gesture handler
   * (the toggle's click, a Play button); it is a no-op while muted.
   */
  unlock(): void;
  /** Binds every `[data-ck-sound]` element in `root` (root included); returns the unbind. */
  bind(root: Element): () => void;
  /** Stops everything, removes every listener and closes the context. */
  dispose(): void;
}

/** A project sound as the export inlines it (`<script type=application/json data-ck-sound-bank>`). */
export interface ProjectSound {
  bus?: SoundBus | undefined;
  volume?: number | undefined;
  loop?: boolean | undefined;
  source:
    | { kind: 'zzfx'; params: readonly number[] }
    | { kind: 'recipe'; recipe: string; params?: Record<string, number> | undefined }
    | { kind: 'asset'; assetId: string };
}

export interface SoundEngineOptions {
  /**
   * The editor canvas: silent always (no context, no binding, no toggle). Published
   * pages and Preview leave it false.
   */
  canvas?: boolean;
  /** Remember the visitor's choice for this session (sessionStorage). Default true. */
  remember?: boolean;
  /** Host previews: project sounds by id (the page's inlined bank is read too). */
  projectSound?: (id: string) => ProjectSound | undefined;
  /** Host previews: the URL of an asset sound (the page's `link[data-ck-sound-asset]` is read too). */
  assetUrl?: (id: string) => string | undefined;
}
