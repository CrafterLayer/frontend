import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGifLibrary, GIF_VERSION } from '../gif-entry';
import { fakePixi } from '../shared/fake-pixi.test-util';
import { decodeGif } from './decode';
import { base64, encodeGif, type TestFrame } from './gif-encoder.test-util';
import { GIF_LIMITS, inspectGif } from './inspect';
import { readGifBytes } from './load';
import { createGifSprite, type GifControls, type GifRasterEnv } from './sprite';

const PALETTE = [
  [0, 0, 0],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
] as const;
const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 0, 0, 0];

const fill = (n: number, index: number): number[] => Array.from({ length: n }, () => index);

/* RGBA of pixel (x, y) in a decoded frame. */
function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const at = (y * width + x) * 4;
  return Array.from(data.slice(at, at + 4));
}

/* A 4 × 4 red frame, then a 2 × 2 patch at (1, 1) in the given colour. */
function twoFrames(second: Partial<TestFrame> = {}, first: Partial<TestFrame> = {}): Uint8Array {
  return encodeGif(4, 4, PALETTE, [
    { pixels: fill(16, 1), delay: 10, ...first },
    { pixels: fill(4, 2), left: 1, top: 1, width: 2, height: 2, delay: 20, ...second },
  ]);
}

describe('gif inspection', () => {
  it('reads the screen size and counts frames without decoding', () => {
    expect(inspectGif(twoFrames())).toEqual({ width: 4, height: 4, frames: 2 });
  });

  it('refuses what is not a bounded GIF', () => {
    expect(() => inspectGif(new TextEncoder().encode('<svg></svg>'))).toThrow(TypeError);
    expect(() => inspectGif(new Uint8Array(0))).toThrow(TypeError);
    const wide = twoFrames();
    wide[6] = 0xff;
    wide[7] = 0x7f;
    expect(() => inspectGif(wide)).toThrow(RangeError);
    const noFrames = encodeGif(4, 4, PALETTE, []);
    expect(() => inspectGif(noFrames)).toThrow(/no frames/u);
    const empty = twoFrames();
    empty[6] = 0;
    empty[7] = 0;
    expect(() => inspectGif(empty)).toThrow(/no size/u);
    const huge = new Uint8Array(GIF_LIMITS.bytes + 1);
    huge.set(twoFrames());
    expect(() => inspectGif(huge)).toThrow(RangeError);
  });
});

describe('gif decoding', () => {
  it('composites frames over each other and keeps their delays', () => {
    const decoded = decodeGif(twoFrames());
    expect(decoded).toMatchObject({
      width: 4,
      height: 4,
      stride: 1,
      sourceFrames: 2,
      duration: 300,
    });
    const [first, second] = decoded.frames;
    expect(first?.start).toBe(0);
    expect(first?.end).toBe(100);
    expect(second?.start).toBe(100);
    expect(pixel(first?.data ?? new Uint8ClampedArray(), 4, 1, 1)).toEqual(RED);
    expect(pixel(second?.data ?? new Uint8ClampedArray(), 4, 1, 1)).toEqual(GREEN);
    expect(pixel(second?.data ?? new Uint8ClampedArray(), 4, 0, 0)).toEqual(RED);
  });

  it('honours restore-to-background and restore-to-previous disposal', () => {
    const background = decodeGif(twoFrames({}, { disposal: 2 })).frames[1]?.data;
    expect(pixel(background ?? new Uint8ClampedArray(), 4, 0, 0)).toEqual(CLEAR);
    expect(pixel(background ?? new Uint8ClampedArray(), 4, 1, 1)).toEqual(GREEN);
    const previous = decodeGif(
      encodeGif(4, 4, PALETTE, [
        { pixels: fill(16, 1) },
        { pixels: fill(4, 3), left: 0, top: 0, width: 2, height: 2, disposal: 3 },
        { pixels: [2], left: 3, top: 3, width: 1, height: 1 },
      ]),
    ).frames;
    expect(pixel(previous[1]?.data ?? new Uint8ClampedArray(), 4, 0, 0)).toEqual(BLUE);
    // Frame 2 sees frame 1's patch undone (red again), plus its own green pixel.
    expect(pixel(previous[2]?.data ?? new Uint8ClampedArray(), 4, 0, 0)).toEqual(RED);
    expect(pixel(previous[2]?.data ?? new Uint8ClampedArray(), 4, 3, 3)).toEqual(GREEN);
  });

  it('lets transparent pixels show what is underneath', () => {
    const frames = decodeGif(
      encodeGif(2, 1, PALETTE, [{ pixels: [1, 1] }, { pixels: [0, 3], transparent: 0 }]),
    ).frames;
    expect(pixel(frames[1]?.data ?? new Uint8ClampedArray(), 2, 0, 0)).toEqual(RED);
    expect(pixel(frames[1]?.data ?? new Uint8ClampedArray(), 2, 1, 0)).toEqual(BLUE);
  });

  it('borrows the previous control block and shows tiny delays at 100 ms', () => {
    const decoded = decodeGif(
      encodeGif(1, 1, PALETTE, [
        { pixels: [1], delay: 50 },
        { pixels: [2], noControl: true },
        { pixels: [3], delay: 1 },
      ]),
    );
    expect(decoded.frames.map((frame) => frame.end - frame.start)).toEqual([500, 500, 100]);
    expect(decoded.duration).toBe(1100);
  });

  it('thins a long GIF to the frame budget, keeping its running time', () => {
    const count = GIF_LIMITS.frames + 60;
    const frames = Array.from({ length: count }, (_, i): TestFrame => ({
      pixels: [1 + (i % 3)],
      delay: 4,
    }));
    const decoded = decodeGif(encodeGif(1, 1, PALETTE, frames));
    expect(decoded.stride).toBe(2);
    expect(decoded.sourceFrames).toBe(count);
    expect(decoded.frames).toHaveLength(Math.ceil(count / 2));
    expect(decoded.duration).toBe(count * 40);
    expect(decoded.frames.at(-1)?.end).toBe(count * 40);
  });
});

