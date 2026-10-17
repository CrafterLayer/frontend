/*
  The real audio device behind `s.lib.audio` (game libraries, 2026-10-12): @pixi/sound (MIT) for
  decoding and playing every sound through one AudioContext, and ZzFX (MIT) to render procedural
  effects into AudioBuffers that @pixi/sound then plays — so master volume, mute and pause cover
  both.

  Both packages create an AudioContext the moment their module runs (@pixi/sound's shared
  `sound` library, ZzFX's `ZZFX.audioContext`). Browsers refuse audio before a gesture, and a
  scene must not open audio hardware it never uses, so neither module runs at load: the bundle
  reaches them only through `import()` (inlined by the single-file build, evaluated on the first
  call), and `open()` is only called from a gesture inside the scene. ZzFX's own context is closed
  at once — only its sample builder is used.

  @pixi/sound's library is one per document. Scenes share it and count themselves in and out; the
  last one out closes the AudioContext, and the next gesture re-initialises it.
*/

import type { AudioBackend, AudioDevice, SoundLike } from './types';

type BuildSamples = (...params: (number | undefined)[]) => number[];

interface WebAudioContextLike {
  readonly audioContext: AudioContext;
}

interface SoundLibraryLike {
  readonly supported: boolean;
  readonly context: unknown;
  disableAutoPause: boolean;
  init(): unknown;
  close(): unknown;
}

interface SoundClassLike {
  from(options: Record<string, unknown>): SoundLike;
}

interface Engines {
  readonly library: SoundLibraryLike;
  readonly Sound: SoundClassLike;
  readonly build: BuildSamples;
  readonly sampleRate: number;
}

const SAMPLE_RATE = 44_100;

let engines: Promise<Engines | null> | undefined;
let users = 0;
let closed = false;

function webAudioAvailable(): boolean {
  const scope = globalThis as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return typeof scope.AudioContext === 'function' || typeof scope.webkitAudioContext === 'function';
}

async function loadEngines(): Promise<Engines | null> {
  if (!webAudioAvailable()) return null;
  const [pixiSound, zzfx] = await Promise.all([import('@pixi/sound'), import('zzfx')]);
  const library = pixiSound.sound as unknown as SoundLibraryLike;
  if (!library.supported) return null;
  const zz = zzfx.ZZFX;
  try {
    void zz.audioContext.close();
  } catch {
    // Already closed or never created: nothing to release.
  }
  zz.sampleRate = SAMPLE_RATE;
  return {
    library,
    Sound: pixiSound.Sound as unknown as SoundClassLike,
    build: (...params) => zz.buildSamples(...params),
    sampleRate: SAMPLE_RATE,
  };
}

function contextOf(library: SoundLibraryLike): AudioContext | undefined {
  return (library.context as Partial<WebAudioContextLike> | null)?.audioContext ?? undefined;
}

function openDevice(found: Engines): AudioDevice {
  const { library, Sound, build, sampleRate } = found;
  if (closed) {
    library.init();
    closed = false;
  }
  // Pausing on window blur would also pause inside an editor preview iframe the moment focus
  // returns to the host; the scene pauses on document.hidden instead (audio.ts).
  library.disableAutoPause = true;
  users += 1;
  let released = false;
  return {
    get running() {
      return contextOf(library)?.state === 'running';
    },
    resume() {
      const context = contextOf(library);
      if (context === undefined || context.state === 'running') return;
      void context.resume().catch(() => undefined);
      // iOS unlocks only once a buffer has played inside the gesture.
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22_050);
      source.connect(context.destination);
      source.start(0);
    },
    synth(params) {
      const context = contextOf(library);
      if (context === undefined) return null;
      const samples = build(...params);
      if (samples.length === 0) return null;
      const buffer = context.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);
      return Sound.from({ source: buffer, preload: true });
    },
    decode(bytes) {
      return new Promise<SoundLike>((resolve, reject) => {
        Sound.from({
          source: bytes,
          preload: true,
          loaded(error: Error | null, sound?: SoundLike) {
            if (error !== null || sound === undefined) reject(error ?? new Error('audio: decode'));
            else resolve(sound);
          },
        });
      });
    },
    release() {
      if (released) return;
      released = true;
      users -= 1;
      if (users > 0) return;
      library.close();
      closed = true;
    },
  };
}

/** The production backend: lazy @pixi/sound + ZzFX, opened from a gesture. */
export function createPixiSoundBackend(): AudioBackend {
  return {
    async open() {
      engines ??= loadEngines().catch((error: unknown) => {
        engines = undefined;
        throw error;
      });
      const found = await engines;
      return found === null ? null : openDevice(found);
    },
  };
}
