import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
  The real device (device.ts) against stand-ins for @pixi/sound and ZzFX: what matters here is
  the wiring — lazy load, ZzFX's own context closed, effects rendered into buffers and played by
  @pixi/sound, decode through its loaded callback, and the shared library closed by the last user.
  Real playback is covered by the generated-runtime browser fixture.
*/

const fakes = vi.hoisted(() => {
  const state = {
    inits: 0,
    closes: 0,
    from: [] as Record<string, unknown>[],
    zzfxClosed: 0,
    decodeFails: false,
  };
  class FakeContext {
    state = 'suspended';
    resumes = 0;
    starts = 0;
    sampleRate = 48_000;

    resume() {
      this.resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    }

    createBuffer(channels: number, length: number, rate: number) {
      const data = new Float32Array(length);
      return { channels, length, rate, getChannelData: () => data };
    }

    createBufferSource() {
      const start = () => {
        this.starts += 1;
      };
      return { buffer: null, connect: () => undefined, start };
    }

    readonly destination = {};
  }
  const context = new FakeContext();
  const library = {
    supported: true,
    disableAutoPause: false,
    context: { audioContext: context },
    init() {
      state.inits += 1;
    },
    close() {
      state.closes += 1;
    },
  };
  const Sound = {
    from(options: Record<string, unknown>) {
      state.from.push(options);
      const sound = { options };
      const loaded = options['loaded'] as ((error: Error | null, s?: unknown) => void) | undefined;
      if (loaded !== undefined) {
        queueMicrotask(() => {
          if (state.decodeFails) loaded(new Error('Unable to decode file'));
          else loaded(null, sound);
        });
      }
      return sound;
    },
  };
  const ZZFX = {
    volume: 0.3,
    sampleRate: 44_100,
    audioContext: {
      close() {
        state.zzfxClosed += 1;
        return Promise.resolve();
      },
    },
    buildSamples: (...params: (number | undefined)[]) =>
      params[2] === 0 ? [] : [0, 0.5, -0.5, 0.25],
  };
  return { state, context, library, Sound, ZZFX };
});

vi.mock('@pixi/sound', () => ({ sound: fakes.library, Sound: fakes.Sound }));
vi.mock('zzfx', () => ({ ZZFX: fakes.ZZFX }));

async function backend() {
  vi.resetModules();
  const { createPixiSoundBackend } = await import('./device');
  return createPixiSoundBackend();
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', function AudioContext() {
    /* only its presence is read */
  });
  Object.assign(fakes.state, { inits: 0, closes: 0, from: [], zzfxClosed: 0, decodeFails: false });
  fakes.context.state = 'suspended';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('audio device (@pixi/sound + ZzFX)', () => {
  it('resolves null without Web Audio, loading neither engine', async () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(await (await backend()).open()).toBeNull();
    expect(fakes.state.zzfxClosed).toBe(0);
  });

  it('closes ZzFX’s own context, disables blur auto-pause and resumes inside the gesture', async () => {
    const device = await (await backend()).open();
    expect(device).not.toBeNull();
    expect(fakes.state.zzfxClosed).toBe(1);
    expect(fakes.ZZFX.sampleRate).toBe(44_100);
    expect(fakes.library.disableAutoPause).toBe(true);
    expect(device?.running).toBe(false);
    device?.resume();
    expect(fakes.context.resumes).toBe(1);
    expect(fakes.context.starts).toBe(1);
    expect(device?.running).toBe(true);
    device?.resume();
    expect(fakes.context.resumes).toBe(1);
  });

  it('renders effects into buffers @pixi/sound plays, and decodes tracks', async () => {
    const device = await (await backend()).open();
    const effect = device?.synth([1, 0, 440]);
    expect(effect).toBeDefined();
    const buffer = fakes.state.from[0]?.['source'] as { length: number; rate: number };
    expect(buffer).toMatchObject({ length: 4, rate: 44_100 });
    expect(fakes.state.from[0]?.['preload']).toBe(true);
    expect(device?.synth([1, 0, 0])).toBeNull();
    const bytes = new ArrayBuffer(8);
    await expect(device?.decode(bytes)).resolves.toMatchObject({ options: { source: bytes } });
    fakes.state.decodeFails = true;
    await expect(device?.decode(bytes)).rejects.toThrow('Unable to decode file');
  });

  it('shares one library: the last user closes it and the next gesture re-opens it', async () => {
    const audio = await backend();
    const first = await audio.open();
    const second = await audio.open();
    first?.release();
    first?.release();
    expect(fakes.state.closes).toBe(0);
    second?.release();
    expect(fakes.state.closes).toBe(1);
    await audio.open();
    expect(fakes.state.inits).toBe(1);
  });
});