describe('gif bytes', () => {
  const gif = twoFrames();

  it('reads data:image/gif URLs, base64 or percent-encoded, with no network', async () => {
    const fetcher = vi.fn();
    expect(await readGifBytes(`data:image/gif;base64,${base64(gif)}`, fetcher)).toEqual(gif);
    const escaped = Array.from(gif, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
    expect(await readGifBytes(`data:image/gif,${escaped}`, fetcher)).toEqual(gif);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    'http://example.com/cat.gif',
    'javascript:alert(1)',
    '/cat.gif',
    'data:image/png;base64,AAAA',
    42,
  ])('refuses %s', async (url) => {
    await expect(readGifBytes(url, vi.fn())).rejects.toThrow(TypeError);
  });

  it('fetches https: and blob: without credentials, within the size limit', async () => {
    const fetcher = vi.fn((_url: string, _init: { credentials: 'omit' }) =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => String(gif.length) },
        arrayBuffer: () => Promise.resolve(gif.slice().buffer),
      }),
    );
    expect(await readGifBytes('https://cdn.example.com/cat.gif', fetcher)).toEqual(gif);
    expect(await readGifBytes('blob:https://site/1234', fetcher)).toEqual(gif);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
    const missing = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    );
    await expect(readGifBytes('https://x.test/a.gif', missing)).rejects.toThrow(/404/u);
    const big = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => String(GIF_LIMITS.bytes + 1) },
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    );
    await expect(readGifBytes('https://x.test/a.gif', big)).rejects.toThrow(RangeError);
  });
});

/* A scene stand-in with the kit's tick/dispose seams and a recording raster. */
function gifScene(reducedMotion = false) {
  const { PIXI } = fakePixi();
  const ticks: ((time: { dt: number }) => void)[] = [];
  const disposers: (() => void)[] = [];
  const painted: unknown[] = [];
  const sources: { update: ReturnType<typeof vi.fn>; scaleMode: string }[] = [];
  const render = vi.fn();
  const namespace = {
    ...PIXI,
    Texture: {
      from: vi.fn(() => {
        const source = { update: vi.fn(), scaleMode: 'linear' };
        sources.push(source);
        return { source };
      }),
    },
  };
  const scene = {
    PIXI: namespace,
    reducedMotion,
    app: { render },
    tick: vi.fn((fn: (time: { dt: number }) => void) => ticks.push(fn)),
    dispose: vi.fn((fn: () => void) => disposers.push(fn)),
  };
  const env: GifRasterEnv = {
    createCanvas: (width, height) => ({
      width,
      height,
      getContext: () => ({ putImageData: (data: unknown) => painted.push(data) }),
    }),
    imageData: (data) => ({ data }),
  };
  const step = (ms: number): void => {
    for (const fn of ticks) fn({ dt: ms / 1000 });
  };
  return { scene, env, painted, sources, render, ticks, disposers, step };
}

/* Four 1 × 1 frames of 100 ms each. */
const FOUR = decodeGif(
  encodeGif(
    1,
    1,
    PALETTE,
    [0, 1, 2, 3].map((index) => ({ pixels: [index], delay: 10 })),
  ),
);

