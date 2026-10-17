/*
  `s.lib.audio.create(s, options?)` (game libraries, 2026-10-12): music and sound effects for a
  Studio scene, owned by that scene.

    const audio = s.lib.audio.create(s);              // silent on the editor canvas
    audio.sfx('coin');                                // named ZzFX preset, or a ZzFX list
    audio.music.play(url, { loop: true, volume: 0.5, fadeMs: 800 });
    audio.music.stop({ fadeMs: 600 });
    audio.volume = 0.6; audio.mute(); audio.unmute();

  Rules it enforces so scene code cannot get them wrong:
  - Nothing touches audio hardware before a pointer/key/touch gesture INSIDE the scene's region;
    music requested earlier is queued and starts on that gesture, effects before it are skipped.
  - Whenever music is requested an accessible, bilingual mute toggle is rendered (WCAG 1.4.2).
  - The page going hidden pauses every sound; returning resumes them.
  - Bounded: AUDIO_LIMITS tracks, bytes per track, simultaneous effects and cached effects.
  - A track that fails to load is logged once and the scene keeps running without it.
  - dispose() (also registered with s.dispose) stops and releases every sound and listener.
*/

import { listenForGestures } from '../../../sound/unlock';
import { admittedMediaUrl } from '../shared/media-url';
import { AUDIO_LIMITS, loadAudioBytes } from './load';
import { sfxParams } from './presets';
import { audioLabels, mountAudioToggle, type AudioToggle } from './toggle';
import type {
  AudioBackend,
  AudioDevice,
  AudioOptions,
  AudioSceneLike,
  MusicOptions,
  PlayingLike,
  SceneAudio,
  SoundLike,
} from './types';

interface MusicRequest {
  readonly url: string;
  readonly loop: boolean;
  readonly volume: number;
  readonly fadeMs: number;
}

interface PlayingMusic {
  readonly url: string;
  readonly instance: PlayingLike;
}

export interface AudioEnvironment {
  readonly fetch?: typeof fetch;
  readonly warn?: (message: string) => void;
}

const unit = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

const fadeLength = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(AUDIO_LIMITS.fadeMs, Math.max(0, value))
    : 0;

function silentAudio(): SceneAudio {
  return {
    sfx: () => false,
    music: { play: () => false, stop: () => undefined, playing: false, current: null },
    volume: 0,
    muted: true,
    unlocked: false,
    mute: () => undefined,
    unmute: () => undefined,
    dispose: () => undefined,
  };
}

function isElement(value: unknown): value is HTMLElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { appendChild?: unknown }).appendChild === 'function' &&
    typeof (value as { addEventListener?: unknown }).addEventListener === 'function'
  );
}

