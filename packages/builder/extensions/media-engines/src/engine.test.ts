import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CkEngineContext } from './ck-engines';
import {
  READY_ATTR,
  createSceneEngine,
  type SceneApp,
  type SceneContext,
  type SceneName,
} from './engine';

const noop = (): void => {
  /* a test double with nothing to do */
};

class FakeApp implements SceneApp {
  static instances: FakeApp[] = [];
  readonly canvas = document.createElement('canvas');
  initOptions: Record<string, unknown> | undefined;
  readonly start = vi.fn();
  readonly stop = vi.fn();
  readonly render = vi.fn();
  readonly destroy = vi.fn((removeView?: boolean) => {
    if (removeView === true) {
      this.canvas.remove();
    }
  });
  constructor() {
    FakeApp.instances.push(this);
  }
  init(options: Record<string, unknown>) {
    this.initOptions = options;
    return Promise.resolve();
  }
}

function ctx(still = false, rtl = false): CkEngineContext {
  return { still, rtl, lang: rtl ? 'ar' : 'en', onPlay: noop, onStop: noop };
}

const restores: (() => void)[] = [];

/** The engine reads the ELEMENT's window (`ownerDocument.defaultView`), which may not be globalThis. */
function defineOnWindows(key: string, value: unknown) {
  const targets = new Set<object>([globalThis, document.defaultView ?? globalThis]);
  for (const target of targets) {
    const previous = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { configurable: true, writable: true, value });
    restores.push(() => {
      if (previous === undefined) {
        Reflect.deleteProperty(target, key);
      } else {
        Object.defineProperty(target, key, previous);
      }
    });
  }
}

function setup(options: { reduced?: boolean; dpr?: number; failTexture?: boolean } = {}) {
  defineOnWindows('matchMedia', (query: string) => ({
    matches: query.includes('reduce') ? options.reduced === true : false,
    addEventListener: noop,
    removeEventListener: noop,
  }));
  defineOnWindows('devicePixelRatio', options.dpr ?? 1);

  const sceneDispose = vi.fn();
  const received: SceneContext<string>[] = [];
  const scene = vi.fn((_app: FakeApp, _el: HTMLElement, context: SceneContext<string>) => {
    received.push(context);
    return sceneDispose;
  });
  const scenes = Object.fromEntries(
    (['particles', 'mesh-gradient', 'parallax-layers', 'mural', 'ripple'] as SceneName[]).map(
      (name) => [name, scene],
    ),
  ) as Record<SceneName, typeof scene>;
  const loadTexture = vi.fn((url: string) =>
    options.failTexture === true
      ? Promise.reject(new Error('CORS'))
      : Promise.resolve(`texture:${url}`),
  );
  const createApp = vi.fn(() => new FakeApp());
  const engine = createSceneEngine<FakeApp, string>({ createApp, loadTexture, scenes });
  return { engine, createApp, loadTexture, scene, sceneDispose, received };
}

function sceneElement(name: string, images: string[] = []): HTMLElement {
  const section = document.createElement('section');
  const el = document.createElement('div');
  el.setAttribute('data-ck-scene', name);
  for (const src of images) {
    const img = document.createElement('img');
    img.setAttribute('src', src);
    img.alt = '';
    el.append(img);
  }
  section.append(el);
  document.body.append(section);
  return el;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  restores
    .splice(0)
    .reverse()
    .forEach((restore) => {
      restore();
    });
  FakeApp.instances = [];
  document.body.replaceChildren();
});

