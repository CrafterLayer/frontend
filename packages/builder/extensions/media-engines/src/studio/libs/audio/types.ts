/*
  The `audio` Studio library's seams (game libraries, 2026-10-12).

  `audio.ts` owns the behaviour (gesture gate, music, sound effects, volume, mute, visibility,
  disposal); it talks to sound hardware only through `AudioBackend` → `AudioDevice`, which
  `device.ts` implements with @pixi/sound and zzfx, loaded lazily on the first gesture. Unit tests
  pass a fake backend; the generated-runtime browser fixture covers the real one.
*/

/** One playing sound (a @pixi/sound IMediaInstance, structurally). */
export interface PlayingLike {
  volume: number;
  stop(): void;
  on(event: 'end', fn: () => void): unknown;
}

/** One loaded or synthesised sound (a @pixi/sound Sound, structurally). */
export interface SoundLike {
  volume: number;
  muted: boolean;
  play(options?: { volume?: number; loop?: boolean }): PlayingLike | Promise<PlayingLike>;
  pause(): unknown;
  resume(): unknown;
  stop(): unknown;
  destroy(): void;
}

/** The hardware side, available once a gesture opened it. */
export interface AudioDevice {
  /** True when the AudioContext runs (false while the browser still holds it suspended). */
  readonly running: boolean;
  /** Call inside every gesture until `running`: resumes the context (iOS needs a sound too). */
  resume(): void;
  /** A ZzFX parameter list rendered to a playable sound, or null when it cannot be. */
  synth(params: readonly (number | undefined)[]): SoundLike | null;
  /** Encoded audio (mp3, ogg, wav, m4a…) decoded to a playable sound. */
  decode(bytes: ArrayBuffer): Promise<SoundLike>;
  /** This scene no longer needs the device; the last user closes the AudioContext. */
  release(): void;
}

export interface AudioBackend {
  /**
   * Loads the sound engine and opens the AudioContext. Called only from a user gesture inside
   * the scene, never earlier; resolves null when the browser has no Web Audio.
   */
  open(): Promise<AudioDevice | null>;
}

/** The part of the Studio scene `s` the library reads (passed as `create(s)`). */
export interface AudioSceneLike {
  readonly editor?: boolean;
  readonly lang?: string;
  readonly canvas?: { readonly parentElement: HTMLElement | null } | null;
  dispose?(fn: () => void): void;
}

export interface AudioLabels {
  /** The toggle's accessible name; aria-pressed carries the muted state. */
  mute: string;
}

export interface AudioOptions {
  /** Where gestures unlock audio and the mute toggle mounts. Default: the scene's region. */
  root?: HTMLElement;
  /** Master volume 0..1 (default 0.8). */
  volume?: number;
  /** Start muted (the toggle still renders whenever music is requested). */
  muted?: boolean;
  labels?: Partial<AudioLabels>;
  /** Where the toggle sits inside the root (default 'top-end'). */
  toggle?: 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start';
}

export interface MusicOptions {
  loop?: boolean;
  /** 0..1, multiplied by the master volume. */
  volume?: number;
  /** Fade-in length in ms (0..10000). */
  fadeMs?: number;
}

export interface SfxOptions {
  /** 0..1, multiplied by the master volume. */
  volume?: number;
}

export interface MusicControl {
  /** Queues until the first gesture; false for a refused URL, too many tracks, or the editor. */
  play(url: string, options?: MusicOptions): boolean;
  stop(options?: { fadeMs?: number }): void;
  readonly playing: boolean;
  /** The URL last requested (playing, queued or loading), or null. */
  readonly current: string | null;
}

export interface SceneAudio {
  /** A named preset or a ZzFX parameter list; false before the first gesture, muted or in the editor. */
  sfx(preset: string | readonly (number | null | undefined)[], options?: SfxOptions): boolean;
  readonly music: MusicControl;
  volume: number;
  readonly muted: boolean;
  /** True once a gesture inside the scene opened the audio device. */
  readonly unlocked: boolean;
  mute(): void;
  unmute(): void;
  /** Stops and releases every sound, removes the toggle and every listener. Idempotent. */
  dispose(): void;
}