export function createAudio(
  backend: AudioBackend,
  // Authored scene code is plain JavaScript: the scene or the options may be anything.
  scene: AudioSceneLike | null | undefined,
  input?: AudioOptions | null,
  environment: AudioEnvironment = {},
): SceneAudio {
  if (scene?.editor === true) return silentAudio();
  const options = input ?? {};
  const mount: unknown = options.root ?? scene?.canvas?.parentElement;
  if (!isElement(mount)) throw new TypeError('audio.create(s) needs the scene (or { root })');
  const root = mount;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const fetcher = environment.fetch ?? win?.fetch.bind(win);
  const warned = new Set<string>();
  const warn = (message: string): void => {
    if (warned.has(message)) return;
    warned.add(message);
    if (environment.warn !== undefined) environment.warn(message);
    else console.warn('[ck-audio]', message);
  };

  let master = unit(options.volume, 0.8);
  let muted = options.muted === true;
  let disposed = false;
  let device: AudioDevice | null | undefined;
  let opening: Promise<void> | undefined;
  let pending: MusicRequest | null = null;
  let current: string | null = null;
  let music: PlayingMusic | null = null;
  let musicToken = 0;
  let toggle: AudioToggle | undefined;
  let hiddenPause = false;
  const aborter = new AbortController();
  const requested = new Set<string>();
  const tracks = new Map<string, Promise<SoundLike | null>>();
  const loaded = new Set<SoundLike>();
  const effects = new Map<string, SoundLike>();
  const voices = new Set<PlayingLike>();
  const timers = new Set<number>();
  const early: { params: (number | undefined)[]; volume: number }[] = [];

  const owned = (): SoundLike[] => [...loaded, ...effects.values()];
  const apply = (sound: SoundLike): void => {
    sound.volume = master;
    sound.muted = muted;
  };

  function fade(instance: PlayingLike, to: number, ms: number, done?: () => void): void {
    const from = instance.volume;
    if (ms <= 0 || win === null) {
      instance.volume = to;
      done?.();
      return;
    }
    const start = Date.now();
    const timer = win.setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / ms);
      instance.volume = from + (to - from) * t;
      if (t < 1) return;
      win.clearInterval(timer);
      timers.delete(timer);
      done?.();
    }, 30);
    timers.add(timer);
  }

  function stopInstance(instance: PlayingLike, ms: number): void {
    fade(instance, 0, ms, () => {
      try {
        instance.stop();
      } catch {
        // Already stopped with its sound.
      }
    });
  }

  function track(url: string, active: AudioDevice): Promise<SoundLike | null> {
    let found = tracks.get(url);
    if (found === undefined) {
      found = loadAudioBytes(url, fetcher, aborter.signal)
        .then((bytes) => active.decode(bytes))
        .then((sound) => {
          if (disposed) {
            sound.destroy();
            return null;
          }
          loaded.add(sound);
          apply(sound);
          return sound;
        })
        .catch((error: unknown) => {
          if (!disposed) {
            const reason = error instanceof Error ? error.message : String(error);
            warn(
              `could not load music ${url.slice(0, 48)} (${reason}); the scene continues silent`,
            );
          }
          return null;
        });
      tracks.set(url, found);
    }
    return found;
  }

  /* Read through a call: a dispose or a newer request may land while a track decodes. */
  const stale = (token: number): boolean => disposed || token !== musicToken;

  async function startMusic(request: MusicRequest, token: number, active: AudioDevice) {
    const sound = await track(request.url, active);
    if (sound === null || stale(token)) return;
    if (music !== null) {
      stopInstance(music.instance, request.fadeMs);
      music = null;
    }
    const instance = await sound.play({
      loop: request.loop,
      volume: request.fadeMs > 0 ? 0 : request.volume,
    });
    if (stale(token)) {
      instance.stop();
      return;
    }
    music = { url: request.url, instance };
    instance.on('end', () => {
      if (music?.instance === instance) music = null;
    });
    if (request.fadeMs > 0) fade(instance, request.volume, request.fadeMs);
  }

  function playEffect(
    active: AudioDevice,
    params: (number | undefined)[],
    volume: number,
  ): boolean {
    if (voices.size >= AUDIO_LIMITS.voices) return false;
    if (!active.running) active.resume();
    const key = params.join(',');
    let sound = effects.get(key);
    if (sound === undefined) {
      const made = active.synth(params);
      if (made === null) return false;
      sound = made;
      if (effects.size >= AUDIO_LIMITS.cache) {
        const [oldestKey, oldest] = effects.entries().next().value ?? [];
        if (oldestKey !== undefined) effects.delete(oldestKey);
        oldest?.destroy();
      }
    } else {
      effects.delete(key);
    }
    effects.set(key, sound);
    apply(sound);
    void Promise.resolve(sound.play({ volume })).then((instance) => {
      if (disposed) return;
      voices.add(instance);
      instance.on('end', () => voices.delete(instance));
    });
    return true;
  }

  function onGesture(): void {
    if (disposed) return;
    if (device !== undefined && device !== null) {
      if (!device.running) device.resume();
      return;
    }
    if (device === null || opening !== undefined) return;
    opening = backend.open().then(
      (opened) => {
        if (disposed) {
          opened?.release();
          return;
        }
        device = opened;
        if (opened === null) {
          warn('this browser has no Web Audio; the scene continues silent');
          return;
        }
        opened.resume();
        for (const effect of early.splice(0)) playEffect(opened, effect.params, effect.volume);
        if (pending !== null) {
          const request = pending;
          pending = null;
          void startMusic(request, musicToken, opened);
        }
      },
      (error: unknown) => {
        opening = undefined;
        warn(`audio could not start (${error instanceof Error ? error.message : String(error)})`);
      },
    );
  }

  const stopGestures = listenForGestures(root, onGesture);

  function onVisibility(): void {
    if (doc.hidden) {
      if (hiddenPause) return;
      hiddenPause = true;
      for (const sound of owned()) sound.pause();
    } else if (hiddenPause) {
      hiddenPause = false;
      for (const sound of owned()) sound.resume();
    }
  }
  doc.addEventListener('visibilitychange', onVisibility);

  function setMuted(next: boolean): void {
    muted = next;
    for (const sound of owned()) apply(sound);
    toggle?.sync(muted);
  }

  function ensureToggle(): void {
    if (toggle !== undefined) return;
    toggle = mountAudioToggle(
      root,
      audioLabels(root, options.labels),
      options.toggle ?? 'top-end',
      () => {
        setMuted(!muted);
      },
    );
    toggle.sync(muted);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    stopGestures();
    doc.removeEventListener('visibilitychange', onVisibility);
    aborter.abort();
    for (const timer of timers) win?.clearInterval(timer);
    timers.clear();
    for (const sound of owned()) {
      try {
        sound.stop();
        sound.destroy();
      } catch {
        // A sound the device already released.
      }
    }
    loaded.clear();
    effects.clear();
    voices.clear();
    music = null;
    pending = null;
    early.length = 0;
    toggle?.remove();
    toggle = undefined;
    device?.release();
  }
  scene?.dispose?.(dispose);

  return {
    sfx(preset, sfxOptions) {
      if (disposed || muted) return false;
      const params = sfxParams(preset);
      if (params === undefined) {
        warn(`unknown sound effect ${typeof preset === 'string' ? `"${preset}"` : 'list'}`);
        return false;
      }
      const volume = unit(sfxOptions?.volume, 1);
      if (device === undefined) {
        // The gesture that opens the device may itself ask for a sound (a first jump, a Start
        // button): hold a few until the device is ready, never more.
        if (opening === undefined || early.length >= 4) return false;
        early.push({ params, volume });
        return true;
      }
      return device !== null && playEffect(device, params, volume);
    },
    music: {
      play(url: string, musicOptions?: MusicOptions) {
        if (disposed) return false;
        const admitted = admittedMediaUrl(url, 'audio');
        if (admitted === undefined) {
          warn('music URLs must be https:, data:audio/ or blob:');
          return false;
        }
        if (!requested.has(admitted) && requested.size >= AUDIO_LIMITS.tracks) {
          warn(`at most ${String(AUDIO_LIMITS.tracks)} music tracks per scene`);
          return false;
        }
        requested.add(admitted);
        ensureToggle();
        const volume = unit(musicOptions?.volume, 1);
        if (music !== null && music.url === admitted && pending === null) {
          // Already playing this track: only its level changes.
          fade(music.instance, volume, fadeLength(musicOptions?.fadeMs));
          current = admitted;
          return true;
        }
        const request: MusicRequest = {
          url: admitted,
          loop: musicOptions?.loop !== false,
          volume,
          fadeMs: fadeLength(musicOptions?.fadeMs),
        };
        current = admitted;
        musicToken += 1;
        if (device !== undefined && device !== null) void startMusic(request, musicToken, device);
        else pending = request;
        return true;
      },
      stop(stopOptions) {
        musicToken += 1;
        pending = null;
        current = null;
        if (music !== null) stopInstance(music.instance, fadeLength(stopOptions?.fadeMs));
        music = null;
      },
      get playing() {
        return music !== null && !disposed;
      },
      get current() {
        return current;
      },
    },
    get volume() {
      return master;
    },
    set volume(value: number) {
      master = unit(value, master);
      for (const sound of owned()) apply(sound);
    },
    get muted() {
      return muted;
    },
    get unlocked() {
      return device !== undefined && device !== null;
    },
    mute: () => {
      setMuted(true);
    },
    unmute: () => {
      setMuted(false);
    },
    dispose,
  };
}
