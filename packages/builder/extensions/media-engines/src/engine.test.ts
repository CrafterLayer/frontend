import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CkEngineContext } from './ck-engines';
import {
  HOST_ATTR,
  LAYER_ATTR,
  READY_ATTR,
  createSceneEngine,
  isSceneHost,
  type SceneApp,
  type SceneContext,
  type SceneName,
} from './engine';

const noop = (): void => {
  /* a test double with nothing to do */
};

class FakeApp implements SceneApp {
  static instances: FakeApp[] = [];
  /** gsap-pixi additions: make init reject, as a device without a renderer does. */
  static failInit = false;
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
    return FakeApp.failInit ? Promise.reject(new Error('no renderer')) : Promise.resolve();
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
  FakeApp.failInit = false;
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

  // gsap-pixi additions (2026-10-08)
  it('on the editor canvas a ripple runs but never takes pointer input, and the scene is told so', async () => {
    const { engine, received } = setup();
    const el = sceneElement('ripple', ['https://images.example/a.jpg']);
    engine.mount(el, { ...ctx(false), canvas: true });
    await settle();
    expect(el.querySelector('canvas')?.style.pointerEvents).toBe('none');
    expect(received[0]?.still).toBe(false);
    expect(received[0]?.canvas).toBe(true);
  });
});

/* ── gsap-pixi additions (2026-10-08): HOST mode ─────────────────────────── */

function hostElement(name: string, html: string, style?: string): HTMLElement {
  const host = document.createElement('section');
  host.setAttribute('data-ck-scene', name);
  if (style !== undefined) {
    host.setAttribute('style', style);
  }
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

describe('scene engine — host mode', () => {
  it('detects a host by an element child that is not an img (its own artefacts excluded)', () => {
    expect(isSceneHost(hostElement('particles', '<h2>مرحبا</h2>'))).toBe(true);
    expect(isSceneHost(hostElement('particles', '<img src="a.jpg" alt=""><p>x</p>'))).toBe(true);
    expect(isSceneHost(sceneElement('mural', ['https://images.example/a.jpg']))).toBe(false);
    expect(isSceneHost(sceneElement('particles'))).toBe(false);
    const layered = sceneElement('mural', ['https://images.example/a.jpg']);
    layered.insertAdjacentHTML(
      'beforeend',
      `<div ${LAYER_ATTR}></div><canvas data-ck-scene-canvas></canvas>`,
    );
    expect(isSceneHost(layered)).toBe(false);
  });

  it('draws into a first-child layer behind the content, loads no texture, and restores the host on dispose', async () => {
    const { engine, loadTexture, received } = setup();
    const host = hostElement(
      'particles',
      '<h2>مرحبا</h2><img src="https://images.example/content.jpg" alt="محتوى">',
    );
    host.setAttribute('data-ck-density', 'high');

    const dispose = engine.mount(host, ctx(false, true));
    await settle();

    expect(loadTexture).not.toHaveBeenCalled();
    const layer = host.firstElementChild as HTMLElement;
    expect(layer.hasAttribute(LAYER_ATTR)).toBe(true);
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.style.position).toBe('absolute');
    expect(layer.style.getPropertyValue('inset')).toMatch(/^0(px)?$/u);
    expect(layer.style.zIndex).toBe('-1');
    expect(layer.style.pointerEvents).toBe('none');
    expect(layer.style.overflow).toBe('hidden');
    expect(host.hasAttribute(HOST_ATTR)).toBe(true);
    expect(host.style.getPropertyValue('isolation')).toBe('isolate');
    expect(host.style.position).toBe('relative');

    const app = FakeApp.instances[0];
    expect(app?.initOptions?.['resizeTo']).toBe(layer);
    expect(layer.querySelector('canvas')).toBe(app?.canvas);
    expect(app?.canvas.style.pointerEvents).toBe('none');
    expect(received[0]?.textures).toEqual([]);
    expect(received[0]?.pointerHost).toBe(host);
    expect(received[0]?.density).toBe('high');
    expect(received[0]?.sign).toBe(-1);
    expect(host.hasAttribute(READY_ATTR)).toBe(true);
    // The content stays where it was, after the layer.
    expect(host.querySelector('h2')?.previousElementSibling).toBe(layer);
    expect(host.querySelector('img')).not.toBeNull();

    dispose();
    expect(host.querySelector(`[${LAYER_ATTR}]`)).toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.hasAttribute(HOST_ATTR)).toBe(false);
    expect(host.hasAttribute(READY_ATTR)).toBe(false);
    expect(host.hasAttribute('style')).toBe(false);
    expect(host.firstElementChild?.localName).toBe('h2');
  });

  it('keeps a positioned host’s own position and restores its inline style exactly', async () => {
    const { engine } = setup();
    const host = hostElement('mesh-gradient', '<div>x</div>', 'position: absolute; color: red;');

    const dispose = engine.mount(host, ctx());
    await settle();
    expect(host.style.position).toBe('absolute');
    expect(host.style.getPropertyValue('isolation')).toBe('isolate');

    dispose();
    expect(host.style.position).toBe('absolute');
    expect(host.style.color).toBe('red');
    expect(host.style.getPropertyValue('isolation')).toBe('');
  });

  it('mounts again after a dispose with exactly one layer', async () => {
    const { engine } = setup();
    const host = hostElement('particles', '<h2>x</h2>');
    engine.mount(host, ctx())();
    await settle();
    engine.mount(host, ctx());
    await settle();
    expect(host.querySelectorAll(`[${LAYER_ATTR}]`)).toHaveLength(1);
    expect(host.firstElementChild?.hasAttribute(LAYER_ATTR)).toBe(true);
  });

  it('a renderer that fails to start leaves no layer and an untouched host', async () => {
    FakeApp.failInit = true;
    const { engine } = setup();
    const host = hostElement('particles', '<h2>x</h2>');
    engine.mount(host, ctx());
    await settle();
    expect(host.querySelector(`[${LAYER_ATTR}]`)).toBeNull();
    expect(host.hasAttribute(HOST_ATTR)).toBe(false);
    expect(host.hasAttribute(READY_ATTR)).toBe(false);
    expect(host.hasAttribute('style')).toBe(false);
  });
});