describe('gif sprite', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays on the scene ticker, frame by frame, and loops', () => {
    const { scene, env, painted, sources, step, ticks } = gifScene();
    const gif = createGifSprite(scene, FOUR, {}, env);
    const frames: number[] = [];
    const loops = vi.fn();
    gif.onFrameChange = (frame) => frames.push(frame);
    gif.onLoop = loops;
    expect(gif).toMatchObject({
      totalFrames: 4,
      duration: 400,
      playing: true,
      currentFrame: 0,
      stride: 1,
    });
    expect(gif.label).toBe('gif');
    expect(painted).toHaveLength(1);
    step(150);
    expect(gif.currentFrame).toBe(1);
    step(100);
    step(100);
    step(100);
    expect(gif.currentFrame).toBe(0);
    expect(frames).toEqual([1, 2, 3, 0]);
    expect(loops).toHaveBeenCalledTimes(1);
    expect(sources[0]?.update).toHaveBeenCalledTimes(4);
    // One tick per scene, however many GIFs it shows.
    createGifSprite(scene, FOUR, {}, env);
    expect(ticks).toHaveLength(1);
  });

  it('stops on the last frame without loop, and play() starts it again', () => {
    const { scene, env, step } = gifScene();
    const done = vi.fn();
    const gif = createGifSprite(scene, FOUR, { loop: false, animationSpeed: 2 }, env);
    gif.onComplete = done;
    // Twice as fast: 120 ms of scene time is 240 ms of GIF time.
    step(120);
    expect(gif.currentFrame).toBe(2);
    step(100);
    expect(gif.playing).toBe(false);
    expect(gif.currentFrame).toBe(3);
    expect(done).toHaveBeenCalledTimes(1);
    gif.play();
    expect(gif.currentFrame).toBe(0);
    expect(gif.playing).toBe(true);
  });

  it('jumps with gotoAndStop / gotoAndPlay and clamps the frame', () => {
    const { scene, env, step } = gifScene();
    const gif = createGifSprite(scene, FOUR, { autoplay: false }, env);
    expect(gif.playing).toBe(false);
    step(500);
    expect(gif.currentFrame).toBe(0);
    gif.gotoAndStop(2);
    expect(gif.currentFrame).toBe(2);
    gif.gotoAndStop(99);
    expect(gif.currentFrame).toBe(3);
    gif.gotoAndPlay(1);
    step(100);
    expect(gif.currentFrame).toBe(2);
    gif.stop();
    step(300);
    expect(gif.currentFrame).toBe(2);
    gif.currentFrame = Number.NaN;
    expect(gif.currentFrame).toBe(0);
  });

  it('holds the first frame under reduced motion and draws it once placed', () => {
    vi.useFakeTimers();
    const { scene, env, step, render } = gifScene(true);
    const gif = createGifSprite(scene, FOUR, {}, env);
    gif.play();
    step(1000);
    expect(gif.playing).toBe(false);
    expect(gif.currentFrame).toBe(0);
    expect(render).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(render).toHaveBeenCalledTimes(1);
    // A manual jump is still drawn at once.
    gif.gotoAndStop(2);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('pixelates on request', () => {
    const { scene, env, sources } = gifScene();
    createGifSprite(scene, FOUR, { pixelated: true }, env);
    expect(sources[0]?.scaleMode).toBe('nearest');
  });

  it('ends with the scene: every GIF destroyed, no new ones', () => {
    const { scene, env, disposers, step } = gifScene();
    const a = createGifSprite(scene, FOUR, {}, env) as GifControls & { destroyed: boolean };
    const b = createGifSprite(scene, FOUR, {}, env) as GifControls & { destroyed: boolean };
    // Whatever a parent passes down (the stage destroys its children), the GIF's own canvas
    // texture and its source go with it.
    const base = Object.getPrototypeOf(Object.getPrototypeOf(b)) as {
      destroy(options?: unknown): void;
    };
    const parentDestroy = vi.spyOn(base, 'destroy');
    b.destroy({ children: true });
    expect(parentDestroy).toHaveBeenCalledWith({
      children: true,
      texture: true,
      textureSource: true,
    });
    parentDestroy.mockRestore();
    expect(b.destroyed).toBe(true);
    expect(b.playing).toBe(false);
    for (const fn of disposers) fn();
    expect(a.destroyed).toBe(true);
    step(500);
    expect(a.currentFrame).toBe(0);
    expect(() => createGifSprite(scene, FOUR, {}, env)).toThrow(/disposed/u);
  });

  it('keeps playing when an author callback throws', () => {
    vi.useFakeTimers();
    const { scene, env, step } = gifScene();
    const gif = createGifSprite(scene, FOUR, {}, env);
    gif.onFrameChange = () => {
      throw new Error('author bug');
    };
    step(100);
    step(100);
    expect(gif.currentFrame).toBe(2);
    expect(() => vi.runAllTimers()).toThrow('author bug');
  });

  it('needs the scene', () => {
    expect(() => createGifSprite({}, FOUR)).toThrow(TypeError);
  });
});

describe('gif library', () => {
  it('exposes the gifuct-js version it bundles and refuses bad input', async () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../../../../node_modules/gifuct-js/package.json'),
        'utf8',
      ),
    ) as { version: string; license: string };
    expect(GIF_VERSION).toBe(manifest.version);
    expect(manifest.license).toBe('MIT');
    const lib = createGifLibrary();
    expect(Object.isFrozen(lib)).toBe(true);
    expect(lib.limits).toBe(GIF_LIMITS);
    const { scene } = gifScene();
    await expect(lib.load(scene, 'https://')).rejects.toThrow();
    await expect(lib.load(scene, 'ftp://x/cat.gif')).rejects.toThrow(TypeError);
    expect(() => lib.from(scene, 'not bytes')).toThrow(TypeError);
    expect(() => lib.from(scene, new TextEncoder().encode('GIF'))).toThrow(TypeError);
  });
});