describe('scene engine mount', () => {
  it('never mounts under reduced motion: no texture request, no app, fallback untouched', async () => {
    const { engine, createApp, loadTexture } = setup({ reduced: true });
    const el = sceneElement('mural', ['https://images.example/a.jpg']);

    const dispose = engine.mount(el, ctx());
    await settle();

    expect(loadTexture).not.toHaveBeenCalled();
    expect(createApp).not.toHaveBeenCalled();
    expect(el.hasAttribute(READY_ATTR)).toBe(false);
    expect(el.querySelector('canvas')).toBeNull();
    dispose();
  });

  it('creates a decorative, DPR-capped WebGL canvas inside the element and marks it ready', async () => {
    const { engine, received, scene } = setup({ dpr: 3 });
    const el = sceneElement('mural', [
      'https://images.example/a.jpg',
      'https://images.example/b.jpg',
    ]);
    el.setAttribute('data-ck-density', 'low');

    engine.mount(el, ctx(false, true));
    await settle();

    const app = FakeApp.instances[0];
    expect(app?.initOptions).toMatchObject({
      resolution: 2,
      autoDensity: true,
      preference: 'webgl',
      backgroundAlpha: 0,
      autoStart: false,
      resizeTo: el,
    });
    const canvas = el.querySelector('canvas');
    expect(canvas).toBe(app?.canvas);
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    expect(canvas?.getAttribute('role')).toBe('presentation');
    expect(canvas?.style.pointerEvents).toBe('none');
    expect(el.hasAttribute(READY_ATTR)).toBe(true);
    expect(scene).toHaveBeenCalledTimes(1);
    expect(received[0]?.textures).toEqual([
      'texture:https://images.example/a.jpg',
      'texture:https://images.example/b.jpg',
    ]);
    expect(received[0]?.sign).toBe(-1);
    expect(received[0]?.density).toBe('low');
    expect(received[0]?.pointerHost).toBe(el.parentElement);
    expect(app?.render).toHaveBeenCalledTimes(1);
  });

  it('lets only a live ripple take pointer events', async () => {
    const live = setup();
    const el = sceneElement('ripple', ['https://images.example/a.jpg']);
    live.engine.mount(el, ctx(false));
    await settle();
    expect(el.querySelector('canvas')?.style.pointerEvents).toBe('auto');

    const still = setup();
    const stillEl = sceneElement('ripple', ['https://images.example/a.jpg']);
    still.engine.mount(stillEl, ctx(true));
    await settle();
    expect(stillEl.querySelector('canvas')?.style.pointerEvents).toBe('none');
  });

  it('keeps the fallback and never sets ready when a texture fails to load', async () => {
    const { engine, createApp } = setup({ failTexture: true });
    const el = sceneElement('ripple', ['https://blocked.example/a.jpg']);

    engine.mount(el, ctx());
    await settle();

    expect(createApp).not.toHaveBeenCalled();
    expect(el.hasAttribute(READY_ATTR)).toBe(false);
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('disposes with app.destroy(true), removing the canvas and the ready mark', async () => {
    const { engine, sceneDispose } = setup();
    const el = sceneElement('particles');

    const dispose = engine.mount(el, ctx());
    await settle();
    expect(el.hasAttribute(READY_ATTR)).toBe(true);

    dispose();

    expect(sceneDispose).toHaveBeenCalledTimes(1);
    expect(FakeApp.instances[0]?.destroy).toHaveBeenCalledWith(true);
    expect(el.querySelector('canvas')).toBeNull();
    expect(el.hasAttribute(READY_ATTR)).toBe(false);
  });

  it('ignores unknown scenes and a second mount of the same element', async () => {
    const { engine, createApp } = setup();
    const unknown = sceneElement('fireworks');
    engine.mount(unknown, ctx());

    const el = sceneElement('particles');
    engine.mount(el, ctx());
    engine.mount(el, ctx());
    await settle();

    expect(createApp).toHaveBeenCalledTimes(1);
  });

  it('a dispose before the textures resolve never creates the app', async () => {
    const { engine, createApp } = setup();
    const el = sceneElement('mural', ['https://images.example/a.jpg']);

    const dispose = engine.mount(el, ctx());
    dispose();
    await settle();

    expect(createApp).not.toHaveBeenCalled();
    expect(el.hasAttribute(READY_ATTR)).toBe(false);
  });
});
