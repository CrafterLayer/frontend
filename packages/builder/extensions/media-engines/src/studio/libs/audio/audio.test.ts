import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAudio, type AudioEnvironment } from './audio';
import { AUDIO_LIMITS, loadAudioBytes } from './load';
import { SFX_PRESET_NAMES, sfxParams } from './presets';
import type { AudioBackend, AudioDevice, AudioOptions, AudioSceneLike } from './types';

class FakeInstance {
  stopped = false;
  readonly ends: (() => void)[] = [];

  constructor(public volume: number) {}

  stop(): void {
    this.stopped = true;
  }

  on(event: string, fn: () => void): this {
    if (event === 'end') this.ends.push(fn);
    return this;
  }
}

class FakeSound {
  volume = 1;
  muted = false;
  paused = false;
  destroyed = false;
  stops = 0;
  readonly plays: { volume?: number; loop?: boolean }[] = [];
  readonly instances: FakeInstance[] = [];

  play(options: { volume?: number; loop?: boolean } = {}): FakeInstance {
    this.plays.push(options);
    const instance = new FakeInstance(options.volume ?? 1);
    this.instances.push(instance);
    return instance;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): void {
    this.stops += 1;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

function fakeBackend(options: { fail?: boolean; unsupported?: boolean } = {}) {
  const sounds: FakeSound[] = [];
  const synthCalls: (number | undefined)[][] = [];
  const device = {
    running: true,
    resumes: 0,
    releases: 0,
    resume() {
      this.resumes += 1;
    },
    synth(params: readonly (number | undefined)[]) {
      synthCalls.push([...params]);
      const sound = new FakeSound();
      sounds.push(sound);
      return sound;
    },
    decode(bytes: ArrayBuffer) {
      if (options.fail === true || bytes.byteLength === 0)
        return Promise.reject(new Error('Unable to decode file'));
      const sound = new FakeSound();
      sounds.push(sound);
      return Promise.resolve(sound);
    },
    release() {
      this.releases += 1;
    },
  };
  const open = vi.fn(() =>
    Promise.resolve(options.unsupported === true ? null : (device as AudioDevice)),
  );
  return { backend: { open } as AudioBackend, open, device, sounds, synthCalls };
}

const WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZF';
const flush = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

function setup(
  options: AudioOptions = {},
  scene: Partial<AudioSceneLike> = {},
  backendOptions: Parameters<typeof fakeBackend>[0] = {},
) {
  const host = document.createElement('div');
  const root = document.createElement('div');
  host.appendChild(root);
  document.body.appendChild(host);
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  const fake = fakeBackend(backendOptions);
  const disposers: (() => void)[] = [];
  const warnings: string[] = [];
  const environment: AudioEnvironment = { warn: (message) => warnings.push(message) };
  const audio = createAudio(
    fake.backend,
    { canvas, dispose: (fn) => disposers.push(fn), ...scene },
    options,
    environment,
  );
  const gesture = async (target: EventTarget = root) => {
    target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flush();
  };
  return { ...fake, host, root, audio, disposers, warnings, gesture };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('audio — gesture gate and editor', () => {
  it('opens nothing before a gesture inside the scene, then opens once', async () => {
    const { audio, open, gesture, root } = setup();
    expect(audio.sfx('coin')).toBe(false);
    expect(audio.unlocked).toBe(false);
    await gesture(document.body);
    expect(open).not.toHaveBeenCalled();
    await gesture(root.querySelector('canvas') ?? root);
    await gesture();
    expect(open).toHaveBeenCalledTimes(1);
    expect(audio.unlocked).toBe(true);
    expect(audio.sfx('coin')).toBe(true);
  });

  it('is silent on the editor canvas: no toggle, no listeners, no device', async () => {
    const { audio, open, gesture, root } = setup({}, { editor: true });
    expect(audio.music.play(WAV)).toBe(false);
    expect(audio.sfx('jump')).toBe(false);
    await gesture();
    expect(open).not.toHaveBeenCalled();
    expect(root.querySelector('[data-ck-audio-toggle]')).toBeNull();
  });

  it('holds the effects the opening gesture asks for, and only a few', async () => {
    const { audio, gesture, synthCalls, root } = setup();
    root.dispatchEvent(new Event('keydown', { bubbles: true }));
    for (let i = 0; i < 6; i += 1) audio.sfx('jump');
    await gesture();
    expect(synthCalls).toHaveLength(1);
  });

  it('refuses to mount without a scene or root, and keeps the scene running without Web Audio', async () => {
    const backend = fakeBackend().backend;
    expect(() => createAudio(backend, undefined)).toThrow(TypeError);
    const { audio, gesture, warnings } = setup({}, {}, { unsupported: true });
    await gesture();
    expect(audio.unlocked).toBe(false);
    expect(audio.sfx('coin')).toBe(false);
    expect(warnings).toEqual(['this browser has no Web Audio; the scene continues silent']);
  });
});

describe('audio — music and the mute toggle', () => {
  it('queues music until the gesture and renders an accessible toggle at once', async () => {
    const { audio, root, gesture, sounds, disposers } = setup();
    expect(audio.music.play(WAV, { volume: 0.5 })).toBe(true);
    const toggle = root.querySelector<HTMLButtonElement>('button[data-ck-audio-toggle]');
    expect(toggle?.getAttribute('aria-label')).toBe('Mute sound');
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(toggle?.type).toBe('button');
    expect(audio.music.playing).toBe(false);
    expect(audio.music.current).toBe(WAV);
    await gesture();
    expect(audio.music.playing).toBe(true);
    expect(sounds[0]?.plays).toEqual([{ loop: true, volume: 0.5 }]);
    expect(sounds[0]?.volume).toBe(0.8);
    toggle?.click();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(audio.muted).toBe(true);
    expect(sounds[0]?.muted).toBe(true);
    expect(audio.sfx('coin')).toBe(false);
    expect(disposers).toHaveLength(1);
  });

  it('labels the toggle in Arabic on an Arabic page', () => {
    const { host, root, audio } = setup();
    host.setAttribute('lang', 'ar');
    audio.music.play(WAV);
    expect(root.querySelector('[data-ck-audio-toggle]')?.getAttribute('aria-label')).toBe(
      'كتم الصوت',
    );
  });

  it('refuses unadmitted URLs and bounds the number of tracks', () => {
    const { audio, warnings } = setup();
    for (const url of ['http://example.com/a.mp3', 'javascript:alert(1)', 'data:image/png;x', '']) {
      expect(audio.music.play(url)).toBe(false);
    }
    expect(warnings).toEqual(['music URLs must be https:, data:audio/ or blob:']);
    for (let i = 0; i < AUDIO_LIMITS.tracks; i += 1)
      expect(audio.music.play(`data:audio/wav;base64,UklG${String(i)}`)).toBe(true);
    expect(audio.music.play('data:audio/wav;base64,UklGeg==')).toBe(false);
  });

  it('logs a track that fails once and keeps the scene running', async () => {
    const { audio, gesture, warnings } = setup({}, {}, { fail: true });
    audio.music.play(WAV);
    await gesture();
    await flush();
    expect(audio.music.playing).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/could not load music .*Unable to decode file/u);
    expect(audio.sfx('blip')).toBe(true);
  });

  it('cross-fades to a new track, stops with a fade, and adjusts the same track in place', async () => {
    vi.useFakeTimers();
    const { audio, gesture, sounds } = setup();
    await gesture();
    audio.music.play(WAV, { fadeMs: 300, volume: 0.6 });
    await flush();
    const first = sounds[0]?.instances[0];
    expect(first?.volume).toBe(0);
    vi.advanceTimersByTime(400);
    expect(first?.volume).toBeCloseTo(0.6);
    audio.music.play(WAV, { volume: 0.2 });
    expect(sounds[0]?.instances).toHaveLength(1);
    expect(first?.volume).toBeCloseTo(0.2);
    audio.music.play('data:audio/ogg;base64,T2dnUw==', { fadeMs: 200 });
    await flush();
    vi.advanceTimersByTime(300);
    expect(first?.stopped).toBe(true);
    audio.music.stop({ fadeMs: 100 });
    expect(audio.music.playing).toBe(false);
    vi.advanceTimersByTime(200);
    expect(sounds[1]?.instances[0]?.stopped).toBe(true);
  });
});

describe('audio — effects, volume, visibility and disposal', () => {
  it('synthesises each distinct effect once and bounds simultaneous voices', async () => {
    const { audio, gesture, synthCalls, warnings } = setup();
    await gesture();
    for (let i = 0; i < AUDIO_LIMITS.voices; i += 1) expect(audio.sfx('coin')).toBe(true);
    await flush();
    expect(audio.sfx('coin')).toBe(false);
    expect(synthCalls).toHaveLength(1);
    expect(audio.sfx('nope')).toBe(false);
    expect(audio.sfx('nope')).toBe(false);
    expect(audio.sfx([1, 'x'] as never)).toBe(false);
    expect(warnings).toEqual(['unknown sound effect "nope"', 'unknown sound effect list']);
  });

  it('applies the master volume and mute to every owned sound', async () => {
    const { audio, gesture, sounds } = setup({ volume: 2 });
    expect(audio.volume).toBe(1);
    await gesture();
    audio.sfx('hit', { volume: 0.3 });
    audio.volume = 0.25;
    expect(sounds[0]?.volume).toBe(0.25);
    expect(sounds[0]?.plays[0]).toEqual({ volume: 0.3 });
    audio.mute();
    expect(sounds[0]?.muted).toBe(true);
    audio.unmute();
    expect(sounds[0]?.muted).toBe(false);
  });

  it('pauses on a hidden page and resumes when it returns', async () => {
    const { audio, gesture, sounds } = setup();
    await gesture();
    audio.music.play(WAV);
    await flush();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sounds[0]?.paused).toBe(true);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sounds[0]?.paused).toBe(false);
    hidden.mockRestore();
  });

  it('dispose stops and releases everything, once, and ignores later gestures', async () => {
    const { audio, gesture, sounds, device, root, open } = setup();
    audio.music.play(WAV);
    await gesture();
    audio.sfx('laser');
    audio.dispose();
    audio.dispose();
    expect(sounds.every((sound) => sound.destroyed && sound.stops === 1)).toBe(true);
    expect(device.releases).toBe(1);
    expect(root.querySelector('[data-ck-audio-toggle]')).toBeNull();
    expect(audio.music.play(WAV)).toBe(false);
    await gesture();
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('audio — presets and loading', () => {
  it('validates and bounds ZzFX parameter lists', () => {
    expect(SFX_PRESET_NAMES).toEqual([
      'jump',
      'coin',
      'hit',
      'explode',
      'powerup',
      'click',
      'laser',
      'blip',
      'step',
      'win',
      'lose',
    ]);
    expect(sfxParams('toString')).toBeUndefined();
    expect(sfxParams([1, 0.05, 99_999, 30, 30])).toEqual([1, 0.05, 20_000, 1, 1]);
    expect(sfxParams([1, Number.NaN])).toBeUndefined();
    expect(sfxParams(new Array(22).fill(0))).toBeUndefined();
    expect(sfxParams([, null, 3])).toEqual([undefined, undefined, 3]);
  });

  it('renders every preset with the real ZzFX builder to a short, finite effect', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        close() {
          return Promise.resolve();
        }
      },
    );
    const { ZZFX } = await import('zzfx');
    vi.unstubAllGlobals();
    for (const name of SFX_PRESET_NAMES) {
      const samples = ZZFX.buildSamples(...(sfxParams(name) ?? []));
      expect(samples.length).toBeGreaterThan(100);
      expect(samples.length).toBeLessThan(ZZFX.sampleRate * 2);
      expect(samples.every((value) => Number.isFinite(value))).toBe(true);
      expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.01);
    }
  });

  it('decodes data: URLs in-process and bounds fetched tracks', async () => {
    const signal = new AbortController().signal;
    const bytes = await loadAudioBytes('data:audio/wav;base64,UklGRg==', undefined, signal);
    expect(new TextDecoder().decode(bytes)).toBe('RIFF');
    await expect(loadAudioBytes('ftp://x/a.mp3', undefined, signal)).rejects.toThrow(TypeError);
    const big = vi.fn(() =>
      Promise.resolve(
        new Response('x', { headers: { 'content-length': String(AUDIO_LIMITS.bytes + 1) } }),
      ),
    );
    await expect(loadAudioBytes('https://cdn.test/a.mp3', big, signal)).rejects.toThrow(
      /too large/u,
    );
    const missing = vi.fn(() => Promise.resolve(new Response('', { status: 404 })));
    await expect(loadAudioBytes('https://cdn.test/a.mp3', missing, signal)).rejects.toThrow(
      /HTTP 404/u,
    );
    const ok = vi.fn(() => Promise.resolve(new Response('OggS')));
    const fetched = await loadAudioBytes(' https://cdn.test/a.ogg ', ok, signal);
    expect(fetched.byteLength).toBe(4);
    expect(ok).toHaveBeenCalledWith('https://cdn.test/a.ogg', { signal, credentials: 'omit' });
  });
});
