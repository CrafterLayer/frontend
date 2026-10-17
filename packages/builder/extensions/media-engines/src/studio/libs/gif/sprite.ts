/*
  The animated GIF on the canvas (animated GIFs, 2026-10-13): a subclass of the page's own
  PIXI.Sprite (the namespace arrives with the scene, so this library never bundles Pixi) whose
  texture is one canvas the current frame is painted into. Its controls follow Pixi's
  AnimatedSprite: play(), stop(), gotoAndStop(n), gotoAndPlay(n), currentFrame, totalFrames,
  animationSpeed, loop, playing, onLoop, onComplete, onFrameChange.

  It advances on the scene's own ticker (one s.tick per scene for all its GIFs), so it pauses
  offscreen, on a hidden page and in the quality governor's still frame like everything else in
  the scene — never on Ticker.shared. Reduced motion shows the first frame and never plays.
  s.dispose destroys every GIF of the scene, its texture and its frames.
*/

import type { DecodedGif } from './decode';

export interface GifOptions {
  /** Playback rate, 0.1..4 (default 1). */
  animationSpeed?: number;
  /** Start again after the last frame (default true; false stops on it and calls onComplete). */
  loop?: boolean;
  /** Start playing at once (default true; never under reduced motion). */
  autoplay?: boolean;
  /** Nearest-neighbour scaling for pixel art (default false: smooth). */
  pixelated?: boolean;
}

interface TextureLike {
  readonly source: { update(): void; scaleMode?: string };
}

interface SpriteLike {
  label?: string;
  readonly destroyed?: boolean;
  destroy(options?: unknown): void;
}

type SpriteConstructor = new (options?: unknown) => SpriteLike;

interface GifNamespace {
  readonly Sprite: SpriteConstructor;
  readonly Texture: { from(source: unknown, skipCache?: boolean): TextureLike };
}

interface GifScene {
  readonly PIXI: GifNamespace;
  readonly reducedMotion?: boolean;
  tick?(fn: (time: { dt: number }) => void): void;
  dispose?(fn: () => void): void;
  readonly app?: { render?(): void };
}

interface ContextLike {
  putImageData(data: unknown, x: number, y: number): void;
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): ContextLike | null;
}

/** How frames reach a canvas; the browser's by default, injected by tests. */
export interface GifRasterEnv {
  createCanvas(width: number, height: number): CanvasLike;
  imageData(data: Uint8ClampedArray, width: number, height: number): unknown;
}

/** The controls a GIF sprite adds to PIXI.Sprite. */
export interface GifControls extends SpriteLike {
  animationSpeed: number;
  loop: boolean;
  onLoop: (() => void) | null;
  onComplete: (() => void) | null;
  onFrameChange: ((frame: number) => void) | null;
  readonly totalFrames: number;
  /** Milliseconds for one pass. */
  readonly duration: number;
  readonly playing: boolean;
  /** 1 when every frame of the file is shown; n when every n-th is (long GIFs). */
  readonly stride: number;
  currentFrame: number;
  play(): void;
  stop(): void;
  gotoAndStop(frame: number): void;
  gotoAndPlay(frame: number): void;
  /** Advance by `ms` milliseconds of scene time (the scene's tick calls it). */
  advance(ms: number): void;
}

interface GifState {
  frames: DecodedGif['frames'];
  images: unknown[];
  readonly canvas: CanvasLike;
  readonly context: ContextLike;
  readonly texture: TextureLike;
  readonly duration: number;
  readonly stride: number;
  readonly reduced: boolean;
  readonly render: (() => void) | undefined;
  readonly registry: SceneGifs;
  time: number;
  index: number;
  playing: boolean;
}

interface SceneGifs {
  readonly gifs: Set<GifControls>;
  disposed: boolean;
}

const scenes = new WeakMap<object, SceneGifs>();
const classes = new WeakMap<
  SpriteConstructor,
  new (texture: TextureLike, state: GifState) => GifControls
>();

function later(error: unknown): void {
  // An author's callback that throws is reported like any page error; the GIFs keep playing.
  setTimeout(() => {
    throw error;
  }, 0);
}

function call<T extends unknown[]>(fn: ((...args: T) => void) | null, ...args: T): void {
  if (typeof fn !== 'function') return;
  try {
    fn(...args);
  } catch (error) {
    later(error);
  }
}

function registryFor(scene: GifScene): SceneGifs {
  const known = scenes.get(scene);
  if (known !== undefined) return known;
  const registry: SceneGifs = { gifs: new Set(), disposed: false };
  scenes.set(scene, registry);
  scene.tick?.((time) => {
    const ms = Number.isFinite(time.dt) ? time.dt * 1000 : 0;
    for (const gif of [...registry.gifs]) gif.advance(ms);
  });
  scene.dispose?.(() => {
    registry.disposed = true;
    for (const gif of [...registry.gifs]) gif.destroy();
    registry.gifs.clear();
  });
  return registry;
}

function frameAt(frames: DecodedGif['frames'], time: number): number {
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if ((frames[middle]?.start ?? 0) <= time) low = middle;
    else high = middle - 1;
  }
  return low;
}

