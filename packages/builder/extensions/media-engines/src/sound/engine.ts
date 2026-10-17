/*
  The sound engine (pixi-studio DESIGN §C.1, D12). One per document.

  Rules it enforces, whatever the caller asks:
  - Muted by default. The visitor's "sound on" is remembered for the session
    only (sessionStorage, inside try/catch).
  - One AudioContext, created lazily and resumed ONLY inside a user gesture
    (pointerdown, keydown, touchend, or a click on the toggle or a Play button
    that calls `unlock()`). Before that, `play` returns false and `ambient`
    remembers the request without starting.
  - `visibilitychange` hidden → suspend; visible → resume only if unmuted.
  - Reduced motion → no ambient beds and no audio-reactive bands. UI one-shots
    still play when the visitor turned sound on.
  - At most 16 voices: a new one-shot steals the oldest one-shot; beds are
    never stolen.
  - The editor canvas (`canvas: true`) is silent: no context, no binding.
  - `navigator.audioSession.type = 'ambient'` where it exists, so the page mixes
    with (never interrupts) the visitor's own music and honours the silent switch.
*/

import {
  isSoundRecipeId,
  isRuntimeZzfxParams,
  parseRuntimeZzfx,
  runtimeZzfxParam,
  SOUND_RECIPE_PARAM_KEYS,
  soundPlaybackEntry,
  type SoundRecipeId,
} from '@craftkit/builder-schema';

import { bandsFromSpectrum, createBeatState, SILENT_BANDS } from './analyser';
import { bindSoundElements } from './binder';
import { createSoundGraph, glide, type SoundGraph } from './buses';
import { RECIPES, type RecipeTuning, type RecipeVoice } from './recipes';
import type {
  CkSound,
  ProjectSound,
  SoundAmbientOptions,
  SoundBands,
  SoundBus,
  SoundEngineOptions,
  SoundPlayOptions,
  SoundRef,
  SoundState,
} from './types';
import { listenForGestures } from './unlock';
import { buildZzfxSamples } from './zzfx';

export const MAX_VOICES = 16;
export const SOUND_STORAGE_KEY = 'ck-sound';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
/** How long `play` of an ambient recipe lets it sound (an Inspector/Studio audition). */
const AUDITION_MS = 2500;

type ZzfxList = readonly (number | null | undefined)[];

type Resolved =
  | { kind: 'zzfx'; params: ZzfxList; bus: SoundBus; volume: number }
  | {
      kind: 'recipe';
      recipe: SoundRecipeId;
      params: Record<string, number>;
      bus: SoundBus;
      volume: number;
    }
  | { kind: 'url'; url: string; bus: SoundBus; volume: number };

interface Voice {
  ambient: boolean;
  stop(fadeSeconds: number): void;
}

interface AmbientRequest {
  ref: SoundRef;
  options: SoundAmbientOptions;
  visible: boolean;
  voice: Voice | undefined;
  observer?: IntersectionObserver | undefined;
}

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
const finite = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function contextCtor(win: Window): AudioContextCtor | undefined {
  const host = win as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return host.AudioContext ?? host.webkitAudioContext;
}

/** Project sounds the export inlined: `<script type="application/json" data-ck-sound-bank>`. */
function readPageBank(doc: Document): Record<string, ProjectSound> {
  const bank: Record<string, ProjectSound> = {};
  for (const script of doc.querySelectorAll('script[data-ck-sound-bank]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent || 'null');
    } catch {
      continue;
    }
    const holder = data as { sounds?: unknown } | null;
    const list: unknown =
      holder !== null && typeof holder === 'object' && 'sounds' in holder ? holder.sounds : data;
    const entries: [string, unknown][] = Array.isArray(list)
      ? list.map((entry) => {
          const id = (entry as { id?: unknown } | null)?.id;
          return [typeof id === 'string' ? id : '', entry];
        })
      : list !== null && typeof list === 'object'
        ? Object.entries(list)
        : [];
    for (const [id, entry] of entries) {
      const source = (entry as { source?: { kind?: unknown } } | null)?.source;
      if (id !== '' && source !== undefined && typeof source === 'object') {
        bank[id] = entry as ProjectSound;
      }
    }
  }
  return bank;
}