function gifClass(Base: SpriteConstructor) {
  const known = classes.get(Base);
  if (known !== undefined) return known;

  class GifSprite extends Base implements GifControls {
    animationSpeed = 1;
    loop = true;
    onLoop: (() => void) | null = null;
    onComplete: (() => void) | null = null;
    onFrameChange: ((frame: number) => void) | null = null;
    readonly #state: GifState;

    constructor(texture: TextureLike, state: GifState) {
      super({ texture });
      this.#state = state;
      this.label = 'gif';
    }

    get totalFrames(): number {
      return this.#state.frames.length;
    }

    get duration(): number {
      return this.#state.duration;
    }

    get playing(): boolean {
      return this.#state.playing;
    }

    get stride(): number {
      return this.#state.stride;
    }

    get currentFrame(): number {
      return this.#state.index;
    }

    set currentFrame(value: number) {
      const state = this.#state;
      if (state.frames.length === 0) return;
      const index = Math.min(
        state.frames.length - 1,
        Math.max(0, Math.round(Number.isFinite(value) ? value : 0)),
      );
      state.time = state.frames[index]?.start ?? 0;
      this.#show(index);
    }

    play(): void {
      const state = this.#state;
      if (state.reduced || this.destroyed === true || state.frames.length < 2) return;
      if (!this.loop && state.time >= state.duration) {
        state.time = 0;
        this.#show(0);
      }
      state.playing = true;
    }

    stop(): void {
      this.#state.playing = false;
    }

    gotoAndStop(frame: number): void {
      this.stop();
      this.currentFrame = frame;
    }

    gotoAndPlay(frame: number): void {
      this.currentFrame = frame;
      this.play();
    }

    advance(ms: number): void {
      const state = this.#state;
      if (!state.playing || !(ms > 0) || state.frames.length === 0) return;
      const speed = Number.isFinite(this.animationSpeed)
        ? Math.min(4, Math.max(0, this.animationSpeed))
        : 1;
      let time = state.time + ms * speed;
      if (time >= state.duration) {
        if (!this.loop) {
          state.time = state.duration;
          state.playing = false;
          this.#show(state.frames.length - 1);
          call(this.onComplete);
          return;
        }
        time %= state.duration;
        call(this.onLoop);
      }
      state.time = time;
      this.#show(frameAt(state.frames, time));
    }

    override destroy(options?: unknown): void {
      if (this.destroyed === true) return;
      const state = this.#state;
      state.playing = false;
      state.registry.gifs.delete(this);
      // The canvas texture is this sprite's own, whatever a parent's destroy() passes down.
      const given =
        typeof options === 'object' && options !== null ? options : { children: options === true };
      super.destroy({ ...given, texture: true, textureSource: true });
      state.frames = [];
      state.images = [];
      state.canvas.width = 0;
      state.canvas.height = 0;
    }

    /** Paint frame `index` (frame 0 is painted at creation, so an unchanged index is a no-op). */
    #show(index: number): void {
      const state = this.#state;
      const image = state.images[index];
      if (index === state.index || image === undefined) return;
      state.index = index;
      state.context.putImageData(image, 0, 0);
      state.texture.source.update();
      state.render?.();
      call(this.onFrameChange, index);
    }
  }

  classes.set(Base, GifSprite);
  return GifSprite;
}

function sceneOf(value: unknown): GifScene {
  const pixi = (value as { PIXI?: Partial<GifNamespace> } | null)?.PIXI;
  if (typeof pixi?.Sprite !== 'function' || typeof pixi.Texture?.from !== 'function') {
    throw new TypeError('gif: pass the scene (s) as the first argument');
  }
  return value as GifScene;
}

function browserRaster(): GifRasterEnv {
  const doc = (globalThis as { document?: Document }).document;
  const ImageDataClass = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  if (doc === undefined || typeof ImageDataClass !== 'function') {
    throw new Error('gif: animated GIFs need a browser canvas');
  }
  return {
    createCanvas(width, height) {
      const canvas = doc.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    imageData: (data, width, height) =>
      new ImageDataClass(data as Uint8ClampedArray<ArrayBuffer>, width, height),
  };
}

export function createGifSprite(
  sceneValue: unknown,
  decoded: DecodedGif,
  options: GifOptions = {},
  env?: GifRasterEnv,
): GifControls {
  const scene = sceneOf(sceneValue);
  const registry = registryFor(scene);
  if (registry.disposed) throw new Error('gif: the scene has been disposed');
  const raster = env ?? browserRaster();
  const canvas = raster.createCanvas(decoded.width, decoded.height);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('gif: this browser has no 2D canvas');
  const images = decoded.frames.map((frame) =>
    raster.imageData(frame.data, decoded.width, decoded.height),
  );
  context.putImageData(images[0], 0, 0);
  const texture = scene.PIXI.Texture.from(canvas, true);
  if (options.pixelated === true) texture.source.scaleMode = 'nearest';
  const reduced = scene.reducedMotion === true;
  const app = scene.app;
  const render =
    reduced && typeof app?.render === 'function'
      ? () => {
          if (registry.disposed) return;
          try {
            app.render?.();
          } catch {
            // The stage went away first: nothing left to draw.
          }
        }
      : undefined;
  const state: GifState = {
    frames: decoded.frames,
    images,
    canvas,
    context,
    texture,
    duration: Math.max(1, decoded.duration),
    stride: decoded.stride,
    reduced,
    render,
    registry,
    time: 0,
    index: 0,
    playing: false,
  };
  const GifSprite = gifClass(scene.PIXI.Sprite);
  const sprite = new GifSprite(texture, state);
  if (typeof options.animationSpeed === 'number' && Number.isFinite(options.animationSpeed)) {
    sprite.animationSpeed = Math.min(4, Math.max(0.1, options.animationSpeed));
  }
  if (options.loop === false) sprite.loop = false;
  registry.gifs.add(sprite);
  if (options.autoplay !== false) sprite.play();
  // A still (reduced-motion) scene draws only when asked: once the caller has placed the GIF.
  if (render !== undefined) setTimeout(render, 0);
  return sprite;
}