function tuningOf(params: Record<string, number>): RecipeTuning {
  const tuning: RecipeTuning = { intensity: 0.6, tone: 0.5, tempo: 0.5, maqam: 0 };
  for (const key of SOUND_RECIPE_PARAM_KEYS) {
    if (Object.hasOwn(params, key)) tuning[key] = clamp(finite(params[key], tuning[key]), 0, 1);
  }
  return tuning;
}

/**
 * The engine, for the `ck-sound.js` bundle (sound-entry.ts) and for host previews
 * (Studio, Sound library, Inspector Play) through the editor aggregate.
 */
export function createSoundEngine(win: Window, options: SoundEngineOptions = {}): CkSound {
  const doc = win.document;
  const canvas = options.canvas === true;
  const remember = options.remember !== false && !canvas;

  let muted = true;
  if (remember) {
    try {
      muted = win.sessionStorage.getItem(SOUND_STORAGE_KEY) !== 'on';
    } catch {
      muted = true;
    }
  }
  let unlocked = false;
  let disposed = false;
  let ctx: AudioContext | undefined;
  let graph: SoundGraph | undefined;
  const voices: Voice[] = [];
  const ambients = new Set<AmbientRequest>();
  const listeners = new Set<(state: SoundState) => void>();
  const zzfxBuffers = new Map<string, AudioBuffer>();
  const decoded = new Map<string, Promise<AudioBuffer | undefined>>();
  const cleanups: (() => void)[] = [];
  const beat = createBeatState();
  let spectrum: Uint8Array<ArrayBuffer> | undefined;

  const reduceQuery =
    typeof win.matchMedia === 'function' ? win.matchMedia(REDUCED_MOTION_QUERY) : undefined;
  let reduced = reduceQuery?.matches === true;

  const hidden = (): boolean => doc.visibilityState === 'hidden';
  const canSound = (): boolean =>
    !canvas && !disposed && unlocked && !muted && !hidden() && ctx !== undefined;

  const notify = (): void => {
    const state = { muted, unlocked };
    for (const listener of listeners) listener(state);
  };

  const later = (fn: () => void, ms: number): void => {
    win.setTimeout(fn, ms);
  };

  const ensureContext = (): AudioContext | undefined => {
    if (ctx !== undefined) return ctx;
    const Ctor = contextCtor(win);
    if (Ctor === undefined) return undefined;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      return undefined;
    }
    graph = createSoundGraph(ctx);
    return ctx;
  };

  const setMaster = (on: boolean): void => {
    if (ctx !== undefined && graph !== undefined)
      glide(graph.master.gain, on ? 1 : 0, ctx.currentTime, 0.04);
  };

  /* ── Resolving a ref ─────────────────────────────────────────────────── */

  const assetUrl = (id: string): string | undefined => {
    const fromHost = options.assetUrl?.(id);
    if (fromHost !== undefined) return fromHost;
    for (const link of doc.querySelectorAll('link[data-ck-sound-asset]')) {
      if (link.getAttribute('data-ck-sound-asset') === id) {
        const href = link.getAttribute('href');
        return href === null || href === '' ? undefined : (link as HTMLLinkElement).href || href;
      }
    }
    return undefined;
  };

  const zzfxFrom = (params: unknown, bus: SoundBus, volume: number): Resolved | undefined =>
    isRuntimeZzfxParams(params) ? { kind: 'zzfx', params, bus, volume } : undefined;

  const fromProject = (entry: ProjectSound): Resolved | undefined => {
    const bus: SoundBus = entry.bus ?? (entry.source.kind === 'recipe' ? 'ambient' : 'sfx');
    const volume = clamp(finite(entry.volume, 0.6), 0, 1);
    const { source } = entry;
    if (source.kind === 'zzfx') return zzfxFrom(source.params, bus, volume);
    if (source.kind === 'recipe') {
      return isSoundRecipeId(source.recipe)
        ? {
            kind: 'recipe',
            recipe: source.recipe,
            params: { ...(source.params ?? {}) },
            bus,
            volume,
          }
        : undefined;
    }
    const url = assetUrl(source.assetId);
    return url === undefined ? undefined : { kind: 'url', url, bus, volume };
  };

  const resolve = (ref: SoundRef): Resolved | undefined => {
    if (typeof ref !== 'string') return zzfxFrom(ref, 'sfx', 1);
    if (ref.startsWith('zzfx(')) {
      const params = parseRuntimeZzfx(ref);
      return params === undefined ? undefined : zzfxFrom(params, 'sfx', 1);
    }
    if (ref.startsWith('lib:')) {
      const id = ref.slice(4);
      const entry = options.projectSound?.(id) ?? readPageBank(doc)[id];
      return entry === undefined ? undefined : fromProject(entry);
    }
    if (ref.startsWith('asset:')) {
      const url = assetUrl(ref.slice(6));
      return url === undefined ? undefined : { kind: 'url', url, bus: 'sfx', volume: 1 };
    }
    const entry = soundPlaybackEntry(ref);
    if (entry === undefined) return undefined;
    return entry.kind === 'zzfx'
      ? { kind: 'zzfx', params: entry.params, bus: entry.bus, volume: 1 }
      : {
          kind: 'recipe',
          recipe: entry.id,
          params: { ...entry.params },
          bus: entry.bus,
          volume: 1,
        };
  };

  /* ── Voices ──────────────────────────────────────────────────────────── */

  const zzfxBuffer = (audio: AudioContext, params: ZzfxList): AudioBuffer | undefined => {
    const key = params.join(',');
    const cached = zzfxBuffers.get(key);
    if (cached !== undefined) return cached;
    // Rendered without ZzFX's pitch randomness (it is re-applied per play as a rate jitter).
    const samples = buildZzfxSamples(audio.sampleRate, params, () => 0.5);
    if (samples.length === 0) return undefined;
    const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
    buffer.getChannelData(0).set(samples);
    if (zzfxBuffers.size >= 64) zzfxBuffers.clear();
    zzfxBuffers.set(key, buffer);
    return buffer;
  };

  const decode = (audio: AudioContext, url: string): Promise<AudioBuffer | undefined> => {
    let pending = decoded.get(url);
    if (pending === undefined) {
      pending = win
        .fetch(url)
        .then((response) => response.arrayBuffer())
        .then((bytes) => audio.decodeAudioData(bytes))
        .catch(() => undefined);
      decoded.set(url, pending);
    }
    return pending;
  };

  const release = (voice: Voice): void => {
    const index = voices.indexOf(voice);
    if (index >= 0) voices.splice(index, 1);
  };

  /** A free voice slot: steals the oldest one-shot when all 16 are taken. */
  const takeSlot = (): boolean => {
    if (voices.length < MAX_VOICES) return true;
    const oldest = voices.find((voice) => !voice.ambient);
    if (oldest === undefined) return false;
    oldest.stop(0.02);
    return true;
  };

  const startVoice = (
    resolved: Resolved,
    play: SoundPlayOptions,
    ambient: boolean,
    fadeSeconds: number,
  ): Voice | undefined => {
    const audio = ctx;
    const mix = graph;
    if (audio === undefined || mix === undefined) return undefined;
    const out = audio.createGain();
    out.gain.value = 0;
    let tail: AudioNode = out;
    if (play.pan !== undefined && typeof audio.createStereoPanner === 'function') {
      const panner = audio.createStereoPanner();
      panner.pan.value = clamp(play.pan, -1, 1);
      out.connect(panner);
      tail = panner;
    }
    tail.connect(mix.buses[play.bus ?? resolved.bus]);
    const level = clamp(resolved.volume * clamp(finite(play.volume, 1), 0, 1), 0, 1);
    const rate = clamp(finite(play.rate, 1), 0.25, 4);

    let source: AudioBufferSourceNode | undefined;
    let recipe: RecipeVoice | undefined;
    let stopped = false;

    const voice: Voice = {
      ambient,
      stop(fade) {
        if (stopped) return;
        stopped = true;
        release(voice);
        glide(out.gain, 0, audio.currentTime, fade);
        later(
          () => {
            try {
              source?.stop();
            } catch {
              // never started or already ended
            }
            recipe?.stop();
            out.disconnect();
            if (tail !== out) tail.disconnect();
          },
          fade * 1000 + 40,
        );
      },
    };

    const startBuffer = (buffer: AudioBuffer, jitter: number): void => {
      if (stopped) return;
      const node = audio.createBufferSource();
      node.buffer = buffer;
      node.loop = ambient;
      node.playbackRate.value = rate * (1 + jitter * (Math.random() * 2 - 1));
      if (play.detune !== undefined) node.detune.value = finite(play.detune, 0);
      node.connect(out);
      if (!ambient) {
        node.onended = () => {
          if (!stopped) {
            stopped = true;
            release(voice);
            out.disconnect();
            if (tail !== out) tail.disconnect();
          }
        };
      }
      source = node;
      node.start();
      glide(out.gain, level, audio.currentTime, fadeSeconds);
    };

    if (resolved.kind === 'zzfx') {
      const buffer = zzfxBuffer(audio, resolved.params);
      if (buffer === undefined) {
        out.disconnect();
        return undefined;
      }
      startBuffer(buffer, runtimeZzfxParam(resolved.params, 1));
    } else if (resolved.kind === 'url') {
      void decode(audio, resolved.url).then((buffer) => {
        if (buffer === undefined || !canSound()) voice.stop(0);
        else startBuffer(buffer, 0);
      });
    } else {
      recipe = RECIPES[resolved.recipe]({
        ctx: audio,
        out,
        tuning: tuningOf(resolved.params),
        random: Math.random,
        setTimer: (fn, ms) => win.setTimeout(fn, ms),
        clearTimer: (id) => {
          win.clearTimeout(id);
        },
      });
      glide(out.gain, level, audio.currentTime, fadeSeconds);
      if (!ambient)
        later(() => {
          voice.stop(0.6);
        }, AUDITION_MS);
    }
    voices.push(voice);
    return voice;
  };

  /* ── Ambient beds follow the state ───────────────────────────────────── */

  const fadeOf = (request: AmbientRequest): number =>
    clamp(finite(request.options.fadeMs, 600), 0, 10_000) / 1000;

  const reconcile = (): void => {
    const allowed = canSound() && !reduced;
    for (const request of ambients) {
      const want = allowed && request.visible;
      if (want && request.voice === undefined) {
        const resolved = resolve(request.ref);
        if (resolved !== undefined && takeSlot()) {
          const play: SoundPlayOptions = { bus: request.options.bus ?? 'ambient' };
          if (request.options.volume !== undefined) play.volume = request.options.volume;
          request.voice = startVoice(resolved, play, true, fadeOf(request));
        }
      } else if (!want && request.voice !== undefined) {
        request.voice.stop(fadeOf(request));
        request.voice = undefined;
      }
    }
  };

  const stopOneShots = (): void => {
    for (const voice of voices.slice()) if (!voice.ambient) voice.stop(0.03);
  };

  /* ── State changes ───────────────────────────────────────────────────── */

  const save = (): void => {
    if (!remember) return;
    try {
      win.sessionStorage.setItem(SOUND_STORAGE_KEY, muted ? 'off' : 'on');
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  };

  const unlock = (): void => {
    if (canvas || disposed || muted || hidden()) return;
    const audio = ensureContext();
    if (audio === undefined) return;
    if (audio.state !== 'running') void audio.resume().catch(() => undefined);
    const changed = !unlocked;
    unlocked = true;
    setMaster(true);
    reconcile();
    if (changed) notify();
  };

  const setMuted = (next: boolean): void => {
    if (canvas || disposed || next === muted) return;
    muted = next;
    save();
    if (muted) {
      stopOneShots();
      setMaster(false);
      reconcile();
      if (ctx !== undefined) {
        const audio = ctx;
        later(() => {
          if (muted && audio.state === 'running') void audio.suspend().catch(() => undefined);
        }, 120);
      }
    } else if (unlocked && ctx !== undefined && !hidden()) {
      void ctx.resume().catch(() => undefined);
      setMaster(true);
      reconcile();
    }
    notify();
  };

  if (!canvas) {
    try {
      (win.navigator as Navigator & { audioSession: { type: string } }).audioSession.type =
        'ambient';
    } catch {
      // unsupported or read-only in this browser
    }
    cleanups.push(
      listenForGestures(win, () => {
        if (!muted && (!unlocked || ctx?.state !== 'running')) unlock();
      }),
    );
    const onVisibility = (): void => {
      if (ctx === undefined) return;
      if (hidden()) {
        void ctx.suspend().catch(() => undefined);
      } else if (unlocked && !muted) {
        void ctx.resume().catch(() => undefined);
      }
      reconcile();
    };
    doc.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => {
      doc.removeEventListener('visibilitychange', onVisibility);
    });
    if (reduceQuery !== undefined && typeof reduceQuery.addEventListener === 'function') {
      const onReduce = (): void => {
        reduced = reduceQuery.matches;
        reconcile();
      };
      reduceQuery.addEventListener('change', onReduce);
      cleanups.push(() => {
        reduceQuery.removeEventListener('change', onReduce);
      });
    }
  }

  const api: CkSound = {
    get muted() {
      return muted;
    },
    get unlocked() {
      return unlocked;
    },
    play(ref, play = {}) {
      if (!canSound()) return false;
      const resolved = resolve(ref);
      if (resolved === undefined || !takeSlot()) return false;
      return startVoice(resolved, play, false, 0.005) !== undefined;
    },
    ambient(ref, ambientOptions = {}) {
      if (canvas || disposed) return () => undefined;
      const request: AmbientRequest = {
        ref,
        options: ambientOptions,
        visible: true,
        voice: undefined,
      };
      const { el } = ambientOptions;
      const Observer = (
        win as Window & {
          IntersectionObserver?: new (
            callback: (entries: readonly IntersectionObserverEntry[]) => void,
          ) => IntersectionObserver;
        }
      ).IntersectionObserver;
      if (el !== undefined && Observer !== undefined) {
        request.visible = false;
        request.observer = new Observer((entries) => {
          const last = entries[entries.length - 1];
          if (last !== undefined) request.visible = last.isIntersecting;
          reconcile();
        });
        request.observer.observe(el);
      }
      ambients.add(request);
      reconcile();
      return () => {
        if (!ambients.delete(request)) return;
        request.observer?.disconnect();
        request.voice?.stop(fadeOf(request));
        request.voice = undefined;
      };
    },
    analyser(): SoundBands {
      if (!canSound() || reduced || graph === undefined || ctx === undefined)
        return { ...SILENT_BANDS };
      spectrum ??= new Uint8Array(graph.analyser.frequencyBinCount);
      graph.analyser.getByteFrequencyData(spectrum);
      return bandsFromSpectrum(spectrum, ctx.sampleRate, beat, win.performance.now());
    },
    setMuted,
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unlock,
    bind(root) {
      return canvas || disposed ? () => undefined : bindSoundElements(root, api, win);
    },
    dispose() {
      if (disposed) return;
      for (const voice of voices.slice()) voice.stop(0);
      for (const request of ambients) {
        request.observer?.disconnect();
        request.voice?.stop(0);
      }
      ambients.clear();
      disposed = true;
      for (const cleanup of cleanups.splice(0)) cleanup();
      listeners.clear();
      if (ctx !== undefined) void ctx.close().catch(() => undefined);
    },
  };
  return api;
}
